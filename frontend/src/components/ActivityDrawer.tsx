'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { formatUnits } from 'viem'
import type { BridgeOperation, RecoveryClaimData, RecoveryWithdrawalData } from '@human.tech/clean.sdk'
import { useBridgeOperations, decryptOperationPayload } from '@/hooks/useBridgeOperations'
import { useWalletStore } from '@/stores/walletStore'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useToast } from '@/hooks/useToast'
import { isResumable, hasPossibleLockedFunds } from '@/utils/resumability'
import { L1_TOKEN_METADATA } from '@/config'
import { BridgeDirection } from '@/types/bridge'

// Motion values mirrored from the human-tech design system (docs/tokens.css).
// --dur-normal / --ease-default for inline content reveals; --dur-enter /
// --ease-slide for the panel that slides out from the card edge.
const DS_DUR_NORMAL = 0.28
const DS_DUR_ENTER = 0.32
const DS_EASE_DEFAULT: [number, number, number, number] = [0.4, 0, 0.2, 1]
const DS_EASE_SLIDE: [number, number, number, number] = [0.32, 0.72, 0, 1]

type StatusMeta = { label: string; className: string }

const STATUS_META: Record<string, StatusMeta> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  deposited: { label: 'Deposited', className: 'bg-blue-100 text-blue-800' },
  claimed: { label: 'Claimed', className: 'bg-purple-100 text-purple-800' },
  submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-800' },
  ready: { label: 'Ready', className: 'bg-indigo-100 text-indigo-800' },
  pending_finalize: { label: 'Finalizing', className: 'bg-indigo-100 text-indigo-800' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
}

const MAX_VISIBLE_OPS = 5

