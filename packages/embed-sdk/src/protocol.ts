/**
 * Wire format shared by the framed Shield app and this loader. Both halves
 * import from here, so the contract cannot drift between them.
 */

export const EMBED_PROTOCOL_VERSION = 1

/** Every message carries this so a partner page can ignore unrelated traffic. */
export const EMBED_CHANNEL = 'shield-embed'

// Deliberately no `theme` and no `recipient`. Shield's only light/dark-ish
// switch is Privacy Mode, which is a functional privacy setting rather than a
// colour scheme, so a theme option could not be honoured without lying; and the
// bridge always credits the connected L2 account, so there is no recipient to
// pre-set. Add them here when the app can actually act on them.
export type EmbedDefaults = {
  token?: string
  amount?: string
}

/** Sent by the framed app to the partner page. */
export type EmbedOutboundMessage =
  | { type: 'ready'; protocol: number; version: string }
  | { type: 'wallet:connected'; address: string; chainId: number }
  | { type: 'wallet:disconnected' }
  | { type: 'state'; route: string }
  | { type: 'tx:submitted'; hash: string; chain: 'l1' | 'l2' }
  | { type: 'bridge:success'; operationId: string; l1TxHash?: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'close' }
  | { type: 'support' }

/** Sent by the partner page to the framed app. */
export type EmbedInboundMessage = { type: 'navigate'; route: string }

export type EmbedEventType = EmbedOutboundMessage['type']

export type EmbedEnvelope<T> = T & { channel: typeof EMBED_CHANNEL; protocol: number }

export function envelope<T extends { type: string }>(message: T): EmbedEnvelope<T> {
  return { ...message, channel: EMBED_CHANNEL, protocol: EMBED_PROTOCOL_VERSION }
}

export function isEmbedEnvelope(data: unknown): data is EmbedEnvelope<{ type: string }> {
  if (typeof data !== 'object' || data === null) return false
  const record = data as Record<string, unknown>
  if (record.channel !== EMBED_CHANNEL) return false
  // A mismatched version is dropped rather than half-understood: a future loader
  // against an older app would otherwise silently deliver the messages whose
  // shape happens to still parse and lose the rest.
  if (record.protocol !== EMBED_PROTOCOL_VERSION) return false
  return typeof record.type === 'string'
}

/**
 * Query params the loader appends to the iframe src. Kept here so the loader
 * and the app agree on spelling.
 */
export const EMBED_PARAMS = {
  enabled: 'embed',
  parentOrigin: 'parentOrigin',
  partner: 'partner',
  token: 'token',
  amount: 'amount',
} as const
