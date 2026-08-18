'use client'

import { EMBED_PARAMS, type EmbedDefaults } from './protocol'

export type EmbedContext = {
  isEmbedded: boolean
  parentOrigin: string | null
  partnerId: string | null
  defaults: EmbedDefaults
}

const NOT_EMBEDDED: EmbedContext = {
  isEmbedded: false,
  parentOrigin: null,
  partnerId: null,
  defaults: {},
}

// In-app navigation is router.push, which drops the loader's query string, so
// the params are resolved once on first load and cached. sessionStorage carries
// them across a hard refresh deep in the flow (e.g. /progress), and is scoped to
// the frame — in a third-party context the browser partitions it per top-level
// site, which is the isolation we want anyway.
const SESSION_KEY = 'shield-embed-context'

let cached: EmbedContext | null = null

function parseParentOrigin(raw: string | null): string | null {
  if (!raw) return null
  try {
    const { origin, protocol } = new URL(raw)
    return protocol === 'https:' || protocol === 'http:' ? origin : null
  } catch {
    return null
  }
}

/**
 * A partner-supplied amount, or undefined. Deliberately stricter than `Number()`:
 * the value lands in the bridge form straight off a URL parameter, and `-5`,
 * `Infinity`, `1e3` and `0x10` all survive an `isNaN` check.
 */
export function parseEmbedAmount(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  if (!/^\d*\.?\d+$/.test(raw)) return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? raw : undefined
}

/**
 * Resolve a host-supplied `navigate` route to a same-origin path, or null.
 *
 * String prefix checks are not enough: `/\evil.com` starts with a single '/'
 * yet URL parsing normalises the backslash, making it protocol-relative. Only
 * the parsed origin can decide, so parse and compare.
 */
export function resolveEmbedRoute(route: string, origin: string): string | null {
  try {
    const url = new URL(route, origin)
    if (url.origin !== new URL(origin).origin) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

/**
 * Anything open that consumes Escape itself.
 *
 * Roles carry most of it: every menu and dialog in the app is conditionally
 * rendered, so matching one means it is open. `data-esc-closes` covers the rest —
 * panels that close on Escape but are neither a menu nor a dialog, where
 * borrowing a role to be found here would misreport them to a screen reader.
 * Any new overlay with its own Escape handler must match one of these.
 */
const IN_APP_OVERLAY_SELECTOR =
  '[role="dialog"], [role="menu"], [aria-modal="true"], dialog[open], [data-esc-closes]'

/**
 * Whether Shield has something of its own to close. Escape is forwarded to the
 * host only when this is false, so one keypress never both closes an in-app
 * panel and tears the widget down behind it.
 */
export function hasOpenInAppOverlay(root: ParentNode = document): boolean {
  return root.querySelector(IN_APP_OVERLAY_SELECTOR) !== null
}

function readFromUrl(): EmbedContext | null {
  const params = new URLSearchParams(window.location.search)
  if (params.get(EMBED_PARAMS.enabled) !== '1') return null
  // Both signals required. The param alone would let a shared link put a normal
  // top-level tab into the stripped-down widget UI for the rest of the session;
  // being framed alone would silently restyle the app for anyone who framed us.
  if (window.self === window.top) return null

  const parentOrigin = parseParentOrigin(params.get(EMBED_PARAMS.parentOrigin))
  if (!parentOrigin) {
    // Chrome is stripped but every emitToParent will be dropped, so the widget
    // looks embedded and reports nothing. Say so once rather than fail silently.
    console.warn('[shield-embed] embed=1 without a valid parentOrigin — no events will reach the host page')
  }

  return {
    isEmbedded: true,
    // No allowlist check here: CSP frame-ancestors already guarantees only an
    // approved partner can frame us at all. A partner that lies about its origin
    // only breaks its own channel — postMessage targetOrigin won't match its
    // window, so nothing is delivered in either direction.
    parentOrigin,
    partnerId: params.get(EMBED_PARAMS.partner),
    defaults: {
      token: params.get(EMBED_PARAMS.token) ?? undefined,
      amount: parseEmbedAmount(params.get(EMBED_PARAMS.amount)),
    },
  }
}

function readFromSession(): EmbedContext | null {
  // Re-tests the framing signal: readFromUrl requires both `embed=1` AND being
  // framed, and a restored entry has to clear the same bar. Otherwise a session
  // that started framed puts a later top-level tab into the widget chrome.
  if (window.self === window.top) return null
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Partial<EmbedContext>
    if (stored?.isEmbedded !== true) return null
    return {
      isEmbedded: true,
      parentOrigin: parseParentOrigin(stored.parentOrigin ?? null),
      partnerId: typeof stored.partnerId === 'string' ? stored.partnerId : null,
      defaults: {
        token: typeof stored.defaults?.token === 'string' ? stored.defaults.token : undefined,
        amount: parseEmbedAmount(stored.defaults?.amount),
      },
    }
  } catch {
    return null
  }
}

export function getEmbedContext(): EmbedContext {
  if (cached) return cached
  if (typeof window === 'undefined') return NOT_EMBEDDED

  const fromUrl = readFromUrl()
  if (fromUrl) {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(fromUrl))
    } catch {
      // storage blocked entirely — embed mode still works for this page load.
    }
    cached = fromUrl
    return cached
  }

  cached = readFromSession() ?? NOT_EMBEDDED
  return cached
}

export function useIsEmbedded(): boolean {
  return getEmbedContext().isEmbedded
}
