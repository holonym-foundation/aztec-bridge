'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCountdown } from 'usehooks-ts'
import LoadingStepsBars from '@/components/LoadingStepsBars'
import StyledImage from '@/components/StyledImage'
import TextButton from '@/components/TextButton'
import type { LoadingStep } from '@/stores/bridgeStore'
import { STORAGE_KEYS } from '@human.tech/clean.sdk'
import type { BridgeOperation, RecoveryClaimData, RecoveryWithdrawalData } from '@human.tech/clean.sdk'
import { exportClaimData, exportWithdrawalData } from '@/utils'
import { useBridgeOperations, decryptOperationPayload } from '@/hooks/useBridgeOperations'
import { useWalletStore } from '@/stores/walletStore'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useToast } from '@/hooks/useToast'
import { isResumable, hasPossibleLockedFunds } from '@/utils/resumability'
import { BridgeDirection } from '@/types/bridge'

export interface ProgressCardProps {
  steps: LoadingStep[]
  progressStep: number
  hasError: boolean
  l1TxUrl: string | null
  l2TxUrl: string | null
  estimatedTimeSeconds: number
  /** Display amount string, e.g. "10.5 USDC" */
  amountDisplay: string
  /** Optional fuel breakdown for fresh L1→L2 with fuel */
  fuelBreakdown?: { bridgeAmount: string; fuelAmount: string }
  /** From/To network titles */
  fromNetwork: string
  toNetwork: string
  /** Bridge direction — used for export button */
  direction?: 'L1_TO_L2' | 'L2_TO_L1'
  /** Raw failure text (mutation error message), when the page can surface it. Used to
      classify a Fee-Juice/gas shortfall so recovery routes to the top-up flow. */
  errorMessage?: string | null
}

// A stuck L2 claim that can't pay its gas out of the bridged Fee Juice surfaces as a
// contract assertion / gas-cost revert. These substrings cover the shapes we've seen
// (Aztec `Assertion failed`, `max_gas_cost`, `claim_and_end_setup`) plus generic
// fee/gas/insufficient wording. Matching is intentionally broad — the recovery it
// offers (top up FJ, then resume) is safe and non-destructive even on a false positive.
const FUEL_ERROR_NEEDLES = [
  'assertion failed',
  'max_gas_cost',
  'claim_and_end_setup',
  'fee',
  'insufficient',
  'gas',
  'feejuice',
  'fuel',
]

