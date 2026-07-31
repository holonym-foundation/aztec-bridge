'use client'

import { create } from 'zustand'

// Counts consecutive failed resume attempts per operation so the app can escalate a
// transfer that keeps looping back to the same error. Kept in a store (not on the
// resume page) because each resume runs on a fresh page mount, so a component-local
// counter would reset to zero every attempt.
interface AttemptEntry {
  count: number
  lastError: string
}

interface ResumeAttemptsState {
  attempts: Record<string, AttemptEntry>
  // Record a failed resume for an op and return the new consecutive-failure count.
  // Resets to 1 when this op's error text differs from its last one (a different
  // failure isn't the same stuck loop). A different op keys its own entry.
  recordFailure: (opId: string, error: string) => number
  reset: (opId: string) => void
}

export const useResumeAttemptsStore = create<ResumeAttemptsState>((set, get) => ({
  attempts: {},

  recordFailure: (opId, error) => {
    const prev = get().attempts[opId]
    const count = prev && prev.lastError === error ? prev.count + 1 : 1
    set((state) => ({ attempts: { ...state.attempts, [opId]: { count, lastError: error } } }))
    return count
  },

  reset: (opId) =>
    set((state) => {
      if (!(opId in state.attempts)) return state
      const next = { ...state.attempts }
      delete next[opId]
      return { attempts: next }
    }),
}))
