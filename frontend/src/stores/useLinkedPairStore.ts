'use client'

import { create } from 'zustand'

/**
 * Session-scoped memory of L1↔L2 bindings the SERVER has disclosed for the
 * user's own connected wallets. Deliberately in-memory only (a plain zustand
 * store, NOT localStorage): a prior localStorage-backed version caused a stale
 * cross-session contradiction — a remembered pair outliving a server-side
 * rebinding — so this is cleared on every reload by design.
 *
 * The map is keyed by lowercased EVM (L1) address → the Aztec (L2) address the
 * server says it is bound to. Populated only from authoritative
 * getAttestationStatus() disclosures (see useBindingStatus); never guessed. Used
 * to keep the "Linked to your EVM 0x…" badge on the correct Aztec account across
 * dropdown/modal reopens even after the transient conflict response has cleared.
 */
interface LinkedPairState {
  pairs: Record<string, string>
  recordPair: (l1?: string | null, l2?: string | null) => void
}

export const useLinkedPairStore = create<LinkedPairState>((set, get) => ({
  pairs: {},
  recordPair: (l1, l2) => {
    if (!l1 || !l2) return
    const key = l1.toLowerCase()
    if (get().pairs[key]?.toLowerCase() === l2.toLowerCase()) return
    set((s) => ({ pairs: { ...s.pairs, [key]: l2 } }))
  },
}))
