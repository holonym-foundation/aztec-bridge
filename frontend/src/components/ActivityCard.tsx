'use client'

import React, { useId, useState } from 'react'
import { Icon } from '@iconify/react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import type { BridgeOperation } from '@human.tech/clean.sdk'
import { formatUnits } from 'viem'
import { L1_TOKEN_METADATA, L1_NETWORKS, AZTEC_VERSION } from '@/config'
import StyledImage from '@/components/StyledImage'
import { isResumable, hasPossibleLockedFunds, isLikelyCompleted } from '@/utils/resumability'
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

// Network/deployment this app instance runs against. The operation record does
// not persist a per-op network or Aztec version, so we surface the current active
// deployment. Same source (config-derived, never hardcoded) and same "vX Alpha"
// language the DeploymentSelector uses in the nav.
const DEPLOYMENT_LABEL = [L1_NETWORKS[0]?.title, AZTEC_VERSION ? `v${AZTEC_VERSION} Alpha` : null]
  .filter(Boolean)
  .join(' · ')

// Deposit = Ethereum (L1) to Aztec (L2); withdraw = Aztec (L2) to Ethereum (L1).
// Reuses the same logo assets + arrow glyph the ProgressCard from/to block uses,
// so the direction reads consistently across the app. The visible text label is
// gone, so the group carries an aria-label/title announcing the direction.
function DirectionLogos({ direction }: { direction: BridgeOperation['direction'] }) {
  const isDeposit = direction === 'L1_TO_L2'
  const eth = '/assets/svg/ethLogo.svg'
  const aztec = '/assets/svg/aztec.svg'
  const first = isDeposit ? eth : aztec
  const second = isDeposit ? aztec : eth
  const label = isDeposit ? 'L1 to L2' : 'L2 to L1'
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex items-center gap-1">
      <StyledImage src={first} alt="" className="h-4 w-4 shrink-0" />
      <Icon icon="ph:arrow-right" width={12} height={12} className="text-gray-400" aria-hidden="true" />
      <StyledImage src={second} alt="" className="h-4 w-4 shrink-0" />
    </span>
  )
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

// Whether the bridge ran privately. Globe/navy = public, lock/maroon = private —
// the same icon + colour language used for fuel privacy elsewhere (FuelToggle,
// Messages tints), so the mode reads consistently across the app (#230a).
function PrivacyBadge({ isPrivate }: { isPrivate: boolean }) {
  return isPrivate ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FDE7F3] text-[#81133B] whitespace-nowrap">
      <Icon icon="ph:lock-key-fill" width={11} height={11} />
      Private
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#E5EFFF] text-[#17235E] whitespace-nowrap">
      <Icon icon="ph:globe-hemisphere-west-fill" width={11} height={11} />
      Public
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
  const date = new Date(operation.createdAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  // Resume button shown for both standard resumable states AND the edge case
  // where status='pending' but a tx hash exists (session died after tx send
  // but before the status-update PATCH landed — funds may be locked on-chain).
  // Both branches use the same decrypt + resume pipeline; the badge below
  // tells the user which case they're in.
  // A consumed / "no non-nullified" message means the deposit's L1→L2 message was already
  // claimed on a prior attempt — resuming just re-fails. Surface it as a calm "likely completed"
  // state and never offer Resume for it (isResumable already excludes it).
  const likelyCompleted = isLikelyCompleted(operation)
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
          <DirectionLogos direction={operation.direction} />
          <StatusBadge status={operation.status} />
          <PrivacyBadge isPrivate={!!operation.isPrivacyModeEnabled} />
          {likelyCompleted && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap">
              Likely completed
            </span>
          )}
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
      {DEPLOYMENT_LABEL && <p className="mt-1 text-[11px] text-gray-400">{DEPLOYMENT_LABEL}</p>}

      {likelyCompleted ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <Icon icon="ph:check-circle-fill" width={14} height={14} className="flex-shrink-0" />
          This deposit likely already completed. Check your L2 balance.
        </p>
      ) : (
        operation.lastErrorMessage && <OperationError message={operation.lastErrorMessage} />
      )}

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