function isFuelError(message?: string | null): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return FUEL_ERROR_NEEDLES.some((needle) => m.includes(needle))
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export default function ProgressCard({
  steps,
  progressStep,
  hasError,
  l1TxUrl,
  l2TxUrl,
  estimatedTimeSeconds,
  amountDisplay,
  fuelBreakdown,
  fromNetwork,
  toNetwork,
  direction,
  errorMessage,
}: ProgressCardProps) {
  const router = useRouter()
  const notify = useToast()

  const { waapAddress: l1Address, signWaapMessage } = useWalletStore()
  const { setRecovery, setWithdrawalRecovery, setDirection } = useBridgeStore()
  const { data: operations } = useBridgeOperations()
  const [resuming, setResuming] = useState(false)

  const isAllComplete = steps.every((step) => step.status === 'completed')

  // The L2 claim ("Claiming tokens on Aztec Network") is the step that spends bridged
  // Fee Juice — the one that stalls when gas runs short. Detect it by label so both the
  // in-progress escape hatch and the failure classifier can key off it.
  const isL1ToL2 = direction === 'L1_TO_L2'
  const claimStepActive = isL1ToL2 && steps.some((s) => s.status === 'active' && /claim/i.test(s.label))
  const claimStepErrored = isL1ToL2 && steps.some((s) => s.status === 'error' && /claim/i.test(s.label))

  // Fuel-specific recovery: promote the Fee-Juice top-up when the error text looks like a
  // gas shortfall. When the page can't give us error text, still offer top-up (secondary)
  // on an L1→L2 claim failure — an underfunded claim is the common cause.
  const fuelErrorDetected = isL1ToL2 && isFuelError(errorMessage)
  // Fall back to offering top-up only when the deposit already landed on L1 (l1TxUrl set)
  // — i.e. we're at/after the claim boundary where Fee Juice matters. A pre-deposit
  // failure moved no funds and needs no gas top-up.
  const fuelTopUpSecondary =
    isL1ToL2 && !fuelErrorDetected && (claimStepErrored || (!errorMessage && !!l1TxUrl))

  // Latest interrupted operation for THIS direction that can be resumed — the same
  // backend operations the Activity page/drawer resume from, so this button routes
  // into the identical /progress/resume flow rather than making the user hunt for it.
  const resumableOp = useMemo<BridgeOperation | null>(() => {
    if (!direction || !operations) return null
    return (
      [...operations]
        .filter((op) => op.direction === direction && (isResumable(op) || hasPossibleLockedFunds(op)))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
    )
  }, [operations, direction])

  // Mirrors the Activity page/drawer resume handler (activity/page.tsx isn't importable):
  // decrypt to prove wallet ownership, stash recovery data, then hand off to /progress/resume.
  const handleResume = async (operation: BridgeOperation) => {
    if (!l1Address) {
      notify('error', 'Please connect your Ethereum wallet first')
      return
    }

    setResuming(true)
    try {
      const decrypted = await decryptOperationPayload(operation, l1Address, signWaapMessage)

      if (!decrypted) {
        throw new Error(
          'Could not decrypt operation data. Make sure you are using the same wallet that created this bridge.',
        )
      }

      if (operation.direction === 'L2_TO_L1') {
        const recoveryData: RecoveryWithdrawalData = {
          operationId: operation.id,
          amount: decrypted.amount ?? operation.amountL2 ?? operation.amountL1 ?? '0',
          l1Address: decrypted.l1Address ?? l1Address,
          l2Address: decrypted.l2Address ?? '',
          l2TxHash: operation.l2TxHash,
          l2TxUrl: operation.l2TxUrl,
          l2BlockNumber: operation.l2BlockNumber,
          l2BlockNumberBeforeTx: operation.l2BlockNumberBeforeTx,
          l2ToL1MessageIndex: operation.l2ToL1MessageIndex,
          siblingPath: operation.siblingPath,
          epoch: operation.epoch,
          numCheckpointsInEpoch: operation.numCheckpointsInEpoch,
          recipientL1Address: operation.recipientL1Address ?? l1Address,
          rollupVersion: operation.rollupVersion,
          chainIdL1: operation.chainIdL1,
          portalAddressL1: operation.portalAddressL1,
          bridgeAddressL2: operation.bridgeAddressL2,
          l1RollupAddress: operation.l1RollupAddress,
          l1OutboxAddress: operation.l1OutboxAddress,
          isPrivacyModeEnabled: operation.isPrivacyModeEnabled ?? false,
          nodeInfo: operation.nodeInfo,
          status: operation.status,
          currentStep: operation.currentStep,
        }

        setDirection(BridgeDirection.L2_TO_L1)
        setWithdrawalRecovery(operation.id, recoveryData)
        router.push('/progress/resume')
      } else {
        if (!decrypted.claimSecret || !decrypted.claimSecretHash) {
          throw new Error(
            'Could not decrypt claim secret. Make sure you are using the same wallet that created this bridge.',
          )
        }

        const recoveryData: RecoveryClaimData = {
          operationId: operation.id,
          claimSecret: decrypted.claimSecret,
          claimSecretHash: decrypted.claimSecretHash,
          messageHash: operation.messageHash,
          messageLeafIndex: operation.messageLeafIndex,
          amount: decrypted.amount ?? operation.amountL1 ?? '0',
          claimAmount: operation.claimAmount ?? null,
          l1Address: decrypted.l1Address ?? l1Address,
          l2Address: decrypted.l2Address ?? '',
          l1TxHash: operation.l1TxHash,
          l1TxUrl: operation.l1TxUrl,
          l1BlockNumberBeforeTx: operation.l1BlockNumberBeforeTx,
          isPrivacyModeEnabled: operation.isPrivacyModeEnabled ?? false,
          nodeInfo: operation.nodeInfo,
          status: operation.status,
          currentStep: operation.currentStep,
          portalAddressL1: operation.portalAddressL1,
          bridgeAddressL2: operation.bridgeAddressL2,
          tokenAddressL1: operation.tokenAddressL1,
          tokenAddressL2: operation.tokenAddressL2,
          fuelSecret: decrypted.fuelSecret ?? null,
          privateFuelSalt: decrypted.privateFuelSalt ?? null,
          privateFuelSecret: decrypted.privateFuelSecret ?? null,
          fuelMessageHash: operation.fuelMessageHash ?? null,
          fuelMessageLeafIndex: operation.fuelMessageLeafIndex ?? null,
          fuelAmount: operation.fuelAmount ?? null,
        }

        setDirection(BridgeDirection.L1_TO_L2)
        setRecovery(operation.id, recoveryData)
        router.push('/progress/resume')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to decrypt'
      notify('error', msg)
    } finally {
      setResuming(false)
    }
  }

  const resumeLabel =
    direction === 'L2_TO_L1' ? 'Resume withdrawal' : direction === 'L1_TO_L2' ? 'Resume claim' : 'Resume transfer'

  const handleResumeClick = () => {
    if (resumableOp) {
      handleResume(resumableOp)
    } else {
      // Backend op not loaded yet or not found — fall back to the full Activity list
      // so the user still has a path forward instead of a dead button.
      router.push('/activity')
    }
  }

  // Track whether backup data is available in localStorage
  const [hasBackup, setHasBackup] = useState(false)
  useEffect(() => {
    if (!direction) return
    const key = direction === 'L1_TO_L2' ? STORAGE_KEYS.deposits : STORAGE_KEYS.withdrawals
    const check = () => {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return
        const entries = JSON.parse(raw)
        if (entries.some((e: any) => !e.success)) setHasBackup(true)
      } catch {
        /* ignore */
      }
    }
    check()
    // Re-check when localStorage changes (SDK writes during operation)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key) check()
    }
    window.addEventListener('storage', handleStorage)
    // Also poll briefly since storage events don't fire for same-tab writes
    const interval = setInterval(check, 3000)
    return () => {
      window.removeEventListener('storage', handleStorage)
      clearInterval(interval)
    }
  }, [direction])

  const [count, { startCountdown, stopCountdown }] = useCountdown({
    countStart: estimatedTimeSeconds,
    intervalMs: 1000,
  })

  // Start countdown on mount, stop on unmount
  useEffect(() => {
    startCountdown()
    return () => {
      stopCountdown()
    }
  }, [startCountdown, stopCountdown])

  // Stop countdown on completion or error
  useEffect(() => {
    if (isAllComplete || hasError) {
      stopCountdown()
    }
  }, [isAllComplete, hasError, stopCountdown])

  const formattedCountdown = formatSeconds(count)
  const initialEstimateFormatted = formatSeconds(estimatedTimeSeconds)

  // Time taken = total estimate - remaining
  const timeTakenSeconds = estimatedTimeSeconds - count
  const formattedTimeTaken = formatSeconds(timeTakenSeconds)

  const handleExportBackup = () => {
    if (!direction) return
    try {
      const key = direction === 'L1_TO_L2' ? STORAGE_KEYS.deposits : STORAGE_KEYS.withdrawals
      const raw = localStorage.getItem(key)
      if (!raw) return
      const entries = JSON.parse(raw)
      const latest = entries.filter((e: any) => !e.success).pop()
      if (!latest) return
      if (direction === 'L1_TO_L2') {
        exportClaimData(latest)
      } else {
        exportWithdrawalData(latest)
      }
    } catch (e) {
      console.error('[ProgressCard] Export failed:', e)
    }
  }

  const heading = hasError ? 'Something went wrong' : isAllComplete ? 'Transaction complete' : 'Transaction in progress'

  const showBackButton = isAllComplete || hasError

  return (
    <div>
      {/* Warning banner — only when in progress */}
      {!isAllComplete && !hasError && (
        <div className="bg-light-yellow border border-dark-yellow/20 rounded-md mt-2 px-3 py-2">
          <p className="text-xs text-dark-yellow font-medium text-center">
            Please don't reload or close this page, or it may be difficult to recover your funds.
          </p>
        </div>
      )}

      {/* Progress Card */}
      <div className="bg-white rounded-md mt-2 p-4">
        <div className="flex items-center justify-center">
          {hasError ? (
            <svg width="56" height="56" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12.5004 8.99998V13M12.5004 17H12.5104M22.2304 18L14.2304 3.99998C14.056 3.69218 13.803 3.43617 13.4973 3.25805C13.1917 3.07993 12.8442 2.98608 12.4904 2.98608C12.1366 2.98608 11.7892 3.07993 11.4835 3.25805C11.1778 3.43617 10.9249 3.69218 10.7504 3.99998L2.75042 18C2.5741 18.3053 2.48165 18.6519 2.48243 19.0045C2.48321 19.3571 2.5772 19.7032 2.75486 20.0078C2.93253 20.3124 3.18757 20.5646 3.49411 20.7388C3.80066 20.9131 4.14783 21.0032 4.50042 21H20.5004C20.8513 20.9996 21.1959 20.9069 21.4997 20.7313C21.8035 20.5556 22.0556 20.3031 22.2309 19.9991C22.4062 19.6951 22.4985 19.3504 22.4984 18.9995C22.4983 18.6486 22.4059 18.3039 22.2304 18Z"
                stroke="#B91C1C"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <StyledImage
              src={isAllComplete ? '/assets/svg/transactionComplete.svg' : '/assets/svg/progress.svg'}
              alt=""
              className="h-[56px] w-[56px]"
            />
          )}
        </div>

        <p
          className={`text-center font-semibold text-md mt-4 ${
            hasError ? 'text-[#B91C1C]' : isAllComplete ? 'text-green-600' : ''
          }`}
        >
          {heading}
        </p>

        {hasError && (
          <p className="text-center text-12 text-latest-grey-500 mt-1">
            {fuelErrorDetected
              ? 'Your L2 gas (Fee Juice) ran short — top up to finish your claim. Your deposit is safe on L1 in the meantime.'
              : l1TxUrl
                ? 'Your deposit confirmed on L1 but a later step did not complete. Your funds are safe — resume the transfer below to finish it.'
                : 'The transaction was cancelled or could not be completed. You can safely go back and try again.'}
          </p>
        )}

        <div className="mt-4">
          <LoadingStepsBars steps={steps} currentStep={progressStep - 1} />
        </div>

        {!hasError && (
          <>
            <hr className="text-latest-grey-300 my-3" />
            <div className="flex justify-between mt-[2px]">
              <p className="text-14 font-medium text-latest-grey-100">Estimated time </p>
              <p className="font-semibold text-14">~{isAllComplete ? initialEstimateFormatted : formattedCountdown}</p>
            </div>
            {isAllComplete && (
              <div className="flex justify-between mt-[2px]">
                <p className="text-14 font-medium text-latest-grey-100">Total time taken </p>
                <p className="font-semibold text-14">{formattedTimeTaken}</p>
              </div>
            )}
          </>
        )}

        {/* Escape hatch during the L2 claim: the claim pays gas from bridged Fee Juice and
            can loop/retry when it runs short. Offer a top-up route so the user isn't forced
            to wait out the retry loop. Subtle — the claim usually succeeds on its own. */}
        {claimStepActive && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => router.push('/fee-juice?resume=1')}
              className="text-12 font-medium text-latest-grey-500 underline-offset-2 hover:text-[#81133B] hover:underline"
            >
              Not enough gas? Top up Fee Juice
            </button>
          </div>
        )}

        {/* Backup export lives here in the transaction frame — recovery-critical,
            so it stays with the progress state rather than in a toast or the links row. */}
        {direction && hasBackup && !isAllComplete && (
          <>
            <hr className="text-latest-grey-300 my-3" />
            <button
              onClick={handleExportBackup}
              title="Optional. Your data is already encrypted and backed up — this saves a local copy for manual recovery."
              className="w-full text-13 font-semibold text-[#047857] bg-[#ecfdf5] hover:bg-[#d7f7e8] py-2 rounded-full transition-colors"
            >
              Export encrypted backup ↓
            </button>
          </>
        )}
      </div>

      {/* Transaction Details */}
      <div className="bg-[#F5F5F5] rounded-md mt-3 p-4">
        <div className="flex justify-between">
          <div>
            <p className="text-14 font-semibold text-latest-grey-100">From</p>
            <div className="flex gap-2 mt-2">
              <StyledImage src="/assets/svg/ethLogo.svg" alt="" className="h-6 w-6" />
              <p className="text-16 font-medium text-latest-black-100 w-[106px]">{fromNetwork}</p>
            </div>
          </div>
          <div>
            <p className="text-14 font-semibold text-latest-grey-100">To</p>
            <div className="flex gap-2 mt-2">
              <StyledImage src="/assets/svg/aztec.svg" alt="" className="h-6 w-6" />
              <p className="text-16 font-medium text-latest-black-100 w-[106px]">{toNetwork}</p>
            </div>
          </div>
        </div>
        <hr className="text-latest-grey-300 my-3" />
        <p className="text-32 text-black font-medium text-center">{amountDisplay}</p>
        {fuelBreakdown && (
          <p className="text-center text-12 font-medium text-latest-grey-500 mt-1">
            {/* bridgeAmount/fuelAmount strings already include their own
                token symbol and "to top up …" suffix from the producer at
                app/progress/page.tsx — do NOT double-suffix here. */}
            {fuelBreakdown.bridgeAmount} to bridge + {fuelBreakdown.fuelAmount}
          </p>
        )}
      </div>

      {/* Transaction Links */}
      <div className="flex flex-row items-center justify-center mt-2 gap-4">
        {l1TxUrl && (
          <a
            href={l1TxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-14 font-semibold text-blue-200 bg-blue-300 hover:text-blue-100 mt-2 block px-4 py-2 rounded-full"
          >
            View L1 Tx ↗
          </a>
        )}
        {l2TxUrl && (
          <a
            href={l2TxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-14 font-semibold text-[#BF1254] bg-[#FDE7F3] hover:text-[#81133B] mt-2 block px-4 py-2 rounded-full"
          >
            View L2 Tx ↗
          </a>
        )}
      </div>

      {/* Error recovery actions — resume is the primary path, so the user can finish
          the interrupted transfer right here instead of hunting for the Activity page. */}
      {hasError && direction && (
        <div className="mt-4 mb-6 flex flex-col items-center gap-2">
          {fuelErrorDetected ? (
            <>
              {/* Fuel shortfall is the diagnosed cause — top-up is the primary path, resume
                  is the secondary step the user takes once Fee Juice has landed. */}
              <button
                onClick={() => router.push('/fee-juice?resume=1')}
                className="w-full rounded-lg bg-[#81133B] py-[10px] font-semibold text-white transition-opacity hover:opacity-80"
              >
                Top up Fee Juice to finish claim
              </button>
              <button
                onClick={handleResumeClick}
                disabled={resuming}
                className="w-full rounded-lg border border-[#17235E]/40 py-[10px] font-semibold text-[#17235E] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resuming ? 'Resuming…' : 'Already topped up? ' + resumeLabel}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleResumeClick}
                disabled={resuming}
                className="w-full rounded-lg bg-[#17235E] py-[10px] font-semibold text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resuming ? 'Resuming…' : resumeLabel}
              </button>
              {/* Error text wasn't conclusive, but an underfunded L2 claim is the common cause —
                  offer the top-up as a secondary path so the user isn't stuck re-resuming. */}
              {fuelTopUpSecondary && (
                <button
                  onClick={() => router.push('/fee-juice?resume=1')}
                  className="w-full rounded-lg border border-[#81133B]/40 py-[10px] font-semibold text-[#81133B] transition-opacity hover:opacity-80"
                >
                  Top up Fee Juice
                </button>
              )}
            </>
          )}
          <div className="mt-1 flex items-center justify-center">
            <TextButton
              className="!bg-transparent !text-latest-grey-100 hover:!bg-transparent hover:!text-latest-black-100 !font-medium"
              onClick={() => router.push('/')}
            >
              Back to Main Screen
            </TextButton>
          </div>
          <button
            onClick={() => router.push('/activity')}
            className="text-12 font-medium text-latest-grey-500 underline-offset-2 hover:text-latest-black-100 hover:underline"
          >
            View in Activity
          </button>
        </div>
      )}

      {/* Back to Main Screen — completion state, and the error fallback when no
          direction is available to build the resume action above. */}
      {showBackButton && !(hasError && direction) && (
        <div className="flex flex-row items-center justify-center mt-4 mb-6">
          <TextButton className="" onClick={() => router.push('/')}>
            Back to Main Screen
          </TextButton>
        </div>
      )}
    </div>
  )
}
