'use client'

import React, { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@iconify/react'
import RootStyle from '@/components/RootStyle'
import BridgeHeader from '@/components/BridgeHeader'
import FeeJuiceTopUp from '@/components/FeeJuiceTopUp'
import TextButton from '@/components/TextButton'
import { useL2FeeJuiceBalance, useL2PrivateFeeJuiceBalance } from '@/hooks/useL2Operations'
import { useBridgeOperations, decryptOperationPayload } from '@/hooks/useBridgeOperations'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useWalletStore } from '@/stores/walletStore'
import { useToast } from '@/hooks/useToast'
import { isResumable, hasPossibleLockedFunds } from '@/utils/resumability'
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

  const showPrivate = isPrivacyModeEnabled && !!BRIDGED_FPC_ADDRESS

  return (
    <RootStyle className="min-h-0 max-h-[calc(90vh-2rem)] overflow-hidden">
      <div className="flex h-full max-h-[calc(90vh-2rem)] flex-col overflow-hidden">
        <div className="px-5 pt-5">
          <div className="flex items-center gap-4">
            <BridgeHeader />
          </div>
        </div>

        <div className="px-5 pb-5 min-h-0 flex-1 overflow-y-auto">
          <div className="mt-2 flex items-center gap-2">
            <Icon icon="ph:gas-pump-fill" width={20} height={20} className="text-[#17235E]" />
            <h1 className="text-16 font-semibold text-latest-black-100">Fee Juice</h1>
          </div>
          <p className="mt-1 text-12 leading-[16px] text-latest-grey-500">
            Fee Juice is gas on Aztec. Top up here anytime.
          </p>

          {/* Resume-after-topup context banner — only when arriving from a stuck claim. */}
          {fromResume && (
            <div className="mt-3 flex items-center gap-1.5 rounded-md bg-[#D92D20]/[0.08] px-2.5 py-2">
              <Icon icon="ph:warning-circle-fill" width={14} height={14} className="flex-shrink-0 text-[#D92D20]" />
              <p className="text-11 leading-[15px] text-[#737373]">
                <span className="font-semibold text-[#D92D20]">Claim ran short on L2 gas.</span> Add Fee Juice, then
                resume — your funds stay safe.
              </p>
            </div>
          )}

          {/* Current L2 Fee Juice balance */}
          <div className="mt-3 rounded-md bg-[#F5F5F5] p-3">
            <div className="flex items-center justify-between">
              <span className="text-13 font-medium text-latest-grey-700">Your L2 Fee Juice</span>
              {fjLoading ? (
                <span className="inline-block h-3 w-14 bg-neutral-300 rounded animate-pulse" />
              ) : (
                <span className="text-14 font-semibold text-latest-black-100">{feeJuiceBalance ?? '--'} FJ</span>
              )}
            </div>
            {showPrivate && (
              <div className="mt-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1 text-11 text-latest-grey-500">
                  <Icon icon="ph:lock-key-fill" width={11} height={11} className="text-[#81133B]" />
                  Private Fee Juice
                </span>
                {privateFjLoading ? (
                  <span className="inline-block h-2.5 w-12 bg-neutral-300 rounded animate-pulse" />
                ) : (
                  <span className="text-12 font-semibold text-latest-black-100">{privateFeeJuiceBalance ?? '--'} FJ</span>
                )}
              </div>
            )}
          </div>

          {/* Reusable buy + bridge Fee Juice form (auto + manual). */}
          <div className="mt-3">
            <FeeJuiceTopUp
              isPrivacyModeEnabled={isPrivacyModeEnabled}
              feeJuiceBalance={feeJuiceBalance}
              privateFeeJuiceBalance={privateFeeJuiceBalance}
              onSuccess={() => setToppedUp(true)}
            />
          </div>

          {/* Prominent "Resume claim" after a successful top-up, when we came from a stuck claim. */}
          {fromResume && toppedUp && (
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
