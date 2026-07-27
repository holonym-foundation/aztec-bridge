import { beforeEach, describe, expect, it } from 'vitest'

import { GET as nonceRoute } from '@/app/api/auth/nonce/route'
import { POST as authenticateRoute } from '@/app/api/auth/authenticate/route'
import { GET as verifyRoute } from '@/app/api/auth/verify/route'

import { db, resetDb } from './helpers/db'
import { call } from './helpers/request'
import { aztecAddress, fetchNonce, login, signSiwe, wallet } from './helpers/session'
import { E2E_ENV, E2E_ORIGIN } from './helpers/env'

const authenticate = (body: unknown) => call(authenticateRoute, '/api/auth/authenticate', { method: 'POST', body })

beforeEach(resetDb)

describe('sign-in', () => {
  it('issues a session for a correctly signed SIWE message', async () => {
    const session = await login(1)

    expect(session.token).toBeTruthy()
    expect(session.l1Address).toBe(wallet(1).address.toLowerCase())
    expect(session.l2Address).toBe(aztecAddress(1))

    const stored = await db.user.findUnique({ where: { id: session.userId } })
    expect(stored?.l1LoginMethod).toBe('injected')
    expect(stored?.lastLoginAt).toBeInstanceOf(Date)
  })

  it('accepts the issued token on a protected route', async () => {
    const session = await login(1)

    const result = await call(verifyRoute, '/api/auth/verify', { token: session.token })

    expect(result.status).toBe(200)
    expect(result.body.valid).toBe(true)
    expect(result.body.user.id).toBe(session.userId)
  })

  it('returns the same user for a second login with the same address pair', async () => {
    const first = await login(1)
    const second = await login(1)

    expect(second.userId).toBe(first.userId)
    expect(await db.user.count()).toBe(1)
  })

  it('treats a different L2 address as a different identity', async () => {
    const first = await login(1)

    const nonce = await fetchNonce()
    const otherL2 = aztecAddress(999)
    const { message, signature } = await signSiwe(wallet(1), otherL2, nonce)
    const result = await authenticate({ message, signature })

    expect(result.status).toBe(200)
    expect(result.body.user.id).not.toBe(first.userId)
    expect(await db.user.count()).toBe(2)
  })
})

describe('nonce handling', () => {
  it('issues a distinct nonce per request and persists it', async () => {
    const a = await fetchNonce()
    const b = await fetchNonce()

    expect(a).not.toBe(b)
    expect(await db.authNonce.count()).toBe(2)
  })

  it('consumes the nonce, so a replay of the same signed message fails', async () => {
    const nonce = await fetchNonce()
    const { message, signature } = await signSiwe(wallet(1), aztecAddress(1), nonce)

    expect((await authenticate({ message, signature })).status).toBe(200)

    const replay = await authenticate({ message, signature })
    expect(replay.status).toBe(401)
    expect(replay.body.error).toMatch(/nonce/i)
  })

  it('rejects a nonce the server never issued', async () => {
    const { message, signature } = await signSiwe(wallet(1), aztecAddress(1), 'ffffffffffffffff')

    const result = await authenticate({ message, signature })

    expect(result.status).toBe(401)
    expect(await db.user.count()).toBe(0)
  })

  it('rejects an expired nonce and still burns it', async () => {
    const nonce = await fetchNonce()
    await db.authNonce.update({ where: { nonce }, data: { expiresAt: new Date(Date.now() - 1000) } })
    const { message, signature } = await signSiwe(wallet(1), aztecAddress(1), nonce)

    expect((await authenticate({ message, signature })).status).toBe(401)
    expect(await db.authNonce.findUnique({ where: { nonce } })).toBeNull()
  })

  it('does not burn the nonce when the signature is invalid', async () => {
    // Otherwise anyone could spend a victim's nonce with a junk signature.
    const nonce = await fetchNonce()
    const signed = await signSiwe(wallet(1), aztecAddress(1), nonce)

    const bad = await authenticate({ message: signed.message, signature: `0x${'11'.repeat(65)}` })
    expect(bad.status).toBe(401)

    expect((await authenticate(signed)).status).toBe(200)
  })
})

