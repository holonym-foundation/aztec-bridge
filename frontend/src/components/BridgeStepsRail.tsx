'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useWalletStore } from '@/stores/walletStore'
import { useAttestationCheck } from '@/hooks/useAttestationCheck'
import { useL2FeeJuiceBalance, useClaimFeeEstimate } from '@/hooks/useL2Operations'
import { useExplainerStore } from '@/stores/useExplainerStore'
import { EXPLAINER_STEPS } from '@/components/model/HowItWorksModal'
import { POCH_MINT_URL } from '@/config'

// Motion values mirrored from the human-tech design system (docs/tokens.css):
// --dur-enter / --ease-slide for the panel that slides out from the tab.
const DS_DUR_ENTER = 0.32
const DS_EASE_SLIDE: [number, number, number, number] = [0.32, 0.72, 0, 1]

// Shared right-edge peek coordination (#160): each binder tab announces its open
// state; a tab that sees another open closes itself, so only one peeks at a time.
const PEEK_EVENT = 'shield:peek'
type PeekSignal = { id: string; open: boolean }

// Human Passport builder (matches VerificationStep's constant). Clean Hands mint
// comes from config so it tracks the active network (sandbox vs production).
const PASSPORT_BUILD_URL = 'https://app.passport.xyz'

const ACTION_PRIMARY =
  'mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#17235E] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#17235E]/90'
const ACTION_SECONDARY =
  'mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#D4D4D4] px-3 py-1.5 text-[12px] font-semibold text-[#17235E] transition-colors hover:border-[#17235E]/50'

type StepStatus = 'done' | 'active' | 'upcoming'

type BridgeStepsRailProps = { variant?: 'rail' | 'dock' }

