import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AttestationStatus } from '@human.tech/clean.sdk'
import { useWalletStore } from '@/stores/walletStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useBridge } from '@/hooks/useBridge'
import { useLinkedPairStore } from '@/stores/useLinkedPairStore'

/**
 * Authoritative L1↔L2 binding state for the CURRENTLY connected pair.
 *
 * Wraps `getAttestationStatus()`, which reads the server-side 1:1 binding table
 * keyed off the authenticated session. Self-gates via `enabled`: it only runs
 * once both wallets are connected AND a JWT exists (the endpoint is auth-only).
 * On a `'conflict'`, the returned `binding.l1Address`/`binding.l2Address` disclose
 * the stored counterpart for THIS pair — privacy-safe, since both sides are the
 * user's own connected addresses.
 */
export function useBindingStatus() {
  const { isWaapConnected, isAztecConnected, waapAddress, aztecAddress } = useWalletStore()
  const token = useAuthStore((s) => s.token)
  const bridge = useBridge()
  const recordPair = useLinkedPairStore((s) => s.recordPair)

  const query = useQuery<AttestationStatus>({
    queryKey: ['bindingStatus', waapAddress, aztecAddress],
    queryFn: () => bridge.getAttestationStatus(),
    enabled: isWaapConnected && isAztecConnected && !!waapAddress && !!aztecAddress && !!token,
    staleTime: 60 * 1000,
    retry: false,
  })

  // Persist any SERVER-disclosed L1↔L2 pair into the session store so the
  // "Linked" badge survives after the transient conflict response clears. Both
  // 'bound' (the connected pair itself) and 'conflict' (the disclosed stored
  // counterpart) carry an authoritative l1Address/l2Address for the user's own
  // wallets — privacy-safe to remember for this session only (never persisted).
  const binding = query.data?.binding
  useEffect(() => {
    if (!binding) return
    if (binding.status === 'bound' || binding.status === 'conflict') {
      recordPair(binding.l1Address, binding.l2Address)
    }
  }, [binding, recordPair])

  return query
}

/**
 * The Aztec (L2) account the server has disclosed as the pair for the given EVM
 * (L1) wallet at any point this session — from the in-memory store, so it
 * persists across dropdown/modal reopens even after a conflict response has
 * cleared. Returns null until something has actually been disclosed (no guess).
 */
export function useSessionLinkedL2(l1?: string | null): string | null {
  const pairs = useLinkedPairStore((s) => s.pairs)
  if (!l1) return null
  return pairs[l1.toLowerCase()] ?? null
}

export interface AccountLike {
  alias: string
  address: string
  index?: number
}

/** Truncated address with an ellipsis glyph — e.g. `0x24e2…dc6b`. */
export function shortAddr(addr?: string | null): string {
  if (!addr) return ''
  if (addr.length <= 13) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/**
 * Readable label for an account row: the Azguard alias when present, else a
 * stable "Account N" derived from the account's original position (walletStore
 * discards the generic 'account' alias, leaving an empty string). `fallbackIndex`
 * is used only when the parsed account carries no `index` of its own.
 */
export function accountLabel(acc: AccountLike, fallbackIndex = 0): string {
  if (acc.alias) return acc.alias
  const n = (acc.index ?? fallbackIndex) + 1
  return `Account ${n}`
}

export type PairingConflict =
  | { kind: 'evm-linked-elsewhere'; counterpart: string }
  | { kind: 'aztec-linked-elsewhere'; counterpart: string }
  | { kind: 'generic'; counterpart: string }

/**
 * Interpret a `'conflict'` binding against the connected pair to name the exact
 * stored counterpart. Returns null unless the status is actually a conflict.
 */
export function describeConflict(
  binding: AttestationStatus['binding'] | undefined,
  l1?: string | null,
  l2?: string | null,
): PairingConflict | null {
  if (!binding || binding.status !== 'conflict') return null
  const nl1 = l1?.toLowerCase() ?? null
  const nl2 = l2?.toLowerCase() ?? null
  const bl1 = binding.l1Address?.toLowerCase() ?? null
  const bl2 = binding.l2Address?.toLowerCase() ?? null

  if (bl1 && bl1 === nl1 && bl2 && bl2 !== nl2) {
    return { kind: 'evm-linked-elsewhere', counterpart: binding.l2Address! }
  }
  if (bl2 && bl2 === nl2 && bl1 && bl1 !== nl1) {
    return { kind: 'aztec-linked-elsewhere', counterpart: binding.l1Address! }
  }
  return { kind: 'generic', counterpart: binding.l2Address ?? binding.l1Address ?? '' }
}

/**
 * The L2 account the SERVER says the currently-connected EVM wallet is already
 * bound to, when the status is a conflict that discloses it (privacy-safe — the
 * disclosed counterpart is the user's own stored pair). Returns null otherwise.
 * This is the ONLY authoritative source of "which Aztec account is linked to
 * this EVM wallet" — never derived from device-local storage.
 */
export function disclosedLinkedL2(conflict: PairingConflict | null): string | null {
  return conflict?.kind === 'evm-linked-elsewhere' ? conflict.counterpart : null
}

/** User-facing copy for a pairing conflict, naming the stored counterpart. */
export function conflictMessage(c: PairingConflict): string {
  const short = shortAddr(c.counterpart)
  switch (c.kind) {
    case 'evm-linked-elsewhere':
      return `This EVM wallet is already linked to Aztec account ${short} — switch your Azguard account to it to continue.`
    case 'aztec-linked-elsewhere':
      return `This Aztec account is already linked to a different EVM wallet (${short}) — reconnect that wallet to continue.`
    default:
      return `These wallets don't match your existing link (${short}). Switch to your linked pair to continue.`
  }
}
