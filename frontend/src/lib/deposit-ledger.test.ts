import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalDecimals,
  valueBaseUnitsUsd,
  usdToBaseUnits,
  resolveHold,
  sumHeldUsd,
  synthStatus,
  type HeldRow,
  type TokenMeta,
} from './deposit-ledger.ts'

const REGISTRY: TokenMeta[] = [
  { symbol: 'USDC', decimals: 6 },
  { symbol: 'WBTC', decimals: 8 },
  { symbol: 'DAI', decimals: 18 },
]

// ── canonicalDecimals: the decimals-spoof lever is removed ──────────────────

test('canonicalDecimals resolves known symbols case-insensitively', () => {
  assert.equal(canonicalDecimals('USDC', REGISTRY), 6)
  assert.equal(canonicalDecimals('usdc', REGISTRY), 6)
  assert.equal(canonicalDecimals('WBTC', REGISTRY), 8)
  assert.equal(canonicalDecimals('DAI', REGISTRY), 18)
})

test('canonicalDecimals ignores an unknown/spoofed symbol and falls back safely', () => {
  // A client claiming a bogus symbol cannot pick its own decimals.
  assert.equal(canonicalDecimals('EVIL', REGISTRY), 6)
  assert.equal(canonicalDecimals('', REGISTRY), 6)
})

test('a 6-dp USDC deposit is valued the same whatever decimals the client claims', () => {
  // 1000 USDC in real 6-dp base units.
  const baseUnits = 1000n * 10n ** 6n
  const canonical = canonicalDecimals('USDC', REGISTRY) // 6, not the client's claim
  assert.equal(valueBaseUnitsUsd(baseUnits, canonical, 1.0), 1000)
  // The old bug: valuing the SAME base units with a client-inflated 36 decimals
  // collapses the charge to ~0 — which is exactly what canonical decimals prevents.
  assert.ok(valueBaseUnitsUsd(baseUnits, 36, 1.0) < 1e-6)
})

// ── valuation round-trips are self-consistent ───────────────────────────────

test('usdToBaseUnits and valueBaseUnitsUsd round-trip', () => {
  const units = usdToBaseUnits(250, 1.0, 6)
  assert.equal(units, 250n * 10n ** 6n)
  assert.equal(valueBaseUnitsUsd(units, 6, 1.0), 250)
})

test('valuation is defensive on non-positive inputs', () => {
  assert.equal(valueBaseUnitsUsd(0n, 6, 1), 0)
  assert.equal(valueBaseUnitsUsd(-5n, 6, 1), 0)
  assert.equal(valueBaseUnitsUsd(1000000n, 6, 0), 0)
  assert.equal(usdToBaseUnits(0, 1, 6), 0n)
  assert.equal(usdToBaseUnits(100, 0, 6), 0n)
})

// ── resolveHold: the fail-safe settle/release decision ──────────────────────

test('a consumed nonce settles the hold (kept forever)', () => {
  assert.equal(
    resolveHold({ status: 'active', expired: true, neverExpires: false, nonceConsumed: true }),
    'consumed',
  )
  // Even before the deadline, a seen-consumed nonce settles.
  assert.equal(
    resolveHold({ status: 'active', expired: false, neverExpires: false, nonceConsumed: true }),
    'consumed',
  )
})

test('an unused nonce past the enforced deadline is released', () => {
  assert.equal(
    resolveHold({ status: 'active', expired: true, neverExpires: false, nonceConsumed: false }),
    'released',
  )
})

test('an unused nonce is NOT released before its deadline', () => {
  assert.equal(
    resolveHold({ status: 'active', expired: false, neverExpires: false, nonceConsumed: false }),
    'active',
  )
})

test('FAIL-SAFE: an unreadable chain (undefined) never releases — keeps counting', () => {
  assert.equal(
    resolveHold({ status: 'active', expired: true, neverExpires: false, nonceConsumed: undefined }),
    'active',
  )
})

test('FAIL-SAFE: a deadline-less (clean-hands) hold is never released on time', () => {
  // The clean-hands signature carries no deadline, so the nonce can be consumed
  // indefinitely — releasing it on expiry would let a later deposit go uncounted.
  assert.equal(
    resolveHold({ status: 'active', expired: true, neverExpires: true, nonceConsumed: false }),
    'active',
  )
  // But once actually seen consumed, it settles.
  assert.equal(
    resolveHold({ status: 'active', expired: true, neverExpires: true, nonceConsumed: true }),
    'consumed',
  )
})

