import { vi } from 'vitest'

/**
 * The three third-party services the attestation path calls, all through global
 * fetch. Everything else in the flow — SIWE verification, the JWT, the caps,
 * the signatures, the database — runs for real; only the network boundary is
 * replaced, and a request to an unexpected host fails the test loudly instead
 * of escaping to the internet.
 */
export interface UpstreamState {
  passportScore: number
  /** null → no sanctions hit. */
  sanctionsHit: boolean
  /** Force the sanctions vendor to look unreachable. */
  sanctionsDown: boolean
  cleanHandsUnique: boolean
  calls: { passport: number; sanctions: number; cleanHands: number }
}

export function installUpstreams(overrides: Partial<UpstreamState> = {}): UpstreamState {
  const realFetch = globalThis.fetch
  const state: UpstreamState = {
    passportScore: 30,
    sanctionsHit: false,
    sanctionsDown: false,
    cleanHandsUnique: true,
    calls: { passport: 0, sanctions: 0, cleanHands: 0 },
    ...overrides,
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

      // barretenberg pulls its structured reference string on the first Grumpkin
      // operation, then caches it under ~/.bb-crs. Stubbing it out would mean
      // never running the L2 Schnorr signing the Aztec bridge contract verifies.
      if (url.includes('crs.aztec-labs.com')) return realFetch(input, init)

      if (url.includes('api.passport.xyz')) {
        state.calls.passport++
        return json({ score: String(state.passportScore) })
      }

      if (url.includes('sanctions.io')) {
        state.calls.sanctions++
        if (state.sanctionsDown) throw new Error('ECONNRESET')
        return json({ count: state.sanctionsHit ? 1 : 0, results: state.sanctionsHit ? [{ name: 'hit' }] : [] })
      }

      if (url.includes('api.holonym.io')) {
        state.calls.cleanHands++
        return json({ isUnique: state.cleanHandsUnique })
      }

      throw new Error(`e2e: unexpected outbound request to ${url}`)
    }),
  )

  return state
}
