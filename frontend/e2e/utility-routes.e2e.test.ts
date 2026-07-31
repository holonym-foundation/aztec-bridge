import { beforeEach, describe, expect, it } from 'vitest'

import { POST as faucetRoute } from '@/app/api/faucet/route'
import { POST as mintTokensRoute } from '@/app/api/mint-tokens/route'
import { GET as pointsRoute } from '@/app/api/points/route'
import { POST as nftsRoute } from '@/app/api/alchemy/nfts/route'
import { POST as tokenBalancesRoute } from '@/app/api/alchemy/tokens-balances/route'

import { resetDb } from './helpers/db'
import { call } from './helpers/request'
import { login, wallet } from './helpers/session'
import { installUpstreams, type UpstreamState } from './helpers/upstreams'

const SOMEONE = '0x00000000000000000000000000000000000000aa'

let upstreams: UpstreamState
let actor = 2000

beforeEach(async () => {
  actor++
  await resetDb()
  upstreams = installUpstreams()
})

describe('the faucet', () => {
  it('stays switched off', async () => {
    // It signs with the faucet key, is unauthenticated, and has no server-side
    // rate limit — the early return is the only thing standing between it and a
    // drained hot wallet.
    const result = await call(faucetRoute, '/api/faucet', {
      method: 'POST',
      body: { address: SOMEONE },
    })

    expect(result.status).toBe(503)
  })

  it('stays off for a caller holding a valid session', async () => {
    const session = await login(actor)

    const result = await call(faucetRoute, '/api/faucet', {
      method: 'POST',
      token: session.token,
      body: { address: SOMEONE },
    })

    expect(result.status).toBe(503)
  })
})

describe('minting test tokens', () => {
  const mint = (body: unknown, token?: string) =>
    call(mintTokensRoute, '/api/mint-tokens', { method: 'POST', body, ...(token ? { token } : {}) })

  it('refuses without a session', async () => {
    const result = await mint({ address: SOMEONE, tokenAddress: SOMEONE })

    expect(result.status).toBe(401)
  })

  it('refuses a recipient that is not an address', async () => {
    const session = await login(actor)

    const result = await mint({ address: 'me', tokenAddress: SOMEONE }, session.token)

    expect(result.status).toBe(400)
  })

  it('refuses a token contract it does not know', async () => {
    // The route calls `mint` on whatever contract it is handed, with the faucet
    // key. The allowlist is what keeps that from being an arbitrary write.
    const session = await login(actor)

    const result = await mint({ address: SOMEONE, tokenAddress: SOMEONE }, session.token)

    expect(result.status).toBe(400)
    expect(result.body.error).toContain('not a recognized deployed token')
  })

  it('refuses when the token address is missing entirely', async () => {
    const session = await login(actor)

    const result = await mint({ address: SOMEONE }, session.token)

    expect(result.status).toBe(400)
  })
})

describe('the HUMN points lookup', () => {
  const points = (address: string) => call(pointsRoute, '/api/points', { query: `address=${address}` })

  it('answers for any address, without a session', async () => {
    const result = await points(wallet(actor).address)

    expect(result.status).toBe(200)
    expect(result.body.totalPoints).toBe(250)
  })

  it('applies the multiplier to the raw total', async () => {
    upstreams.passportMultiplier = 2

    const { body } = await points(wallet(actor).address)

    expect(body.totalPoints).toBe(500)
  })

  it('rejects anything that is not an EVM address', async () => {
    const result = await points('0xnope')

    expect(result.status).toBe(400)
    expect(upstreams.calls.passport).toBe(0)
  })

  it('reports a bad gateway rather than zero points when Passport is down', async () => {
    // Returning 0 on an outage would read as "this human has no points".
    upstreams.passportDown = true

    const result = await points(wallet(actor).address)

    expect(result.status).toBe(502)
  })
})

/**
 * Only the keyless path is covered: these two proxy through axios rather than
 * global fetch, so the upstream stub the other suites rely on cannot intercept
 * them. What matters here is that a missing key degrades instead of failing.
 */
describe('the Alchemy display proxies', () => {
  const balances = (body: unknown) =>
    call(tokenBalancesRoute, '/api/alchemy/tokens-balances', { method: 'POST', body })
  const nfts = (body: unknown) => call(nftsRoute, '/api/alchemy/nfts', { method: 'POST', body })

  it('degrades to an empty list when no Alchemy key is configured', async () => {
    // Balances and NFTs are decoration; a missing key must not stop someone
    // connecting a wallet or bridging.
    const request = { chains: [1], address: wallet(actor).address }

    const balanceResult = await balances(request)
    const nftResult = await nfts(request)

    expect(balanceResult.status).toBe(200)
    expect(balanceResult.body).toEqual([])
    expect(nftResult.status).toBe(200)
    expect(nftResult.body).toEqual([])
  })
})
