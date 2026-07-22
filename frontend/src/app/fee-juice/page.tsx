'use client'

import React, { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@iconify/react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import RootStyle from '@/components/RootStyle'
import BridgeHeader from '@/components/BridgeHeader'
import AztecWalletConnectionModals from '@/components/AztecWalletConnectionModals'
import FeeJuiceTopUp from '@/components/FeeJuiceTopUp'
import TextButton from '@/components/TextButton'
import { useL2FeeJuiceBalance, useL2PrivateFeeJuiceBalance } from '@/hooks/useL2Operations'
import { useBridgeOperations, decryptOperationPayload } from '@/hooks/useBridgeOperations'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useWalletStore } from '@/stores/walletStore'
import { useToast } from '@/hooks/useToast'
import { isResumable, hasPossibleLockedFunds, isLikelyCompleted } from '@/utils/resumability'
import { BridgeDirection } from '@/types/bridge'
import { BRIDGED_FPC_ADDRESS } from '@/config'
import type { BridgeOperation, RecoveryClaimData } from '@human.tech/clean.sdk'

function FeeJuicePageInner() {
  const router = useRouter()
  const notify = useToast()
  const searchParams = useSearchParams()
  const fromResume = searchParams.get('resume') === '1'

  const { isPrivacyModeEnabled, setRecovery, setDirection } = useBridgeStore()
  const { waapAddress: l1Address, signWaapMessage } = useWalletStore()

  const { data: feeJuiceBalance, isLoading: fjLoading } = useL2FeeJuiceBalance()
  const { data: privateFeeJuiceBalance, isLoading: privateFjLoading } = useL2PrivateFeeJuiceBalance()

  const { data: operations } = useBridgeOperations()

  const [toppedUp, setToppedUp] = useState(false)
  const [resuming, setResuming] = useState(false)
  // Set by FeeJuiceTopUp when the user's existing (mode-applicable) balance already
  // covers the interrupted claim, so we can offer Resume without a redundant top-up.
  const [landingCovered, setLandingCovered] = useState(false)

  // The latest interrupted L1→L2 claim we can resume — same backend operations the
  // Activity page/ProgressCard resume from, so "Resume claim" hands off to the
  // identical /progress/resume flow rather than making the user hunt for it.
  const resumableClaim = useMemo<BridgeOperation | null>(() => {
    if (!operations) return null
    return (
      [...operations]
        .filter((op) => op.direction === 'L1_TO_L2' && (isResumable(op) || hasPossibleLockedFunds(op)))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
    )
  }, [operations])

  // A recovery whose L1→L2 message was already consumed (deposit likely completed). It is NOT
  // resumable (isResumable/hasPossibleLockedFunds both exclude it), so it never appears above —
  // we surface it as "check your L2 balance" instead of a top-up-then-resume flow.
  const depositLikelyCompleted = useMemo<boolean>(() => {
    if (!fromResume || !operations || resumableClaim) return false
    return operations.some((op) => op.direction === 'L1_TO_L2' && isLikelyCompleted(op))
  }, [fromResume, operations, resumableClaim])

  // Mirrors ProgressCard.handleResume (L1→L2 branch): decrypt to prove wallet
  // ownership, stash recovery data, then hand off to /progress/resume.
  const handleResume = async () => {
    if (!l1Address) {
      notify('error', 'Please connect your Ethereum wallet first')
      return
    }
    if (!resumableClaim) {
      // Backend op not loaded yet or not found — fall back to the full Activity list
      // so the user still has a path forward instead of a dead button.
      router.push('/activity')
      return
    }

    setResuming(true)
    try {
      const operation = resumableClaim
      const decrypted = await decryptOperationPayload(operation, l1Address, signWaapMessage)

      if (!decrypted) {
        throw new Error(
          'Could not decrypt operation data. Make sure you are using the same wallet that created this bridge.',
        )
      }
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to decrypt'
      notify('error', msg)
    } finally {
      setResuming(false)
    }
  }

  // Show both balances whenever private fuel exists on this deployment, so the
  // one-line summary always reflects the full picture regardless of the active mode.
  const showPrivate = !!BRIDGED_FPC_ADDRESS
  // The active side of the balance line is highlighted (bold + brand color); the inactive side
  // is dimmed. This is the mode indication — mirrors FeeJuiceTopUp's fuelType resolution.
  const privateActive = isPrivacyModeEnabled && showPrivate

  return (
    <RootStyle className="min-h-0 max-h-[calc(90vh-2rem)] overflow-hidden">
      <AztecWalletConnectionModals />
      <div className="flex h-full max-h-[calc(90vh-2rem)] flex-col overflow-hidden">
        <div className="px-5 pt-5">
          <div className="flex items-center gap-4">
            <BridgeHeader title="TOP UP" />
          </div>
        </div>

        <div className="px-5 pb-5 min-h-0 flex-1 overflow-y-auto">
          {/* Title left, current Fee Juice balances compact on the right — one row. The active
              mode's side is highlighted (bold + brand color) and the inactive side is dimmed. */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon icon="ph:gas-pump-fill" width={20} height={20} className="text-[#17235E]" />
              <h1 className="text-16 font-semibold text-latest-black-100">Fee Juice</h1>
              <Icon
                icon="ph:info"
                width={15}
                height={15}
                className="cursor-help text-latest-grey-500"
                data-tooltip-id="fj-purpose"
                data-tooltip-content="Fee Juice is gas on Aztec. Top up here anytime."
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-12">
              {fjLoading ? (
                <span className="inline-block h-3 w-10 bg-neutral-300 rounded animate-pulse" />
              ) : (
                <>
                  <span className={privateActive ? 'font-medium text-latest-grey-500' : 'font-bold text-[#17235E]'}>
                    {feeJuiceBalance ?? '--'}
                  </span>
                  <span
                    className={`flex items-center gap-0.5 ${
                      privateActive ? 'text-latest-grey-500' : 'font-semibold text-[#17235E]'
                    }`}
                  >
                    public
                    <Icon
                      icon="ph:globe-hemisphere-west-fill"
                      width={11}
                      height={11}
                      style={{ color: privateActive ? '#747474' : '#17235E' }}
                    />
                  </span>
                </>
              )}
              {showPrivate && (
                <>
                  <span className="text-latest-grey-400">·</span>
                  {privateFjLoading ? (
                    <span className="inline-block h-3 w-10 bg-neutral-300 rounded animate-pulse" />
                  ) : (
                    <span className={privateActive ? 'font-bold text-[#81133B]' : 'font-medium text-latest-grey-500'}>
                      {privateFeeJuiceBalance ?? '--'}
                    </span>
                  )}
                  <span
                    className={`flex items-center gap-0.5 ${
                      privateActive ? 'font-semibold text-[#81133B]' : 'text-latest-grey-500'
                    }`}
                  >
                    private
                    <Icon
                      icon="ph:lock-key-fill"
                      width={11}
                      height={11}
                      style={{ color: privateActive ? '#81133B' : '#747474' }}
                    />
                  </span>
                </>
              )}
            </div>
          </div>
          <ReactTooltip id="fj-purpose" place="bottom" className="z-[100]" style={{ fontSize: '12px', maxWidth: '220px' }} />

          {/* Reusable buy + bridge Fee Juice form (auto + manual). Owns ALL top-up status
              messaging (including the interrupted-claim banner) so the screen can never show
              two contradictory statements. */}
          <div className="mt-3">
            <FeeJuiceTopUp
              isPrivacyModeEnabled={isPrivacyModeEnabled}
              feeJuiceBalance={feeJuiceBalance}
              privateFeeJuiceBalance={privateFeeJuiceBalance}
              landingClaimShort={fromResume}
              depositLikelyCompleted={depositLikelyCompleted}
              onLandingCoveredChange={setLandingCovered}
              onSuccess={() => setToppedUp(true)}
            />
          </div>

          {/* Prominent "Resume claim" once the claim is fundable — either after a successful
              top-up, or immediately when the existing balance already covers it (public mode).
              Never offered when the deposit likely already completed (resume would only re-fail). */}
          {fromResume && !depositLikelyCompleted && (toppedUp || landingCovered) && (
            <button
              onClick={handleResume}
              disabled={resuming}
              className="mt-3 w-full rounded-lg bg-[#17235E] py-[10px] font-semibold text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resuming ? 'Resuming…' : 'Resume claim'}
            </button>
          )}

          <div className="mt-3 flex items-center justify-center">
            <TextButton className="" onClick={() => router.push('/')}>
              Back to Main Screen
            </TextButton>
          </div>
        </div>
      </div>
    </RootStyle>
  )
}

export default function FeeJuicePage() {
  return (
    <Suspense fallback={null}>
      <FeeJuicePageInner />
    </Suspense>
  )
}
