import { useMemo } from 'react'
import { useBridgeOperations } from '@/hooks/useBridgeOperations'
import { canResumeOp } from '@/utils/resumability'

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

  return useMemo(() => {
    if (!operations) return 0
    return operations.filter((op) => canResumeOp(op)).length
  }, [operations])
}
