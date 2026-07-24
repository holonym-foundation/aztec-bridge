interface ResumableFields {
  direction: string
  status: string
  messageHash?: string | null
  l1TxHash?: string | null
  l1BlockNumberBeforeTx?: string | null
  l2TxHash?: string | null
  lastErrorMessage?: string | null
}

// The L1→L2 message was already spent — the claim actually went through on a prior attempt.
// This is a "you're already done" signal, not a loss. "No non-nullified L1 to L2 message found"
// (SDK #47) is the most common shape: the message was consumed by a prior successful claim, so a
// re-run has nothing left to claim. Kept in sync with ProgressCard's CONSUMED_ERROR_NEEDLES.
const CONSUMED_ERROR_NEEDLES = [
  'already consumed',
  'already claimed',
  'already been claimed',
  'nullifier already',
  'existing nullifier',
  'already been consumed',
  'has already been',
  'no non-nullified',
  'non-nullified l1 to l2',
]

/** True when a stored operation error means the deposit's L1→L2 message was already consumed. */
export function isConsumedMessageError(message?: string | null): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return CONSUMED_ERROR_NEEDLES.some((needle) => m.includes(needle))
}

/**
 * True when the operation most likely already completed: its stored error is a
 * consumed / "no non-nullified" message, so a Resume would just re-fail. The UI
 * treats these as "likely completed — check your L2 balance", never as resumable.
 */
export function isLikelyCompleted(op: { lastErrorMessage?: string | null }): boolean {
  return isConsumedMessageError(op.lastErrorMessage)
}

/** True for statuses where the user's funds are locked and can be resumed */
export function isResumable(op: ResumableFields): boolean {
  // A consumed-message op has nothing left to claim — resuming only re-fails.
  // Surface it as "likely completed" instead (see isLikelyCompleted), never resumable.
  if (isConsumedMessageError(op.lastErrorMessage)) return false
  if (op.direction === 'L1_TO_L2') {
    return (
      (op.status === 'deposited' || op.status === 'claimed') &&
      (!!op.messageHash || !!op.l1TxHash || !!op.l1BlockNumberBeforeTx)
    )
  }
  if (op.direction === 'L2_TO_L1') {
    return (
      op.status === 'submitted' ||
      op.status === 'ready' ||
      op.status === 'pending_finalize'
    )
  }
  return false
}

/**
 * True if an entry has status 'pending' but a tx hash exists,
 * indicating the session died after tx send but before status update.
 * Funds may be locked on-chain.
 */
export function hasPossibleLockedFunds(op: {
  status: string
  l1TxHash?: string | null
  l2TxHash?: string | null
  lastErrorMessage?: string | null
}): boolean {
  if (isConsumedMessageError(op.lastErrorMessage)) return false
  return op.status === 'pending' && (!!op.l1TxHash || !!op.l2TxHash)
}

/**
 * A row is resumable when the bridge is still in flight. isResumable /
 * hasPossibleLockedFunds cover the SDK-classified mid-flow states; a bare
 * 'pending' (session dropped before any tx landed, so no hash yet) still needs a
 * route back into /progress/resume. Terminal + likely-completed never resume.
 * Single source of truth for both the Activity rows and the "N to finish" badge.
 */
export function canResumeOp(op: ResumableFields): boolean {
  return (
    !isLikelyCompleted(op) &&
    op.status !== 'completed' &&
    op.status !== 'failed' &&
    (isResumable(op) || hasPossibleLockedFunds(op) || op.status === 'pending')
  )
}