const BridgeStepsRail: React.FC<BridgeStepsRailProps> = ({ variant = 'rail' }) => {
  const isDock = variant === 'dock'
  const { isWaapConnected, isAztecConnected, connectWaapWallet, connectAztecWallet } = useWalletStore()
  const attestation = useAttestationCheck()
  const { openModal } = useExplainerStore()
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const panelId = useId()
  const peekId = useId()

  // Hover previews the panel; a click pins it open. On touch (no hover) the tap
  // toggles `pinned`, so the same handle works on every size.
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  // The panel is anchored to the tab's bottom and grows UPWARD (#229), so it
  // never spills below the tab into the floating chat widget. Cap its height to
  // the room above the tab's bottom edge so the header and footer stay on-screen.
  const [maxPanelHeight, setMaxPanelHeight] = useState<number | undefined>(undefined)
  const open = hovered || pinned
  const drawerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLButtonElement>(null)

  const closeDesktop = () => {
    setPinned(false)
    setHovered(false)
    handleRef.current?.focus()
  }

  // ── Peek coordination (#160): announce our open state; close on a sibling's.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent<PeekSignal>(PEEK_EVENT, { detail: { id: peekId, open } }))
  }, [open, peekId])

  useEffect(() => {
    const onPeek = (e: Event) => {
      const detail = (e as CustomEvent<PeekSignal>).detail
      if (!detail || detail.id === peekId || !detail.open) return
      setHovered(false)
      setPinned(false)
    }
    window.addEventListener(PEEK_EVENT, onPeek)
    return () => window.removeEventListener(PEEK_EVENT, onPeek)
  }, [peekId])

  // The first step needs BOTH wallets. Name the specific one still missing and
  // drive its real connect handler (the same ones the main bridge button uses):
  // Ethereum first when neither is connected, otherwise whichever is left.
  const nextWallet: 'ethereum' | 'aztec' = !isWaapConnected ? 'ethereum' : 'aztec'
  const connectLabel = nextWallet === 'aztec' ? 'Connect Aztec Wallet' : 'Connect Ethereum Wallet'
  const handleConnect = () => {
    if (nextWallet === 'aztec') connectAztecWallet().catch(() => {})
    else connectWaapWallet().catch(() => {})
  }

  const bothConnected = isWaapConnected && isAztecConnected
  const eligible = !!attestation.data?.eligible
  const verifying = bothConnected && attestation.isFetching && !attestation.data

  // Step-3 fuel affordance is context-aware (#236): only nudge a Fee Juice top-up when the
  // user is actually short. Compare existing FJ against the worst-case L2 claim gas — the same
  // "covered" test FuelToggle/FeeJuiceTopUp use (existing balance >= estimated claim gas). The
  // tutorial has no fuel-mode selector, so it reads the PUBLIC balance (the app default when
  // Privacy Mode is off); the bridge form still surfaces private-mode sufficiency on its own.
  const { data: l2FeeJuiceBalance } = useL2FeeJuiceBalance()
  const { data: claimFeeLimit } = useClaimFeeEstimate('public')
  const existingFj = l2FeeJuiceBalance != null && l2FeeJuiceBalance !== '--' ? Number(l2FeeJuiceBalance) : 0
  const needFj = claimFeeLimit != null ? Number(claimFeeLimit) / 1e18 : null
  // Covered = existing FJ meets the claim estimate. While the estimate is still loading, fall
  // back to "holds any FJ" so an already-funded owner is never told to top up.
  const feeJuiceCovered = needFj != null ? existingFj >= needFj : existingFj > 0

  // Single "you are here" pointer. We can reliably observe progress through
  // verification from global state; the deposit/claim step stays upcoming since
  // its live state lives in the bridge form.
  const currentStep = !bothConnected ? 0 : !eligible ? 1 : 2

  const statusFor = (index: number): StepStatus =>
    index < currentStep ? 'done' : index === currentStep ? 'active' : 'upcoming'

  const helperFor = (index: number): string | null => {
    if (index !== currentStep) return null
    if (index === 0) {
      if (isWaapConnected || isAztecConnected) return 'One wallet connected. Connect the other to continue.'
      return EXPLAINER_STEPS[0].body
    }
    if (index === 1) {
      if (verifying) return 'Checking your verification…'
      // Generic guidance only — never surface the raw attestation/binding reason
      // here (e.g. "L1 address 0x… is already bound to a different L2 address").
      // Binding problems are communicated via the wallet-cluster notice/toast
      // (and later a notifications tab), not the tutorial (#118/#121).
      if (attestation.data && !attestation.data.eligible) {
        return 'A one-time humanity check is required before your first bridge.'
      }
      return EXPLAINER_STEPS[1].body
    }
    if (index === 2) {
      // The "optionally top up so you can transact as soon as tokens land" framing only makes
      // sense when the user has no fuel yet. Once covered, reflect that instead of nudging.
      if (feeJuiceCovered) {
        return 'You already have enough Fee Juice for L2 gas, so you can transact as soon as your tokens land.'
      }
      return EXPLAINER_STEPS[2].body
    }
    return EXPLAINER_STEPS[index].body
  }

  // Per-step action that routes the user to the next thing to do (#175). Only the
  // active step surfaces one, so the tutorial reads as "here is your next move".
  const actionFor = (index: number): React.ReactNode => {
    if (index !== currentStep) return null
    if (index === 0) {
      return (
        <button type="button" onClick={handleConnect} className={ACTION_PRIMARY}>
          <Icon icon="ph:wallet" width={14} height={14} />
          {connectLabel}
        </button>
      )
    }
    if (index === 1) {
      // Smaller amounts pass with a Human Passport score; larger amounts (or the
      // Clean-Hands path) mint Proof of Clean Hands. Offer both.
      return (
        <div className="flex flex-wrap gap-2">
          <a href={PASSPORT_BUILD_URL} target="_blank" rel="noopener noreferrer" className={ACTION_PRIMARY}>
            <Icon icon="ph:identification-card" width={14} height={14} />
            Verify with Human Passport
          </a>
          <a href={POCH_MINT_URL} target="_blank" rel="noopener noreferrer" className={ACTION_SECONDARY}>
            <Icon icon="ph:seal-check" width={14} height={14} />
            Proof of Clean Hands
          </a>
        </div>
      )
    }
    if (index === 2) {
      // Covered: no top-up call-to-action. A calm check + a subtle "Top up more" link at most.
      if (feeJuiceCovered) {
        return (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#17235E]/[0.08] px-2.5 py-1.5 text-[12px] font-semibold text-[#17235E]">
              <Icon icon="ph:check-circle-fill" width={14} height={14} className="text-[#17235E]" />
              You have enough Fee Juice
            </span>
            <button
              type="button"
              onClick={() => router.push('/fee-juice')}
              className="text-[12px] font-medium text-[#17235E] underline underline-offset-2 transition-opacity hover:opacity-80"
            >
              Top up more
            </button>
          </div>
        )
      }
      return (
        <button type="button" onClick={() => router.push('/fee-juice')} className={ACTION_PRIMARY}>
          <Icon icon="ph:gas-pump" width={14} height={14} />
          Top up Fee Juice
        </button>
      )
    }
    return null
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

  // Measure the space above the tab's bottom edge and cap the panel to it, so the
  // upward-growing panel is never clipped by the viewport top (or, on short
  // screens, forced to overlap the chat widget below). Re-measures on resize.
  useEffect(() => {
    if (!open) return
    const measure = () => {
      const rect = handleRef.current?.getBoundingClientRect()
      if (!rect) return
      setMaxPanelHeight(Math.max(160, Math.round(rect.bottom - 12)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  const stepsList = (
    <ol className="flex flex-col">
      {EXPLAINER_STEPS.map((step, i) => {
        const status = statusFor(i)
        const helper = helperFor(i)
        const isLast = i === EXPLAINER_STEPS.length - 1
        return (
          <li key={step.title} className="flex gap-3">
            {/* Marker + connector */}
            <div className="flex flex-col items-center">
              <span
                className={
                  status === 'done'
                    ? 'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] text-white'
                    : status === 'active'
                      ? 'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#17235E] bg-[#E5EFFF] text-[11px] font-semibold text-[#17235E]'
                      : 'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[#D4D4D4] text-[11px] font-semibold text-[#B7B7B7]'
                }
              >
                {status === 'done' ? <Icon icon="ph:check-bold" width={13} height={13} /> : i + 1}
              </span>
              {!isLast && (
                <span className={`my-1 w-px flex-1 ${status === 'done' ? 'bg-[#0A0A0A]' : 'bg-[#E5E5E5]'}`} />
              )}
            </div>

            {/* Label + active helper */}
            <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
              <p
                className={
                  status === 'upcoming'
                    ? 'text-[13px] font-medium text-[#B7B7B7]'
                    : 'text-[13px] font-semibold text-[#0A0A0A]'
                }
              >
                {step.title}
              </p>
              {helper && (
                <p className="mt-0.5 text-[12px] leading-[17px] text-[#737373] break-words [overflow-wrap:anywhere]">
                  {helper}
                </p>
              )}
              {i === 1 && status === 'active' && (
                <button
                  onClick={openModal}
                  className="mt-1 block text-[12px] font-medium text-latest-blue-100 underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  Why is this needed?
                </button>
              )}
              {actionFor(i)}
            </div>
          </li>
        )
      })}
    </ol>
  )

  const panelBody = (onClose?: () => void) => (
    <>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#989898]">Bridge in 4 steps</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[#989898] transition-colors hover:bg-[#F0F0F0] hover:text-[#0A0A0A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#81133B]/40"
          >
            <Icon icon="ph:x-bold" width={13} height={13} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{stepsList}</div>
      <div className="mt-1 shrink-0 border-t border-[#F0F0F0] pt-3">
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[#737373] hover:text-[#0A0A0A] transition-colors"
        >
          <Icon icon="ph:question" width={15} height={15} />
          See the full walkthrough
        </button>
      </div>
    </>
  )

  // Narrow-viewport dock (#243): a compact round icon button that lives in the
  // bottom-left mobile dock. It keeps the graduation-cap identity + the status
  // dot and opens the same steps panel as a bottom-anchored sheet that stays
  // on-screen on phones. The desktop right-edge rail below is unchanged.
  if (isDock) {
    return (
      <div
        ref={drawerRef}
        className="pointer-events-auto relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: prefersReducedMotion ? 0 : DS_DUR_ENTER, ease: DS_EASE_SLIDE }}
              className="fixed bottom-[76px] left-4 z-40 w-[300px] max-w-[calc(100vw-2rem)]"
            >
              <div
                id={panelId}
                className="flex max-h-[70dvh] flex-col rounded-[16px] border border-[#D4D4D4] bg-white p-4 shadow-[0px_15px_34px_0px_rgba(0,0,0,0.10)]"
              >
                {panelBody(closeDesktop)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          ref={handleRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label="Bridge in 4 steps"
          onClick={() => setPinned((p) => !p)}
          className={`relative flex h-11 w-11 items-center justify-center rounded-full border bg-white shadow-[0px_6px_16px_0px_rgba(0,0,0,0.12)] transition-colors ${
            open ? 'border-[#81133B]/40' : 'border-[#D4D4D4]'
          }`}
        >
          <Icon icon="ph:graduation-cap" width={18} height={18} className="text-[#737373]" aria-hidden="true" />
          <span
            aria-hidden="true"
            className={`absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-white ${
              eligible && bothConnected ? 'bg-[#17235E]' : 'bg-[#81133B]'
            }`}
          />
        </button>
      </div>
    )
  }

  // A slim binder tab pinned to the viewport's right edge (stacked with the
  // Activity + Messages tabs by the dock in ClientLayout). Hover or click peeks
  // the steps panel out to the LEFT of the tab. The panel is absolutely
  // positioned so opening it never reflows (splits apart) the sibling tabs
  // (#114). The whole drawer lives in a fixed dock, so it can't add page width or
  // scroll and it persists across every app screen.
  return (
    <div
      ref={drawerRef}
      className="pointer-events-auto relative flex items-center justify-end"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : DS_DUR_ENTER, ease: DS_EASE_SLIDE }}
            className="absolute bottom-0 right-[calc(100%_+_12px)] overflow-hidden"
          >
            <div
              id={panelId}
              style={{ maxHeight: maxPanelHeight }}
              className="flex max-h-[calc(100dvh-1.5rem)] w-[260px] flex-col rounded-[16px] border border-[#D4D4D4] bg-white p-4 shadow-[0px_15px_34px_0px_rgba(0,0,0,0.10)]"
            >
              {panelBody(closeDesktop)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        ref={handleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Bridge in 4 steps"
        onClick={() => setPinned((p) => !p)}
        className={`flex h-[120px] flex-shrink-0 flex-col items-center justify-center gap-2 rounded-l-[12px] border border-r-0 bg-white transition-[width,border-color] duration-200 ease-out ${
          open ? 'border-[#81133B]/40' : 'border-[#D4D4D4] hover:border-[#81133B]/30'
        } ${open && !prefersReducedMotion ? 'w-[42px]' : 'w-9'}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${eligible && bothConnected ? 'bg-[#17235E]' : 'bg-[#81133B]'}`} />
        <Icon icon="ph:graduation-cap" width={15} height={15} className="text-[#737373]" aria-hidden="true" />
        <span
          className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#737373]"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Tutorial
        </span>
      </button>
    </div>
  )
}

export default BridgeStepsRail
