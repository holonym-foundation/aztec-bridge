'use client'

import React, { useId, useState } from 'react'
import { Icon } from '@iconify/react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import type { BridgeOperation } from '@human.tech/clean.sdk'
import { formatUnits } from 'viem'
import { L1_TOKEN_METADATA } from '@/config'
import { isResumable, hasPossibleLockedFunds } from '@/utils/resumability'
import { copyToClipboard } from '@/utils'
import { useToast } from '@/hooks/useToast'

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  deposited: { label: 'Deposited', className: 'bg-blue-100 text-blue-800' },
  claimed: { label: 'Claimed', className: 'bg-purple-100 text-purple-800' },
  submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-800' },
  ready: { label: 'Ready', className: 'bg-indigo-100 text-indigo-800' },
  pending_finalize: { label: 'Finalizing', className: 'bg-indigo-100 text-indigo-800' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-800',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${style.className}`}>
      {style.label}
    </span>
  )
}

// Collapsed to a SINGLE line by default (line-clamp-1) so the card stays
// compact and a page of them fits the fixed shell with no scroll. Anything
// past roughly one line's worth of characters is likely being truncated, so
// that's when we surface the "Show more" toggle to reveal the full copyable text.
const ERROR_EXPAND_THRESHOLD = 48

/** Failed-operation error message: clamped to one line by default, expandable + copyable in full. */
function OperationError({ message }: { message: string }) {
  const notify = useToast()
  const [expanded, setExpanded] = useState(false)
  const canExpand = message.length > ERROR_EXPAND_THRESHOLD

  const handleCopy = async () => {
    const ok = await copyToClipboard(message)
    notify(ok ? 'success' : 'error', ok ? 'Error copied to clipboard' : 'Failed to copy error')
  }

  return (
    <div className="mt-1 flex items-start gap-1.5">
      <p
        className={`text-xs text-red-500 flex-1 min-w-0 ${
          expanded
            ? 'whitespace-pre-wrap break-words max-h-20 overflow-y-auto pr-1'
            : 'line-clamp-1 break-words'
        }`}
      >
        {message}
      </p>
      <div className="flex items-center gap-1 flex-shrink-0">
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Show less of error message' : 'Show full error message'}
            className="text-[10px] font-semibold text-[#81133B] hover:underline px-1"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy error message"
          className="text-gray-400 hover:text-[#81133B] p-0.5 rounded"
        >
          <Icon icon="ph:copy" width={13} height={13} />
        </button>
      </div>
    </div>
  )
}

/**
 * True when the operation has the fuel-leg fields populated. Whether the fuel was sent to a
 * third party (as opposed to the bridger's own L2) is in the encrypted blob, so we can't tell
 * here — we just expose the share button whenever fuel data exists, and let the click handler
 * decrypt and decide.
 */
function hasFuelClaimData(op: BridgeOperation): boolean {
  if (op.direction !== 'L1_TO_L2') return false
  return !!op.fuelMessageHash && !!op.fuelMessageLeafIndex && !!op.fuelAmount && !!op.l1TxHash
}

interface ActivityCardProps {
  operation: BridgeOperation
  onResume: (operation: BridgeOperation) => void
  resuming: boolean
  onShareFuelClaim?: (operation: BridgeOperation) => void
  sharingFuelClaim?: boolean
}

export default function ActivityCard({
  operation,
  onResume,
  resuming,
  onShareFuelClaim,
  sharingFuelClaim,
}: ActivityCardProps) {
  const decimals = operation.tokenDecimalsL1 ?? L1_TOKEN_METADATA.decimals
  const tokenSymbol = operation.tokenSymbol ?? operation.tokenSymbolL1 ?? L1_TOKEN_METADATA.symbol
  const amount =
    operation.amountDisplayL1 ?? (operation.amountL1 ? formatUnits(BigInt(operation.amountL1), decimals) : '?')
  const date = new Date(operation.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const directionLabel = operation.direction === 'L1_TO_L2' ? 'L1 → L2' : 'L2 → L1'

  // Resume button shown for both standard resumable states AND the edge case
  // where status='pending' but a tx hash exists (session died after tx send
  // but before the status-update PATCH landed — funds may be locked on-chain).
  // Both branches use the same decrypt + resume pipeline; the badge below
  // tells the user which case they're in.
  const resumable = isResumable(operation)
  const lockedFunds = hasPossibleLockedFunds(operation)
  const showResume = resumable || lockedFunds

  // Unique per card so multiple cards' tooltips don't collide.
  const fuelTipId = `share-fuel-${useId()}`

  const hasActionRow =
    operation.l1TxUrl ||
    operation.l2TxUrl ||
    (onShareFuelClaim && hasFuelClaimData(operation)) ||
    showResume

  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-gray-600 whitespace-nowrap">{directionLabel}</span>
          <StatusBadge status={operation.status} />
          {lockedFunds && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800 whitespace-nowrap">
              Funds may be locked
            </span>
          )}
        </div>
        <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">{date}</span>
      </div>

      <p className="text-base font-semibold leading-none mt-1.5">
        {amount} {tokenSymbol}
      </p>

      {operation.lastErrorMessage && <OperationError message={operation.lastErrorMessage} />}

      {hasActionRow && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
          {operation.l1TxUrl && (
            <a
              href={operation.l1TxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
            >
              L1 Tx
              <Icon icon="ph:arrow-square-out" width={13} height={13} />
            </a>
          )}
          {operation.l2TxUrl && (
            <a
              href={operation.l2TxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 whitespace-nowrap"
            >
              L2 Tx
              <Icon icon="ph:arrow-square-out" width={13} height={13} />
            </a>
          )}

          <div className="ml-auto flex items-center gap-2">
            {onShareFuelClaim && hasFuelClaimData(operation) && (
              <div className="flex items-center gap-1.5">
                {/* Info (i) sits inside the pill, immediately after the label, so it
                    reads as explaining "Share fuel claim" (#190). */}
                <div className="inline-flex items-center gap-1 rounded-lg bg-amber-100 pl-3 pr-2 py-1">
                  <button
                    onClick={() => onShareFuelClaim(operation)}
                    disabled={!!sharingFuelClaim}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-80 disabled:opacity-60 whitespace-nowrap"
                  >
                    <Icon icon="ph:share-network" width={13} height={13} />
                    {sharingFuelClaim ? 'Decrypting…' : 'Share fuel claim'}
                  </button>
                  <button
                    type="button"
                    data-tooltip-id={fuelTipId}
                    data-tooltip-content="Create a link that lets someone else claim this transfer's Fee Juice (Aztec gas). Useful when you funded gas for another wallet."
                    aria-label="What is Share fuel claim?"
                    className="text-amber-700/70 hover:text-[#81133B]"
                  >
                    <Icon icon="ph:info" width={13} height={13} />
                  </button>
                </div>
                <ReactTooltip id={fuelTipId} place="top" className="z-[100]" style={{ fontSize: '11px', maxWidth: '220px' }} />
              </div>
            )}
            {showResume && (
              <button
                onClick={() => onResume(operation)}
                disabled={resuming}
                className="text-xs font-semibold text-white bg-black hover:bg-gray-800 disabled:bg-gray-400 px-3 py-1 rounded-lg whitespace-nowrap"
              >
                {resuming ? 'Decrypting...' : 'Resume'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
