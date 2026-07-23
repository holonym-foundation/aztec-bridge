/**
 * Integration checks for the two things that are enforced by Prisma queries
 * rather than by the pure ledger in deposit-ledger.test.ts: which identity a cap
 * is counted against, and which half of the pair a binding is matched on.
 *
 * Needs a throwaway Postgres, so it is not part of any automated run:
 *
 *   docker run -d --name shield-test-pg -p 55432:5432 \
 *     -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=shield_test postgres:16
 *   export DATABASE_URL="postgresql://test:test@localhost:55432/shield_test"
 *   export JWT_SECRET=test POCH_ATTESTER_PRIVATE_KEY=0x11{..32 bytes..} PASSPORT_SIGNER_PRIVATE_KEY=0x22{..}
 *   npx prisma db push --skip-generate
 *   npx tsx src/lib/address-binding.integration.test.ts
 *
 * Every case marked below as a regression fails on the parent commit; the rest
 * assert behaviour that must NOT change, and pass on both.
 */
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signJWT } from '@/lib/jwt'
import { GET as statusRoute } from '@/app/api/attestation/status/route'
import {
  enforceAddressBinding,
  checkAddressBindingConflict,
  getReservedDepositUsd,
  evaluateDepositLimit,
  evaluateTravelRuleThreshold,
} from '@/lib/address-binding'

const L1_VICTIM = '0xvictim1111111111111111111111111111111111'
const L1_ATTACKER = '0xattacker22222222222222222222222222222222'
const L1_OTHER = '0xother3333333333333333333333333333333333'
const L2_VICTIM = '0xaztecvictim0000000000000000000000000000000000000000000000000001'
const L2_ALT = '0xaztecalt00000000000000000000000000000000000000000000000000000002'
const L2_OTHER = '0xaztecother000000000000000000000000000000000000000000000000000003'

