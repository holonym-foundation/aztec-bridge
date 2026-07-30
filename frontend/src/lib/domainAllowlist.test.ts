import { beforeEach, describe, expect, it, vi } from 'vitest'

const { env } = vi.hoisted(() => ({ env: { AUTH_EXPECTED_DOMAIN: '' } }))

// Only AUTH_EXPECTED_DOMAIN is under test. Spread the real module for the rest:
// domainAllowlist now resolves the deployment's own network, so its module graph
// pulls in `@/config`, which reads a dozen other env exports at import time — a
// hand-listed mock would break again the next time one is added.
vi.mock('@/config/env.config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/env.config')>()),
  get AUTH_EXPECTED_DOMAIN() {
    return env.AUTH_EXPECTED_DOMAIN
  },
}))

import { getAllowedAppHosts, getAllowedAppOrigins, isAllowedAppOrigin, normalizeAppOrigin } from './domainAllowlist'

beforeEach(() => {
  env.AUTH_EXPECTED_DOMAIN = ''
})

describe('getAllowedAppHosts', () => {
  it('always includes the production and testnet hosts', () => {
    expect(getAllowedAppHosts()).toEqual(new Set(['shield.human.tech', 'testnet.shield.human.tech']))
  })

  it('adds every configured domain, stripping scheme and trailing slash', () => {
    env.AUTH_EXPECTED_DOMAIN = 'https://preview.shield.human.tech/, localhost:3000'

    expect(getAllowedAppHosts()).toContain('preview.shield.human.tech')
    expect(getAllowedAppHosts()).toContain('localhost:3000')
  })

  it('ignores empty segments from a trailing or doubled comma', () => {
    env.AUTH_EXPECTED_DOMAIN = 'a.example,, '

    expect(getAllowedAppHosts()).toEqual(new Set(['shield.human.tech', 'testnet.shield.human.tech', 'a.example']))
  })
})

describe('isAllowedAppOrigin', () => {
  it('accepts an allowed origin with or without a trailing slash', () => {
    expect(isAllowedAppOrigin('https://shield.human.tech')).toBe(true)
    expect(isAllowedAppOrigin('https://shield.human.tech/')).toBe(true)
  })

  it('rejects http, a subdomain, and a lookalike host', () => {
    for (const origin of [
      'http://shield.human.tech',
      'https://evil.shield.human.tech',
      'https://shield.human.tech.evil.example',
      'https://shieldhuman.tech',
    ]) {
      expect(isAllowedAppOrigin(origin)).toBe(false)
    }
  })

  it('rejects an origin carrying a path, so a match cannot be smuggled in one', () => {
    expect(isAllowedAppOrigin('https://evil.example/https://shield.human.tech')).toBe(false)
  })

  it('always derives origins over https, even for a plain-host config entry', () => {
    env.AUTH_EXPECTED_DOMAIN = 'preview.shield.human.tech'

    expect(getAllowedAppOrigins()).toContain('https://preview.shield.human.tech')
    expect(isAllowedAppOrigin('http://preview.shield.human.tech')).toBe(false)
  })
})

describe('normalizeAppOrigin', () => {
  it('drops trailing slashes only', () => {
    expect(normalizeAppOrigin('https://shield.human.tech///')).toBe('https://shield.human.tech')
    expect(normalizeAppOrigin('https://shield.human.tech')).toBe('https://shield.human.tech')
  })
})
