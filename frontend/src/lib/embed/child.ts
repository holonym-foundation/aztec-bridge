'use client'

import { APP_VERSION } from '@/config/env.config'
import { getEmbedContext } from './mode'
import {
  EMBED_PROTOCOL_VERSION,
  envelope,
  isEmbedEnvelope,
  type EmbedInboundMessage,
  type EmbedOutboundMessage,
} from './protocol'

type InboundHandler = (message: EmbedInboundMessage) => void

const handlers = new Set<InboundHandler>()
let listening = false

/**
 * Post an event to the partner page. No-op outside embed mode, and never
 * targets '*' — a wildcard would leak wallet addresses and tx hashes to any
 * document that happens to be the opener.
 */
export function emitToParent(message: EmbedOutboundMessage): void {
  const { isEmbedded, parentOrigin } = getEmbedContext()
  if (!isEmbedded || !parentOrigin) return
  if (typeof window === 'undefined' || window.parent === window) return
  window.parent.postMessage(envelope(message), parentOrigin)
}

export function emitReady(): void {
  emitToParent({ type: 'ready', protocol: EMBED_PROTOCOL_VERSION, version: APP_VERSION })
}

export function onParentMessage(handler: InboundHandler): () => void {
  handlers.add(handler)
  startListening()
  return () => handlers.delete(handler)
}

// This data crosses an origin boundary, so each message is narrowed by its own
// shape rather than asserted into the union — origin checks prove who sent it,
// not that the payload is well-formed.
function parseInbound(data: { type: string } & Record<string, unknown>): EmbedInboundMessage | null {
  if (data.type === 'navigate' && typeof data.route === 'string') {
    return { type: 'navigate', route: data.route }
  }
  return null
}

function startListening(): void {
  if (listening || typeof window === 'undefined') return
  const { isEmbedded, parentOrigin } = getEmbedContext()
  if (!isEmbedded || !parentOrigin) return

  listening = true
  window.addEventListener('message', (event) => {
    // The WaaP wallet iframe also postMessages into this window, so every guard
    // here is load-bearing, not defensive boilerplate.
    if (event.origin !== parentOrigin) return
    if (event.source !== window.parent) return
    if (!isEmbedEnvelope(event.data)) return
    const message = parseInbound(event.data)
    if (!message) return
    for (const handler of handlers) handler(message)
  })
}
