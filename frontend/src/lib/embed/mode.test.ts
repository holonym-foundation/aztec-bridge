// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { hasOpenInAppOverlay, parseEmbedAmount, resolveEmbedRoute } from './mode'

const ORIGIN = 'https://shield.human.tech'

describe('resolveEmbedRoute', () => {
  it('accepts same-app paths', () => {
    expect(resolveEmbedRoute('/activity', ORIGIN)).toBe('/activity')
    expect(resolveEmbedRoute('/progress?id=1#top', ORIGIN)).toBe('/progress?id=1#top')
    expect(resolveEmbedRoute(`${ORIGIN}/activity`, ORIGIN)).toBe('/activity')
  })

  it('rejects protocol-relative and backslash escapes', () => {
    expect(resolveEmbedRoute('//evil.com', ORIGIN)).toBeNull()
    expect(resolveEmbedRoute('/\\evil.com', ORIGIN)).toBeNull()
    expect(resolveEmbedRoute('\\/evil.com', ORIGIN)).toBeNull()
    expect(resolveEmbedRoute('/\\\\evil.com', ORIGIN)).toBeNull()
  })

  it('rejects other origins and schemes', () => {
    expect(resolveEmbedRoute('https://evil.com/activity', ORIGIN)).toBeNull()
    expect(resolveEmbedRoute('javascript:alert(1)', ORIGIN)).toBeNull()
    expect(resolveEmbedRoute('data:text/html,x', ORIGIN)).toBeNull()
  })
})

describe('hasOpenInAppOverlay', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('is false when nothing is open, so Escape reaches the host', () => {
    document.body.innerHTML = '<main><button>Bridge</button></main>'
    expect(hasOpenInAppOverlay()).toBe(false)
  })

  it('is false for a drawer being hover-previewed', () => {
    // The pinned-only role is the whole point: a hover preview has no Escape
    // handler, so it must not suppress forwarding.
    document.body.innerHTML = '<div id="panel">Messages</div>'
    expect(hasOpenInAppOverlay()).toBe(false)
  })

  it('is true for a pinned drawer, which consumes Escape itself', () => {
    document.body.innerHTML = '<div id="panel" role="dialog" aria-label="Messages">Messages</div>'
    expect(hasOpenInAppOverlay()).toBe(true)
  })

  it('covers menus, modals and panels that declare the contract explicitly', () => {
    for (const markup of [
      '<div role="menu">Ecosystem</div>',
      '<div role="dialog" aria-modal="true">Recover</div>',
      '<div data-esc-closes>Deployment</div>',
      '<dialog open>Native</dialog>',
    ]) {
      document.body.innerHTML = markup
      expect(hasOpenInAppOverlay(), markup).toBe(true)
    }
  })
})

describe('parseEmbedAmount', () => {
  it('accepts positive decimals', () => {
    expect(parseEmbedAmount('100')).toBe('100')
    expect(parseEmbedAmount('0.5')).toBe('0.5')
    expect(parseEmbedAmount('.5')).toBe('.5')
  })

  it('rejects everything isNaN() let through', () => {
    for (const bad of ['-5', 'Infinity', '0x10', '1e3', '', '0', '0.0', ' 1 ', 'abc', '1.2.3']) {
      expect(parseEmbedAmount(bad)).toBeUndefined()
    }
    expect(parseEmbedAmount(null)).toBeUndefined()
    expect(parseEmbedAmount(undefined)).toBeUndefined()
  })
})