test('terminal states are never re-decided', () => {
  for (const status of ['consumed', 'released'] as const) {
    for (const nonceConsumed of [true, false, undefined] as const) {
      assert.equal(resolveHold({ status, expired: true, neverExpires: false, nonceConsumed }), status)
    }
  }
})

// ── sumHeldUsd + synthStatus: windowed cumulative counter ───────────────────

const NOW = 1_700_000_000_000
const DAY = 24 * 60 * 60 * 1000

test('synthStatus: a zeroed amount is the released tombstone', () => {
  assert.equal(synthStatus(0, NOW + 1000, NOW), 'released')
  assert.equal(synthStatus(-1, NOW - 1000, NOW), 'released')
})

test('synthStatus: charged + inside window = active, past window = consumed', () => {
  assert.equal(synthStatus(500, NOW + 60_000, NOW), 'active')
  assert.equal(synthStatus(500, NOW - 60_000, NOW), 'consumed')
})

test('synthStatus round-trips into sumHeldUsd (only released drops out)', () => {
  const raw = [
    { amountUsd: 300, expiresAtMs: NOW + 60_000 }, // active
    { amountUsd: 400, expiresAtMs: NOW - 60_000 }, // consumed
    { amountUsd: 900, expiresAtMs: NOW - 60_000 }, // released (zeroed by resolver)
  ]
  const rows: HeldRow[] = raw.map((r) => ({
    amountUsd: r.amountUsd,
    status: synthStatus(r.amountUsd, r.expiresAtMs, NOW),
    createdAtMs: NOW - 30_000,
  }))
  rows[2] = { amountUsd: 0, status: synthStatus(0, raw[2].expiresAtMs, NOW), createdAtMs: NOW - 30_000 }
  assert.equal(sumHeldUsd(rows, NOW, null), 700)
})

test('lifetime sum counts active + consumed, excludes released', () => {
  const rows: HeldRow[] = [
    { amountUsd: 400, status: 'active', createdAtMs: NOW - DAY * 10 },
    { amountUsd: 500, status: 'consumed', createdAtMs: NOW - DAY * 40 },
    { amountUsd: 999, status: 'released', createdAtMs: NOW - DAY * 2 },
  ]
  assert.equal(sumHeldUsd(rows, NOW, null), 900)
})

test('rolling window excludes holds older than the window (by server-set createdAt)', () => {
  const rows: HeldRow[] = [
    { amountUsd: 100, status: 'consumed', createdAtMs: NOW - DAY / 2 }, // in window
    { amountUsd: 200, status: 'active', createdAtMs: NOW - DAY * 2 }, // aged out
  ]
  assert.equal(sumHeldUsd(rows, NOW, DAY), 100)
  assert.equal(sumHeldUsd(rows, NOW, null), 300) // lifetime still counts both
})

test('SECURITY: deposit-then-never-report cannot lower the cumulative count', () => {
  // The attacker deposits (nonce consumed on-chain) and never writes a deposit
  // row. The hold — created at signing, valued at its signed ceiling — is what the
  // cap reads, so the volume is counted regardless of any client-side reporting.
  const signedCeilingUsd = 1000
  const holdAfterConsumption: HeldRow = {
    amountUsd: signedCeilingUsd,
    status: resolveHold({ status: 'active', expired: true, neverExpires: false, nonceConsumed: true }),
    createdAtMs: NOW - 60_000,
  }
  assert.equal(holdAfterConsumption.status, 'consumed')
  assert.equal(sumHeldUsd([holdAfterConsumption], NOW, null), 1000)
})

test('SECURITY: an abandoned hold frees the budget, a used one does not', () => {
  const used = resolveHold({ status: 'active', expired: true, neverExpires: false, nonceConsumed: true })
  const abandoned = resolveHold({ status: 'active', expired: true, neverExpires: false, nonceConsumed: false })
  const rows: HeldRow[] = [
    { amountUsd: 700, status: used, createdAtMs: NOW - 60_000 },
    { amountUsd: 700, status: abandoned, createdAtMs: NOW - 60_000 },
  ]
  // Only the used one still holds budget.
  assert.equal(sumHeldUsd(rows, NOW, null), 700)
})
