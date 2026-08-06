'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  // server returns the User CUID directly (string) — see
  // /api/auth/authenticate/route.ts and prisma/schema.prisma
  // (User.id String @id @default(cuid(2))). Type was wrongly `number`.
  id: string
  l1Address: string
  l2Address: string
  l1LoginMethod: string | null
  l1WalletProvider: string | null
  l2LoginMethod: string | null
  l2WalletProvider: string | null
}

// A session-scoped auth token is bound to one (EVM, Aztec) pair (the SIWE message
// includes the L2 address), so switching Aztec accounts normally forces a fresh
// EVM signature. We cache the token per pair for the session so switching BACK to a
// pair already authed this session restores instantly — no repeat signature. Keyed
// on the normalized address pair.
const pairKey = (l1Address: string, l2Address: string) =>
  `${l1Address.toLowerCase().trim()}:${l2Address.toLowerCase().trim()}`

interface AuthState {
  token: string | null
  user: AuthUser | null
  authFailed: boolean
  retryAuth: number
  // In-memory only (NOT persisted): per-pair tokens authed this session. Reset on a
  // full page load so a reload re-auths once per pair, matching the token's own TTL.
  tokenCache: Record<string, { token: string; user: AuthUser }>
  setAuth: (token: string, user: AuthUser) => void
  setAuthFailed: (failed: boolean) => void
  triggerRetryAuth: () => void
  clearAuth: () => void
  // Restore a cached token for an already-authed pair, if present, WITHOUT signing.
  // Returns true when it restored. The token effect's verifySession still validates
  // the restored token and re-auths if it has genuinely expired.
  restoreCachedAuth: (l1Address: string, l2Address: string) => boolean
  // Drop a pair's cached token — called when verifySession rejects it (expired /
  // user_not_found) so it is never restored again and the flow falls through to a
  // fresh sign-in instead of looping restore -> clear -> restore.
  evictCachedAuth: (l1Address: string, l2Address: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      authFailed: false,
      retryAuth: 0,
      tokenCache: {},
      setAuth: (token, user) =>
        set((state) => ({
          token,
          user,
          authFailed: false,
          tokenCache: { ...state.tokenCache, [pairKey(user.l1Address, user.l2Address)]: { token, user } },
        })),
      setAuthFailed: (failed) => set({ authFailed: failed }),
      triggerRetryAuth: () => set((state) => ({ authFailed: false, retryAuth: state.retryAuth + 1 })),
      // Clears the ACTIVE session but keeps the per-pair cache, so a reconnect /
      // switch-back within the session doesn't re-sign. A full "Clear app data" or a
      // reload drops the cache (it's not persisted).
      clearAuth: () => set({ token: null, user: null, authFailed: false, retryAuth: 0 }),
      restoreCachedAuth: (l1Address, l2Address) => {
        const entry = get().tokenCache[pairKey(l1Address, l2Address)]
        if (!entry) return false
        set({ token: entry.token, user: entry.user, authFailed: false })
        return true
      },
      evictCachedAuth: (l1Address, l2Address) =>
        set((state) => {
          const next = { ...state.tokenCache }
          delete next[pairKey(l1Address, l2Address)]
          return { tokenCache: next }
        }),
    }),
    {
      name: 'shield-human-tech-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
)
