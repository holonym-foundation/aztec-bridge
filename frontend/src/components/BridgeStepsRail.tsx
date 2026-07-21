'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useWalletStore } from '@/stores/walletStore'
import { useAttestationCheck } from '@/hooks/useAttestationCheck'
import { useExplainerStore } from '@/stores/useExplainerStore'
import { EXPLAINER_STEPS } from '@/components/model/HowItWorksModal'

type StepStatus = 'done' | 'active' | 'upcoming'

const BridgeStepsRail: React.FC = () => {
  const { isWaapConnected, isAztecConnected } = useWalletStore()
  const attestation = useAttestationCheck()
  const { openModal } = useExplainerStore()
  const prefersReducedMotion = useReducedMotion()
  const panelId = useId()

  // Desktop drawer: hover previews it, a click pins it open. Mobile: a
  // separate collapsed-by-default accordion stacked below the card.
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const desktopOpen = hovered || pinned
  const drawerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLButtonElement>(null)

  const closeDesktop = () => {
    setPinned(false)
    setHovered(false)
    handleRef.current?.focus()
  }

  const bothConnected = isWaapConnected && isAztecConnected
  const eligible = !!attestation.data?.eligible
  const verifying = bothConnected && attestation.isFetching && !attestation.data

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
      if (attestation.data && !attestation.data.eligible) {
        return attestation.data.reason || 'A one-time humanity check is required before your first bridge.'
      }
      return EXPLAINER_STEPS[1].body
    }
    return EXPLAINER_STEPS[index].body
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
                  className="mt-1 text-[12px] font-medium text-latest-blue-100 underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  Why is this needed?
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )

  const panelBody = (onClose?: () => void) => (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
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
      {stepsList}
      <div className="mt-1 border-t border-[#F0F0F0] pt-3">
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
            Bridge in 4 steps
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
              transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-2 rounded-[16px] border border-[#D4D4D4] bg-white p-4">
                {panelBody(() => setMobileOpen(false))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop: a slim handle flush against the card's left edge. Hover or
          click peeks the full steps panel out to the left. This whole block is
          absolutely positioned against RootStyle's card-sized wrapper, so it
          never contributes to layout width and can't push the card off-center. */}
      <div
        ref={drawerRef}
        className="absolute right-full top-3 z-10 hidden items-start md:flex"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <motion.div
          initial={false}
          animate={{
            width: desktopOpen ? 260 : 0,
            marginRight: desktopOpen ? 12 : 0,
            opacity: desktopOpen ? 1 : 0,
          }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div
            id={panelId}
            className="w-[260px] rounded-[16px] border border-[#D4D4D4] bg-white p-4 shadow-[0px_15px_34px_0px_rgba(0,0,0,0.10)]"
          >
            {panelBody(closeDesktop)}
          </div>
        </motion.div>

        <button
          ref={handleRef}
          type="button"
          aria-expanded={desktopOpen}
          aria-controls={panelId}
          aria-label="Bridge in 4 steps"
          onClick={() => setPinned((p) => !p)}
          className={`flex h-[120px] w-9 flex-shrink-0 flex-col items-center justify-center gap-2 rounded-l-[12px] border border-r-0 bg-white transition-colors ${
            desktopOpen ? 'border-[#81133B]/40' : 'border-[#D4D4D4] hover:border-[#81133B]/30'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${eligible && bothConnected ? 'bg-[#17235E]' : 'bg-[#81133B]'}`} />
          <span
            className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#737373]"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Tutorial
          </span>
        </button>
      </div>
    </>
  )
}

export default BridgeStepsRail
