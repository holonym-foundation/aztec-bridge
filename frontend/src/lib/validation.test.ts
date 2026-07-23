/**
 * The caller controls what it puts in `x-forwarded-for`, so which end of the
 * list is read decides whether the rate limit and the audit trail mean anything.
 *
 *   npx tsx src/lib/validation.test.ts
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { getClientIp, MAX_CLIENT_IP_LENGTH } from './validation'

const h = (init: Record<string, string>) => new Headers(init)

test('a forged leading entry does not become the caller identity', () => {
  // The proxy appends the real peer, so the caller's own value stays on the left.
  const ip = getClientIp(h({ 'x-forwarded-for': '10.0.0.1, 203.0.113.7' }))
  assert.equal(ip, '203.0.113.7')
})

test('a single-entry list is the peer itself', () => {
  assert.equal(getClientIp(h({ 'x-forwarded-for': '203.0.113.7' })), '203.0.113.7')
})

test('spacing in the list is not part of the identity', () => {
  assert.equal(getClientIp(h({ 'x-forwarded-for': '10.0.0.1,203.0.113.7  ' })), '203.0.113.7')
})

test('x-real-ip is used only when no list was set', () => {
  assert.equal(getClientIp(h({ 'x-real-ip': '198.51.100.4' })), '198.51.100.4')
  assert.equal(getClientIp(h({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '198.51.100.4' })), '203.0.113.7')
})

test('an oversized value is dropped rather than stored', () => {
  assert.equal(getClientIp(h({ 'x-forwarded-for': 'a'.repeat(MAX_CLIENT_IP_LENGTH + 1) })), undefined)
})

test('an IPv6 address at the length limit still passes', () => {
  const v6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334:255.255.255.255'.slice(0, MAX_CLIENT_IP_LENGTH)
  assert.equal(getClientIp(h({ 'x-forwarded-for': v6 })), v6)
})

test('no headers at all yields no identity', () => {
  assert.equal(getClientIp(h({})), undefined)
  assert.equal(getClientIp(h({ 'x-forwarded-for': '   ' })), undefined)
})

test('reading the left-most entry — what the old sites did — takes the forged value', () => {
  const forged = '10.0.0.1, 203.0.113.7'.split(',')[0]?.trim()
  assert.equal(forged, '10.0.0.1')
  assert.notEqual(forged, getClientIp(h({ 'x-forwarded-for': '10.0.0.1, 203.0.113.7' })))
})