describe('signature and message binding', () => {
  it('rejects a signature from a different wallet', async () => {
    const nonce = await fetchNonce()
    const { message } = await signSiwe(wallet(1), aztecAddress(1), nonce)
    const { signature } = await signSiwe(wallet(2), aztecAddress(1), nonce)

    const result = await authenticate({ message, signature })

    expect(result.status).toBe(401)
    expect(await db.user.count()).toBe(0)
  })

  it('rejects a message signed for another domain', async () => {
    const nonce = await fetchNonce()
    const { message, signature } = await signSiwe(wallet(1), aztecAddress(1), nonce, { domain: 'evil.example' })

    const result = await authenticate({ message, signature })

    expect(result.status).toBe(401)
    expect(result.body.error).toMatch(/domain/i)
  })

  it('accepts the deployment domain configured in AUTH_EXPECTED_DOMAIN', async () => {
    const nonce = await fetchNonce()
    const { message, signature } = await signSiwe(wallet(1), aztecAddress(1), nonce, {
      domain: E2E_ENV.AUTH_EXPECTED_DOMAIN,
    })

    expect((await authenticate({ message, signature })).status).toBe(200)
  })

  it('rejects an expired SIWE message', async () => {
    const nonce = await fetchNonce()
    const { message, signature } = await signSiwe(wallet(1), aztecAddress(1), nonce, {
      issuedAt: new Date(Date.now() - 20_000).toISOString(),
      expirationTime: new Date(Date.now() - 10_000).toISOString(),
    })

    const result = await authenticate({ message, signature })

    expect(result.status).toBe(401)
  })
})

describe('L2 address binding in the signed message', () => {
  it('rejects a message with no aztec resource', async () => {
    const nonce = await fetchNonce()
    const { message, signature } = await signSiwe(wallet(1), aztecAddress(1), nonce, { resources: [] })

    const result = await authenticate({ message, signature })

    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/L2 address/i)
  })

  it('ignores an aztec resource hosted on an origin the app does not own', async () => {
    // The resource is what binds the L2 address to the signature; accepting an
    // arbitrary origin would let a hostile dapp bind whatever address it liked.
    const nonce = await fetchNonce()
    const { message, signature } = await signSiwe(wallet(1), aztecAddress(1), nonce, {
      resources: [`https://evil.example/aztec/address/${aztecAddress(1)}`],
    })

    const result = await authenticate({ message, signature })

    expect(result.status).toBe(400)
  })

  it('rejects a malformed aztec address in the resource', async () => {
    const nonce = await fetchNonce()
    const { message, signature } = await signSiwe(wallet(1), aztecAddress(1), nonce, {
      resources: [`${E2E_ORIGIN}/aztec/address/0xdeadbeef`],
    })

    expect((await authenticate({ message, signature })).status).toBe(400)
  })

  it('takes the first valid aztec resource when several are present', async () => {
    const nonce = await fetchNonce()
    const { message, signature } = await signSiwe(wallet(1), aztecAddress(1), nonce, {
      resources: [
        `https://evil.example/aztec/address/${aztecAddress(7)}`,
        `${E2E_ORIGIN}/aztec/address/${aztecAddress(1)}`,
      ],
    })

    const result = await authenticate({ message, signature })

    expect(result.status).toBe(200)
    expect(result.body.user.l2Address).toBe(aztecAddress(1))
  })
})

describe('request validation', () => {
  it('rejects a body that is not a SIWE payload', async () => {
    expect((await authenticate({})).status).toBe(400)
    expect((await authenticate({ message: 'x' })).status).toBe(400)
  })

  it('rejects an oversized message before parsing it', async () => {
    const result = await authenticate({ message: 'a'.repeat(4096), signature: `0x${'11'.repeat(65)}` })

    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/message/i)
  })

  it('rejects a message that is not valid SIWE at all', async () => {
    const result = await authenticate({ message: 'hello world', signature: `0x${'11'.repeat(65)}` })

    expect(result.status).toBe(400)
  })
})

describe('session verification', () => {
  it('reports no_token when the header is missing', async () => {
    const result = await call(verifyRoute, '/api/auth/verify')

    expect(result.status).toBe(401)
    expect(result.body.reason).toBe('no_token')
  })

  it('reports token_expired for a forged token', async () => {
    const result = await call(verifyRoute, '/api/auth/verify', { token: 'not.a.jwt' })

    expect(result.status).toBe(401)
    expect(result.body.valid).toBe(false)
  })

  it('stops honouring a valid token once the user row is gone', async () => {
    const session = await login(1)
    await db.user.delete({ where: { id: session.userId } })

    const result = await call(verifyRoute, '/api/auth/verify', { token: session.token })

    expect(result.status).toBe(401)
    expect(result.body.reason).toBe('user_not_found')
  })
})

describe('nonce rate limit', () => {
  it('stops issuing nonces to one IP past the per-minute budget', async () => {
    const ip = '203.0.113.7'
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      const result = await call(nonceRoute, '/api/auth/nonce', { headers: { 'x-forwarded-for': ip } })
      statuses.push(result.status)
    }

    expect(statuses.filter((s) => s === 200).length).toBe(10)
    expect(statuses.filter((s) => s === 429).length).toBe(2)
  })
})