let passed = 0
let failed = 0
async function it(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  PASS  ${name}`)
  } catch (err) {
    failed++
    console.log(`  FAIL  ${name}`)
    console.log(`        ${(err as Error).message.split('\n').slice(0, 4).join('\n        ')}`)
  }
}

async function reset() {
  await prisma.attestationReservation.deleteMany({})
  await prisma.addressBinding.deleteMany({})
  await prisma.user.deleteMany({})
}

async function mkUser(l1: string, l2: string) {
  return prisma.user.create({ data: { l1Address: l1, l2Address: l2 } })
}

async function callStatusRoute(user: { id: string; l1Address: string; l2Address: string }) {
  const token = signJWT({ userId: user.id, l1Address: user.l1Address, l2Address: user.l2Address })
  const req = new NextRequest('https://testnet.shield.human.tech/api/attestation/status', {
    headers: { authorization: `Bearer ${token}` },
  })
  const res = await statusRoute(req)
  assert.equal(res.status, 200, `status route returned ${res.status}`)
  return res.json() as Promise<{ binding: { status: string; l1Address: string | null; l2Address: string | null } }>
}

let nonceSeq = 0
async function mkHold(userId: string, amountUsd: number, opts: { method?: string; ageMs?: number; ttlMs?: number } = {}) {
  const now = Date.now()
  return prisma.attestationReservation.create({
    data: {
      fkUserId: userId,
      nonce: `${++nonceSeq}`,
      amountUsd,
      method: opts.method ?? 'passport',
      // Default: far-future expiry so the on-chain resolver never touches it.
      expiresAt: new Date(now + (opts.ttlMs ?? 60 * 60 * 1000)),
      createdAt: new Date(now - (opts.ageMs ?? 0)),
    },
  })
}

async function main() {
  console.log('\n── HIGH 2: address binding ────────────────────────────────────\n')

  await it('REGRESSION: an attacker cannot lock a victim out of their own L2 address', async () => {
    await reset()
    const bound = await enforceAddressBinding(L1_ATTACKER, L2_VICTIM)
    assert.equal(bound, null, 'attacker binding should be created')

    const victim = await enforceAddressBinding(L1_VICTIM, L2_VICTIM)
    assert.equal(victim, null, 'victim must NOT be blocked by a claim on their unproven L2 half')
  })

  await it('REGRESSION: the victim is not blocked at the pre-flight check either', async () => {
    await reset()
    await enforceAddressBinding(L1_ATTACKER, L2_VICTIM)
    assert.equal(await checkAddressBindingConflict(L1_VICTIM, L2_VICTIM), null)
  })

  await it("a user's OWN proven L1 bound elsewhere still blocks (product guard intact)", async () => {
    await reset()
    await enforceAddressBinding(L1_VICTIM, L2_VICTIM)
    const err = await enforceAddressBinding(L1_VICTIM, L2_ALT)
    assert.ok(err, 'switching L2 under a bound L1 must still be refused')
    assert.match(err!, /already bound to a different L2/)
    assert.equal(err, await checkAddressBindingConflict(L1_VICTIM, L2_ALT), 'check and enforce must agree')
  })

  await it('rebinding the same pair is idempotent', async () => {
    await reset()
    assert.equal(await enforceAddressBinding(L1_VICTIM, L2_VICTIM), null)
    assert.equal(await enforceAddressBinding(L1_VICTIM, L2_VICTIM), null)
    assert.equal(await prisma.addressBinding.count(), 1)
  })

  await it("the victim's blocked insert leaves no row and never throws", async () => {
    await reset()
    await enforceAddressBinding(L1_ATTACKER, L2_VICTIM)
    await enforceAddressBinding(L1_VICTIM, L2_VICTIM)
    const rows = await prisma.addressBinding.findMany({})
    assert.equal(rows.length, 1, 'the l2Address unique constraint still holds; we swallow it')
    assert.equal(rows[0].l1Address, L1_ATTACKER)
  })

  await it('REGRESSION: GET /api/attestation/status discloses nothing about who claimed the L2', async () => {
    await reset()
    await enforceAddressBinding(L1_ATTACKER, L2_VICTIM)
    const victim = await mkUser(L1_VICTIM, L2_VICTIM)
    const body = await callStatusRoute(victim)
    assert.equal(body.binding.status, 'unbound', "another L1's claim must not read as a conflict")
    assert.equal(body.binding.l1Address, null, "must not disclose the claiming L1 address")
    assert.notEqual(body.binding.l1Address, L1_ATTACKER)
  })

  await it('GET /api/attestation/status still reports the L1-side conflict', async () => {
    await reset()
    await enforceAddressBinding(L1_VICTIM, L2_ALT)
    const user = await mkUser(L1_VICTIM, L2_VICTIM)
    const body = await callStatusRoute(user)
    assert.equal(body.binding.status, 'conflict', 'the proven half must still surface')
    assert.equal(body.binding.l2Address, L2_ALT, 'and name the linked Aztec account')
  })

  await it('concurrent first-binds from one L1 do not throw and agree', async () => {
    await reset()
    const results = await Promise.all([
      enforceAddressBinding(L1_VICTIM, L2_VICTIM),
      enforceAddressBinding(L1_VICTIM, L2_VICTIM),
      enforceAddressBinding(L1_VICTIM, L2_VICTIM),
    ])
    assert.deepEqual(results, [null, null, null])
    assert.equal(await prisma.addressBinding.count(), 1)
  })

  await it('a concurrent race onto a DIFFERENT L2 resolves to one winner, no crash', async () => {
    await reset()
    const results = await Promise.all([
      enforceAddressBinding(L1_VICTIM, L2_VICTIM),
      enforceAddressBinding(L1_VICTIM, L2_ALT),
    ])
    assert.equal(await prisma.addressBinding.count(), 1)
    assert.equal(results.filter((r) => r === null).length, 1, 'exactly one must win')
  })

  console.log('\n── HIGH 1 hardening: caps counted per L1 address ───────────────\n')

  await it('REGRESSION: one L1 across two L2 addresses shares ONE budget (was: one each)', async () => {
    await reset()
    const a = await mkUser(L1_VICTIM, L2_VICTIM)
    const b = await mkUser(L1_VICTIM, L2_ALT)
    await mkHold(a.id, 400)
    await mkHold(b.id, 350)

    assert.equal(await getReservedDepositUsd(a.id), 750, 'seen from the first L2')
    assert.equal(await getReservedDepositUsd(b.id), 750, 'seen from the second L2')
  })

  await it("a different L1's holds are never counted", async () => {
    await reset()
    const a = await mkUser(L1_VICTIM, L2_VICTIM)
    const other = await mkUser(L1_OTHER, L2_OTHER)
    await mkHold(a.id, 400)
    await mkHold(other.id, 999)
    assert.equal(await getReservedDepositUsd(a.id), 400)
    assert.equal(await getReservedDepositUsd(other.id), 999)
  })

  await it('REGRESSION: the 24h deposit cap aggregates across the L1 (rotating L2 buys nothing)', async () => {
    await reset()
    const a = await mkUser(L1_VICTIM, L2_VICTIM)
    const b = await mkUser(L1_VICTIM, L2_ALT)
    await mkHold(a.id, 20000)
    await mkHold(b.id, 8000)
    const limit = await evaluateDepositLimit({ userId: b.id })
    assert.equal(limit.enabled, true, 'BRIDGE_MAX_DEPOSIT_USD must be set for this case')
    assert.equal(limit.overLimit, true, '20k + 8k must exceed the 25k cap from EITHER L2')
  })

  await it('REGRESSION: the Travel Rule lifetime total aggregates across the L1', async () => {
    await reset()
    const a = await mkUser(L1_VICTIM, L2_VICTIM)
    const b = await mkUser(L1_VICTIM, L2_ALT)
    // Settled = past the rolling window and past its own deadline.
    await mkHold(a.id, 600, { ageMs: 48 * 60 * 60 * 1000, ttlMs: -24 * 60 * 60 * 1000 })
    await mkHold(b.id, 600, { ageMs: 48 * 60 * 60 * 1000, ttlMs: -24 * 60 * 60 * 1000 })
    const tr = await evaluateTravelRuleThreshold({ userId: a.id })
    assert.equal(tr.enabled, true)
    assert.equal(tr.lifetimeUsd, 1200, 'both L2s count toward the same human')
    assert.equal(tr.exceeded, true, '1200 must cross the 1000 threshold')
  })

  await it('POCH holds stay out of the Travel Rule sum even when aggregated', async () => {
    await reset()
    const a = await mkUser(L1_VICTIM, L2_VICTIM)
    const b = await mkUser(L1_VICTIM, L2_ALT)
    await mkHold(a.id, 600, { ageMs: 48 * 60 * 60 * 1000, ttlMs: -24 * 60 * 60 * 1000 })
    await mkHold(b.id, 600, { method: 'poch', ageMs: 48 * 60 * 60 * 1000, ttlMs: -24 * 60 * 60 * 1000 })
    const tr = await evaluateTravelRuleThreshold({ userId: a.id })
    assert.equal(tr.lifetimeUsd, 600)
    assert.equal(tr.exceeded, false)
  })

  await reset()
  await prisma.$disconnect()
  console.log(`\n  ${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
