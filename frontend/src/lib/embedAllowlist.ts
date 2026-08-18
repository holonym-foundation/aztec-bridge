import { EMBED_ALLOWED_ORIGINS } from '@/config/env.config'

/**
 * Partner origins allowed to frame Shield.
 *
 * Only absolute http(s) origins are accepted — a bare host or a path would
 * silently widen or break the CSP directive it ends up in, so anything that
 * doesn't parse as an origin is dropped rather than passed through.
 */
export function getEmbedAllowedOrigins(): string[] {
  const origins: string[] = []
  for (const part of EMBED_ALLOWED_ORIGINS.split(',')) {
    const raw = part.trim()
    if (!raw) continue
    try {
      const { origin, protocol } = new URL(raw)
      if (protocol !== 'https:' && protocol !== 'http:') continue
      if (!origins.includes(origin)) origins.push(origin)
    } catch {
      continue
    }
  }
  return origins
}

/**
 * `frame-ancestors` source list. With no partners configured this is just
 * 'self', which reproduces the X-Frame-Options: SAMEORIGIN behaviour it replaces.
 */
export function getFrameAncestors(): string {
  return ["'self'", ...getEmbedAllowedOrigins()].join(' ')
}

// Wallet iframes Shield itself nests. They are the ones this document delegates
// to — a partner embedding us grants features to us via the iframe `allow`
// attribute, and this header decides how far down the chain they travel.
const NESTED_WALLET_ORIGINS = ['https://waap.xyz', 'https://staging-waap.xyz']

/**
 * Permissions-Policy for this document and its subframes.
 *
 * `storage-access` is what lets the framed app (and the WaaP wallet inside it)
 * ask for unpartitioned storage in a third-party context; `publickey-credentials-get`
 * covers WaaP passkey sign-in. The Aztec wallet-sdk mounts its own iframe with
 * `allow="storage-access; cross-origin-isolated"`, which is only honoured if
 * this document holds the feature to hand down.
 *
 * Note the allowlist here is the nested wallets, NOT the partner origins: this
 * header points down the frame tree, not up it.
 */
export function getPermissionsPolicy(): string {
  const list = ['self', ...NESTED_WALLET_ORIGINS.map((o) => `"${o}"`)].join(' ')
  return [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    `storage-access=(${list})`,
    `publickey-credentials-get=(${list})`,
    `clipboard-write=(${list})`,
  ].join(', ')
}
