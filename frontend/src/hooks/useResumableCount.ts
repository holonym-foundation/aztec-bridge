import { useCallback, useMemo } from 'react'
import { useBridgeOperations } from '@/hooks/useBridgeOperations'
import { useBridgeStore } from '@/stores/bridgeStore'
import { canResumeOp } from '@/utils/resumability'

/** Minimum an operation must carry to be tested for the live / resumable state. */
type ResumeCandidate = Parameters<typeof canResumeOp>[0] & { id: string }

/**
 * True while a client mutation in THIS tab is driving the operation (a running
 * top-up, deposit, withdrawal, or resume).
 *
 * Backend status alone cannot answer this: an in-flight transfer sits at
 * `deposited` / `submitted` for the whole 5 to 15 minutes it waits on the other
 * chain, the exact status a dropped session leaves behind. The marker is
 * in-memory, so after a reload nothing is driving the operation and it correctly
 * becomes resumable again.
 */
export function useIsOperationLive(): (id: string) => boolean {
  const { liveOperationIds } = useBridgeStore()
  return useCallback((id: string) => liveOperationIds.includes(String(id)), [liveOperationIds])
}

/**
 * The single "this needs the user to act" predicate behind every Resume
 * affordance and the "N to finish" badge: resumable by status, and not already
 * being driven. Offering Resume for a transfer that is running right now
 * contradicts the screen running it (SOP §8).
 */
export function useCanResume(): (op: ResumeCandidate) => boolean {
  const isLive = useIsOperationLive()
  return useCallback((op: ResumeCandidate) => canResumeOp(op) && !isLive(op.id), [isLive])
}

/**
 * Counts bridge operations that still need the user to act — an incomplete
 * deposit/withdrawal they can resume, or one whose funds may be locked
 * on-chain after a dropped session. Reuses the cached useBridgeOperations
 * query (same 30s cache the Activity page + drawer share), so this adds no
 * extra fetch and stays in lockstep with the list the user resumes from.
 *
 * The predicate mirrors the drawer's per-row `showResume`, so the count always
 * matches the number of rows offering a Resume button.
 */
export function useResumableCount(): number {
  const { data: operations } = useBridgeOperations()
  const canResume = useCanResume()

  return useMemo(() => {
    if (!operations) return 0
    return operations.filter((op) => canResume(op)).length
  }, [operations, canResume])
}