// Recent-bridge-operations peek, mirroring BridgeStepsRail's drawer pattern but
// on the card's right edge. Reuses useBridgeOperations for data and duplicates
// only the resume/decrypt flow from /activity — everything else (share fuel
// claim links, full history) stays on the full Activity page we link out to.
const ActivityDrawer: React.FC = () => {
  const router = useRouter()
  const notify = useToast()
  const panelId = useId()
  const prefersReducedMotion = useReducedMotion()

  const { waapAddress: l1Address, signWaapMessage } = useWalletStore()
  const { setRecovery, setWithdrawalRecovery, setDirection } = useBridgeStore()
  const { data: operations, isLoading } = useBridgeOperations()

  // Desktop drawer: hover previews it, a click pins it open. Mobile: a
  // separate collapsed-by-default accordion stacked below the card.
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [resumingId, setResumingId] = useState<string | null>(null)
  const desktopOpen = hovered || pinned
  const drawerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLButtonElement>(null)

  const closeDesktop = () => {
    setPinned(false)
    setHovered(false)
    handleRef.current?.focus()
  }

  // Esc + outside click close a pinned desktop drawer. Only wired up while
  // pinned so hover-only previews don't pay for a global listener.
  useEffect(() => {
    if (!pinned) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPinned(false)
      setHovered(false)
      handleRef.current?.focus()
    }
    const onPointerDown = (e: PointerEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setPinned(false)
        setHovered(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [pinned])

  const recentOps = useMemo(() => {
    if (!operations) return []
    return [...operations]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_VISIBLE_OPS)
  }, [operations])

  const needsAttention = recentOps.some(
    (op) => isResumable(op) || hasPossibleLockedFunds(op) || op.status === 'failed',
  )

  const handleResume = async (operation: BridgeOperation) => {
    if (!l1Address) {
      notify('error', 'Please connect your Ethereum wallet first')
      return
    }

    setResumingId(operation.id)
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

      setPinned(false)
      setHovered(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to decrypt'
      notify('error', msg)
    } finally {
      setResumingId(null)
    }
  }

  const renderOp = (op: BridgeOperation) => {
    const decimals = op.tokenDecimalsL1 ?? L1_TOKEN_METADATA.decimals
    const tokenSymbol = op.tokenSymbol ?? op.tokenSymbolL1 ?? L1_TOKEN_METADATA.symbol
    const amount = op.amountDisplayL1 ?? (op.amountL1 ? formatUnits(BigInt(op.amountL1), decimals) : '?')
    const date = new Date(op.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const directionLabel = op.direction === 'L1_TO_L2' ? 'L1 → L2' : 'L2 → L1'
    const meta = STATUS_META[op.status] ?? { label: op.status, className: 'bg-gray-100 text-gray-800' }
    const showResume = isResumable(op) || hasPossibleLockedFunds(op)

    return (
      <li key={op.id} className="border-b border-[#F0F0F0] py-2.5 last:border-b-0 last:pb-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-[#0A0A0A]">{directionLabel}</span>
          <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.className}`}>
            {meta.label}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#0A0A0A]">
            {amount} {tokenSymbol}
          </span>
          <span className="flex-shrink-0 text-[11px] text-[#989898]">{date}</span>
        </div>
        {showResume && (
          <button
            onClick={() => handleResume(op)}
            disabled={resumingId === op.id}
            className="mt-1.5 rounded-md bg-[#17235E] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#17235E]/90 disabled:opacity-50"
          >
            {resumingId === op.id ? 'Decrypting…' : 'Resume'}
          </button>
        )}
      </li>
    )
  }

  const panelBody = (onClose?: () => void) => (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#989898]">Bridge activity</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[#989898] transition-colors hover:bg-[#F0F0F0] hover:text-[#0A0A0A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17235E]/40"
          >
            <Icon icon="ph:x-bold" width={13} height={13} />
          </button>
        )}
      </div>
      {isLoading && <p className="text-[12px] text-[#989898]">Loading…</p>}
      {!isLoading && recentOps.length === 0 && (
        <p className="text-[12px] text-[#989898]">No bridge operations yet.</p>
      )}
      {recentOps.length > 0 && <ul className="flex flex-col">{recentOps.map(renderOp)}</ul>}
      <div className="mt-3 flex flex-col gap-1.5 border-t border-[#F0F0F0] pt-3">
        <button
          onClick={() => router.push('/activity')}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[#737373] transition-colors hover:text-[#0A0A0A]"
        >
          <Icon icon="ph:list-bullets" width={15} height={15} />
          View full activity
        </button>
        <button
          onClick={() => router.push('/activity/local-recovery')}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[#81133B] transition-colors hover:text-[#81133B]/80"
        >
          <Icon icon="ph:key" width={15} height={15} />
          Recover from local backup
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile / narrow: a collapsed-by-default bar stacked below the card so
          it never crowds it. Hidden at md+ where the drawer below takes over. */}
      <div className="w-full max-w-[360px] md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-controls={`${panelId}-mobile`}
          className="flex w-full items-center justify-between rounded-[16px] border border-[#D4D4D4] bg-white px-4 py-3 text-left"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#989898]">
            Bridge activity
          </span>
          <Icon
            icon="ph:caret-down-bold"
            width={14}
            height={14}
            className={`text-[#737373] transition-transform ${mobileOpen ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence initial={false}>
          {mobileOpen && (
            <motion.div
              id={`${panelId}-mobile`}
              key="mobile-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : DS_DUR_NORMAL, ease: DS_EASE_DEFAULT }}
              className="overflow-hidden"
            >
              <div className="mt-2 rounded-[16px] border border-[#D4D4D4] bg-white p-4">
                {panelBody(() => setMobileOpen(false))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop: a slim handle flush against the card's right edge. Hover or
          click peeks the full activity panel out to the right. This whole block is
          absolutely positioned against RootStyle's card-sized wrapper, so it
          never contributes to layout width and can't push the card off-center.
          Mirrors BridgeStepsRail, but the handle sits first (flush to the card)
          with the panel expanding away from it, since this drawer opens rightward. */}
      <div
        ref={drawerRef}
        className="absolute left-full top-3 z-10 hidden items-start md:flex"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          ref={handleRef}
          type="button"
          aria-expanded={desktopOpen}
          aria-controls={panelId}
          aria-label="Bridge activity"
          onClick={() => setPinned((p) => !p)}
          className={`flex h-[120px] w-9 flex-shrink-0 flex-col items-center justify-center gap-2 rounded-r-[12px] border border-l-0 bg-white transition-colors ${
            desktopOpen ? 'border-[#17235E]/40' : 'border-[#D4D4D4] hover:border-[#17235E]/30'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${needsAttention ? 'bg-[#81133B]' : 'bg-[#17235E]'}`} />
          <span
            className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#737373]"
            style={{ writingMode: 'vertical-rl' }}
          >
            Activity
          </span>
        </button>

        <motion.div
          initial={false}
          animate={{
            width: desktopOpen ? 280 : 0,
            marginLeft: desktopOpen ? 12 : 0,
            opacity: desktopOpen ? 1 : 0,
          }}
          transition={{ duration: prefersReducedMotion ? 0 : DS_DUR_ENTER, ease: DS_EASE_SLIDE }}
          className="overflow-hidden"
        >
          <div
            id={panelId}
            className="w-[280px] rounded-[16px] border border-[#D4D4D4] bg-white p-4 shadow-[0px_15px_34px_0px_rgba(0,0,0,0.10)]"
          >
            {panelBody(closeDesktop)}
          </div>
        </motion.div>
      </div>
    </>
  )
}

export default ActivityDrawer
