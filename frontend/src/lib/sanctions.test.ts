import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { env } = vi.hoisted(() => ({
  env: {
    SANCTIONS_SCREENING_ENABLED: true,
    SANCTIONS_IO_API_KEY: 'test-key',
    SANCTIONS_IO_API_URL: 'https://api.sanctions.io/search/',
    SANCTIONS_IO_API_VERSION: '2.4',
    SANCTIONS_IO_MIN_SCORE: '0.95',
  },
}))

vi.mock('@/config/env.config', () => ({
  get SANCTIONS_SCREENING_ENABLED() {
    return env.SANCTIONS_SCREENING_ENABLED
  },
  get SANCTIONS_IO_API_KEY() {
    return env.SANCTIONS_IO_API_KEY
  },
  get SANCTIONS_IO_API_URL() {
    return env.SANCTIONS_IO_API_URL
  },
  get SANCTIONS_IO_API_VERSION() {
    return env.SANCTIONS_IO_API_VERSION
  },
  get SANCTIONS_IO_MIN_SCORE() {
    return env.SANCTIONS_IO_MIN_SCORE
  },
}))

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

// The module-level cache is keyed by address, so every test needs a fresh one.
let addressCounter = 0
const freshAddress = () => `0x${(++addressCounter).toString(16).padStart(40, '0')}`

let screenAddress: typeof import('./sanctions')['screenAddress']
let SanctionsScreeningUnavailableError: typeof import('./sanctions')['SanctionsScreeningUnavailableError']

beforeEach(async () => {
  env.SANCTIONS_SCREENING_ENABLED = true
  env.SANCTIONS_IO_API_KEY = 'test-key'
  vi.stubGlobal('fetch', vi.fn())
  ;({ screenAddress, SanctionsScreeningUnavailableError } = await import('./sanctions'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('screenAddress', () => {
  it('clears an address with no hits', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ count: 0, results: [] }))

    expect(await screenAddress(freshAddress())).toEqual({ clear: true })
  })

  it('blocks an address with a hit without leaking the vendor payload', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ count: 1, results: [{ name: 'SDN entry' }] }))

    const result = await screenAddress(freshAddress())

    expect(result.clear).toBe(false)
    expect(result.reason).not.toContain('SDN entry')
  })

  it('sends the address as the identifier, with the configured score and key', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ results: [] }))
    const address = freshAddress()

    await screenAddress(address)

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [URL, RequestInit]
    expect(url.searchParams.get('identifier')).toBe(address)
    expect(url.searchParams.get('min_score')).toBe('0.95')
    expect(url.searchParams.get('data_source')).toContain('OFAC-COMPREHENSIVE')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
  })

  it('fails closed when the vendor is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNRESET'))

    await expect(screenAddress(freshAddress())).rejects.toBeInstanceOf(SanctionsScreeningUnavailableError)
  })

  it('fails closed on a non-2xx response rather than clearing the address', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('rate limited', { status: 429, statusText: 'Too Many Requests' }))

    await expect(screenAddress(freshAddress())).rejects.toBeInstanceOf(SanctionsScreeningUnavailableError)
  })

  it('fails closed when the API key is missing instead of silently skipping', async () => {
    env.SANCTIONS_IO_API_KEY = ''

    await expect(screenAddress(freshAddress())).rejects.toBeInstanceOf(SanctionsScreeningUnavailableError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('short-circuits to clear when screening is switched off', async () => {
    env.SANCTIONS_SCREENING_ENABLED = false
    env.SANCTIONS_IO_API_KEY = ''

    expect(await screenAddress(freshAddress())).toEqual({ clear: true })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('serves the same address from cache within the TTL', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ results: [] }))
    const address = freshAddress()

    await screenAddress(address)
    await screenAddress(address.toUpperCase().replace('0X', '0x'))

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failure, so a vendor outage cannot poison later checks', async () => {
    const address = freshAddress()
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNRESET'))
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ results: [] }))

    await expect(screenAddress(address)).rejects.toBeInstanceOf(SanctionsScreeningUnavailableError)
    expect(await screenAddress(address)).toEqual({ clear: true })
  })

  it('treats a malformed results field as no hit rather than crashing', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ count: 3, results: null }))

    expect(await screenAddress(freshAddress())).toEqual({ clear: true })
  })
})
