import { describe, expect, it, vi } from 'vitest'

async function withOrigins(value: string) {
  vi.resetModules()
  vi.doMock('@/config/env.config', () => ({ EMBED_ALLOWED_ORIGINS: value }))
  return import('./embedAllowlist')
}

describe('getFrameAncestors', () => {
  it("is 'self' only when no partners are configured", async () => {
    const { getFrameAncestors } = await withOrigins('')
    expect(getFrameAncestors()).toBe("'self'")
  })

  it('appends parsed origins and drops paths, dupes and bad schemes', async () => {
    const { getFrameAncestors } = await withOrigins(
      'https://a.example/some/path, https://a.example, javascript:alert(1), bare.host, , http://localhost:8080',
    )
    expect(getFrameAncestors()).toBe("'self' https://a.example http://localhost:8080")
  })
})

describe('getPermissionsPolicy', () => {
  it('delegates to the nested wallets, not to partners', async () => {
    const { getPermissionsPolicy } = await withOrigins('https://partner.example')
    const policy = getPermissionsPolicy()
    expect(policy).toContain('storage-access=(self "https://waap.xyz" "https://staging-waap.xyz")')
    expect(policy).toContain('camera=()')
    expect(policy).not.toContain('partner.example')
  })
})
