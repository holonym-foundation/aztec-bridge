'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@iconify/react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { usePathname, useRouter } from 'next/navigation'
import { useOnboardingStore } from '@/stores/useOnboardingStore'
import { useExplainerStore } from '@/stores/useExplainerStore'
import { useBridgeTutorial } from '@/components/BridgeStepsRail'
import { EXPLAINER_STEPS } from '@/components/model/HowItWorksModal'
import { POCH_MINT_URL } from '@/config'

const DS_DUR_ENTER = 0.32
const DS_EASE_SLIDE: [number, number, number, number] = [0.32, 0.72, 0, 1]

// The tour is the splash's last act, so it speaks the onboarding palette (Shield
// maroon on warm ink over rose-tinted borders) rather than the neutral navy the
// in-app tutorial panel uses for persistent chrome.
const BRAND = '#81133B'
const INK = '#1c1116'
const MUTED = '#5a4650'
const HAIRLINE = '#f0d3e0'
const OUTLINE = '#eccfdc'

const PILL =
  'inline-flex items-center gap-1.5 rounded-full bg-[#81133B] px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter,transform] duration-150 hover:-translate-y-px hover:brightness-110'
const PILL_OUTLINE =
  'inline-flex items-center gap-1.5 rounded-full border border-[#eccfdc] px-3.5 py-2 text-[13px] font-semibold text-[#81133B] transition-colors duration-150 hover:bg-[#81133B]/[0.06]'

const PASSPORT_BUILD_URL = 'https://app.passport.xyz'

const BUBBLE_WIDTH = 320
const GAP = 14
const MARGIN = 12
// Below this width the bridge card fills the viewport, so there is no side or
// vertical gutter a pointed bubble could occupy without covering the very
// control it describes. Dock it to the bottom edge instead.
const COMPACT_VIEWPORT = 640

// The tour narrates the same four steps as the tutorial panel, then closes on a
// fifth bubble that shows where that panel lives. `anchor` names the control the
// step is about, matched against `data-tour` in the DOM.
const TOUR_STEPS: Array<{ anchor: string; title?: string; body: string }> = [
  {
    anchor: 'action',
    body: 'Shield moves tokens between two networks, so it needs a wallet on each. Your Ethereum wallet pays for and signs the deposit. Your Aztec wallet receives the tokens and claims them at the end. This button always names whichever one is still missing.',
  },
  {
    anchor: 'action',
    body: 'The bridge contracts require a humanity proof before a first deposit, so it isn’t something the app can skip for you. Proof of Clean Hands covers any amount; a Human Passport score covers smaller transfers. Neither reveals who you are, and you only do it once.',
  },
  {
    anchor: 'amount',
    body: 'Choose a token and type how much to send. Aztec charges gas in Fee Juice rather than ETH, and the final claim has to pay its own gas, so an account holding none can’t collect its tokens. Leave the gas top-up on and a slice of this amount is swapped into Fee Juice in the same transaction.',
  },
  {
    anchor: 'action',
    body: 'Approve the deposit on Ethereum and the transfer starts. Your tokens travel to Aztec and are claimed for you, usually within 15 to 50 minutes. You can close the tab: Activity keeps the transfer and lets you pick it back up.',
  },
  {
    anchor: 'tutorial',
    title: 'Your checklist lives here',
    body: 'This tab keeps the same four steps, ticked off as you go, with your next move on top. Open it whenever you lose the thread.',
  },
]

type Spot = { top: number; left: number; width: number; height: number; radius: number }
type Pos = { top: number; left: number; arrow: 'top' | 'bottom' | 'left' | 'right' | null; arrowOffset: number }

// Both rail variants stay mounted and only CSS decides which is on screen, so a
// plain querySelector would happily return the hidden one and park the bubble
// off-viewport. A zero-sized rect is the reliable tell for "display: none".
const findAnchor = (name: string): HTMLElement | null => {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`))
  return nodes.find((node) => node.getBoundingClientRect().width > 0) ?? null
}

// The wallet picker, the emoji check and the verification panel all take over the
// bridge card from inside it, so a bubble sitting above them hides the very
// control the step just told the user to use. They mark themselves and the tour
// steps aside until they close.
const BLOCKER_SELECTOR = '[data-tour-blocks]'

const place = (spot: Spot, bw: number, bh: number, vw: number, vh: number): Pos => {
  const cx = spot.left + spot.width / 2
  const cy = spot.top + spot.height / 2
  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), Math.max(MARGIN, vw - bw - MARGIN))
  const clampY = (y: number) => Math.min(Math.max(y, MARGIN), Math.max(MARGIN, vh - bh - MARGIN))
  const offsetIn = (center: number, edge: number, size: number) =>
    Math.round(Math.min(Math.max(center - edge, 20), Math.max(20, size - 20)))

  if (vh - (spot.top + spot.height) >= bh + GAP + MARGIN) {
    const left = clampX(cx - bw / 2)
    return { top: Math.round(spot.top + spot.height + GAP), left, arrow: 'top', arrowOffset: offsetIn(cx, left, bw) }
  }
  if (spot.top >= bh + GAP + MARGIN) {
    const left = clampX(cx - bw / 2)
    return { top: Math.round(spot.top - bh - GAP), left, arrow: 'bottom', arrowOffset: offsetIn(cx, left, bw) }
  }
  if (spot.left >= bw + GAP + MARGIN) {
    const top = clampY(cy - bh / 2)
    return { top, left: Math.round(spot.left - bw - GAP), arrow: 'right', arrowOffset: offsetIn(cy, top, bh) }
  }
  if (vw - (spot.left + spot.width) >= bw + GAP + MARGIN) {
    const top = clampY(cy - bh / 2)
    return {
      top,
      left: Math.round(spot.left + spot.width + GAP),
      arrow: 'left',
      arrowOffset: offsetIn(cy, top, bh),
    }
  }
  return { top: clampY(cy - bh / 2), left: clampX(cx - bw / 2), arrow: null, arrowOffset: 0 }
}

const DoneChip: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#81133B]/[0.08] px-3 py-1.5 text-[13px] font-semibold text-[#81133B]">
    <Icon icon="ph:check-circle-fill" width={14} height={14} />
    {label}
  </span>
)

const ShieldTour: React.FC = () => {
  const tourOpen = useOnboardingStore((s) => s.tourOpen)
  const endTour = useOnboardingStore((s) => s.endTour)
  const requestShowSteps = useOnboardingStore((s) => s.requestShowSteps)
  const { openModal } = useExplainerStore()
  const tutorial = useBridgeTutorial()
  const router = useRouter()
  const pathname = usePathname()
  const prefersReducedMotion = useReducedMotion()

  const [index, setIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [spot, setSpot] = useState<Spot | null>(null)
  const [pos, setPos] = useState<Pos | null>(null)
  const [compact, setCompact] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const bubbleRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const step = TOUR_STEPS[index]
  const isLast = index === TOUR_STEPS.length - 1

  const finish = () => {
    endTour()
    requestShowSteps()
  }

  // Opening the tour must not depend on the route or on how far along the user
  // already is, or a re-render of either would restart the tour under them.
  const latest = useRef({ pathname, currentStep: tutorial.currentStep })
  latest.current = { pathname, currentStep: tutorial.currentStep }
  const seenStep = useRef(tutorial.currentStep)

  useEffect(() => {
    if (!tourOpen) return
    setIndex(0)
    // Progress made before the tour started isn't news, so it must not scroll the
    // opening bubble away: the tour always begins at the explanation.
    seenStep.current = latest.current.currentStep
    // Every anchor except the tutorial tab lives on the bridge screen, so a tour
    // started from Activity or the Top up screen would narrate an empty page.
    if (latest.current.pathname !== '/') router.push('/')
  }, [tourOpen, router])

  // Most people do the thing the bubble describes instead of reading on and
  // clicking Next, so real progress moves the tour. Only forward, and never past
  // where the reader already is: someone reading ahead about Fee Juice shouldn't
  // be dragged back because a wallet just connected.
  useEffect(() => {
    if (!tourOpen) return
    const reached = tutorial.currentStep
    if (reached <= seenStep.current) {
      seenStep.current = reached
      return
    }
    seenStep.current = reached
    setIndex((i) => Math.max(i, Math.min(reached, TOUR_STEPS.length - 1)))
  }, [tourOpen, tutorial.currentStep])

  // Leaving the bridge screen ends the tour. Without this it would keep narrating
  // controls that aren't on the page, dimming a screen it has nothing to point at.
  // `landed` distinguishes that from the opening moment, when the effect above is
  // still on its way to the bridge.
  const landed = useRef(false)
  useEffect(() => {
    if (!tourOpen) {
      landed.current = false
      return
    }
    if (pathname === '/') {
      landed.current = true
      return
    }
    if (landed.current) endTour()
  }, [tourOpen, pathname, endTour])

  // The amount step lives in the card's scrolling region, so it can sit outside
  // the visible area when its bubble comes up.
  useEffect(() => {
    if (!tourOpen) return
    findAnchor(step.anchor)?.scrollIntoView({
      block: 'nearest',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [tourOpen, step.anchor, prefersReducedMotion])

  useEffect(() => {
    if (!tourOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endTour()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [tourOpen, endTour])

  // Anchors move for reasons no single listener covers: the card scrolls, the
  // action button swaps labels and resizes, balances load and reflow the form.
  // A frame loop that only commits a changed rect keeps the bubble pinned through
  // all of it and costs nothing once the tour closes.
  useEffect(() => {
    if (!tourOpen) return
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const vw = window.innerWidth
      const vh = window.innerHeight
      const el = findAnchor(step.anchor)
      const isCompact = vw < COMPACT_VIEWPORT
      setCompact((prev) => (prev === isCompact ? prev : isCompact))
      const isBlocked = !!document.querySelector(BLOCKER_SELECTOR)
      setBlocked((prev) => (prev === isBlocked ? prev : isBlocked))

      if (!el) {
        setSpot((prev) => (prev === null ? prev : null))
        setPos((prev) => (prev === null ? prev : null))
        return
      }
      const rect = el.getBoundingClientRect()
      const radius = Number.parseFloat(window.getComputedStyle(el).borderTopLeftRadius) || 12
      const next: Spot = {
        top: Math.round(rect.top - 6),
        left: Math.round(rect.left - 6),
        width: Math.round(rect.width + 12),
        height: Math.round(rect.height + 12),
        radius: Math.round(radius + 6),
      }
      setSpot((prev) =>
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      )

      if (isCompact) {
        setPos((prev) => (prev === null ? prev : null))
        return
      }
      const bw = bubbleRef.current?.offsetWidth || BUBBLE_WIDTH
      const bh = bubbleRef.current?.offsetHeight || 240
      const p = place(next, bw, bh, vw, vh)
      setPos((prev) =>
        prev && prev.top === p.top && prev.left === p.left && prev.arrow === p.arrow && prev.arrowOffset === p.arrowOffset
          ? prev
          : p,
      )
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [tourOpen, step.anchor])

  const stepAction = (): React.ReactNode => {
    if (index === 0) {
      if (tutorial.bothConnected) return <DoneChip label="Both wallets connected" />
      return (
        <button type="button" onClick={tutorial.handleConnect} className={PILL}>
          <Icon icon="ph:wallet" width={14} height={14} />
          {tutorial.connectLabel}
        </button>
      )
    }
    if (index === 1) {
      if (tutorial.eligible) return <DoneChip label="You’re verified" />
      if (tutorial.verifying) {
        return (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: MUTED }}>
            <Icon icon="ph:circle-notch" width={14} height={14} className="animate-spin" />
            Checking your verification…
          </span>
        )
      }
      return (
        <div className="flex flex-wrap gap-2">
          <a href={PASSPORT_BUILD_URL} target="_blank" rel="noopener noreferrer" className={PILL}>
            <Icon icon="ph:identification-card" width={14} height={14} />
            Verify with Human Passport
          </a>
          <a href={POCH_MINT_URL} target="_blank" rel="noopener noreferrer" className={PILL_OUTLINE}>
            <Icon icon="ph:seal-check" width={14} height={14} />
            Proof of Clean Hands
          </a>
        </div>
      )
    }
    if (index === 2) {
      if (tutorial.feeJuiceCovered) return <DoneChip label="You have enough Fee Juice" />
      return (
        <button
          type="button"
          onClick={() => {
            endTour()
            router.push('/fee-juice')
          }}
          className={PILL_OUTLINE}
        >
          <Icon icon="ph:gas-pump" width={14} height={14} />
          Top up Fee Juice
        </button>
      )
    }
    if (index === 3) {
      return (
        <button
          type="button"
          onClick={() => {
            endTour()
            router.push('/activity')
          }}
          className={PILL_OUTLINE}
        >
          <Icon icon="ph:list-checks" width={14} height={14} />
          Follow in Activity
        </button>
      )
    }
    return (
      <button type="button" onClick={openModal} className={PILL_OUTLINE}>
        <Icon icon="ph:question" width={14} height={14} />
        See the full walkthrough
      </button>
    )
  }

  const title = step.title ?? EXPLAINER_STEPS[index].title
  const eyebrow =
    index < EXPLAINER_STEPS.length ? `Step ${index + 1} of ${EXPLAINER_STEPS.length}` : 'You’re all set'

  const arrowEdge =
    pos?.arrow === 'top'
      ? { top: -6, left: pos.arrowOffset, borderRight: 0, borderBottom: 0 }
      : pos?.arrow === 'bottom'
        ? { bottom: -6, left: pos.arrowOffset, borderLeft: 0, borderTop: 0 }
        : pos?.arrow === 'left'
          ? { left: -6, top: pos.arrowOffset, borderRight: 0, borderTop: 0 }
          : pos?.arrow === 'right'
            ? { right: -6, top: pos.arrowOffset, borderLeft: 0, borderBottom: 0 }
            : null

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {tourOpen && (
        <motion.div
          key="tour"
          initial={{ opacity: 0 }}
          animate={{ opacity: blocked ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          className="fixed inset-0 z-[130] overflow-hidden"
          // The dim is drawn as an oversized ring around the highlighted control
          // rather than as a sheet over the page, so the control underneath stays
          // clickable and the user can actually do the step the bubble describes.
          // While blocked, `visibility` (not just opacity) is what stops the
          // faded-out bubble from still swallowing clicks meant for the overlay.
          style={{ pointerEvents: 'none', visibility: blocked ? 'hidden' : 'visible' }}
        >
          {spot ? (
            <div
              aria-hidden="true"
              className="absolute"
              style={{
                top: spot.top,
                left: spot.left,
                width: spot.width,
                height: spot.height,
                borderRadius: spot.radius,
                // Glow first: box-shadows paint front-to-back, so listing it after
                // the dim would bury the halo under it.
                boxShadow: `0 0 26px rgba(129,19,59,0.5), 0 0 0 9999px rgba(28,17,22,0.55)`,
                outline: `2px solid ${BRAND}`,
                outlineOffset: -1,
              }}
            />
          ) : (
            <div aria-hidden="true" className="absolute inset-0 bg-[#1c1116]/55" />
          )}

          <motion.div
            ref={bubbleRef}
            role="dialog"
            aria-modal="false"
            aria-label={`Guided tour: ${eyebrow}, ${title}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : DS_DUR_ENTER, ease: DS_EASE_SLIDE }}
            className={`rounded-[16px] border bg-white p-[18px] shadow-[0px_18px_40px_-8px_rgba(129,19,59,0.28)] ${
              compact || !pos ? 'absolute bottom-4 left-3 right-3' : ''
            }`}
            style={{
              borderColor: HAIRLINE,
              pointerEvents: 'auto',
              ...(compact || !pos
                ? {}
                : { top: pos.top, left: pos.left, width: BUBBLE_WIDTH, position: 'absolute' as const }),
            }}
          >
            {arrowEdge && (
              <span
                aria-hidden="true"
                className="absolute h-3 w-3 rotate-45 border bg-white"
                style={{ borderColor: HAIRLINE, ...arrowEdge }}
              />
            )}

            <div className="flex items-start justify-between gap-3">
              <p
                className="text-[10.5px] font-semibold uppercase leading-[16px] tracking-[0.14em]"
                style={{ color: BRAND }}
              >
                {eyebrow}
              </p>
              <button
                type="button"
                onClick={endTour}
                aria-label="Close the tour"
                className="-mr-1 -mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[#5a4650] transition-colors hover:bg-[#81133B]/[0.06] hover:text-[#1c1116] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#81133B]/40"
              >
                <Icon icon="ph:x-bold" width={12} height={12} />
              </button>
            </div>

            <p
              className="mt-1 text-[15.5px] font-[640] leading-[21px] tracking-[-0.01em]"
              style={{ color: INK }}
            >
              {title}
            </p>
            <p className="mt-1.5 text-[13px] leading-[19px]" style={{ color: MUTED }}>
              {step.body}
            </p>

            <div className="mt-3.5">{stepAction()}</div>

            <div
              className="mt-4 flex items-center justify-between gap-2 border-t pt-3"
              style={{ borderColor: HAIRLINE }}
            >
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {TOUR_STEPS.map((s, i) => (
                  <span
                    key={s.anchor + i}
                    className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4' : 'w-1.5'}`}
                    style={{ background: i === index ? BRAND : OUTLINE }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => setIndex((i) => i - 1)}
                    className="text-[13px] font-medium text-[#5a4650] transition-colors hover:text-[#1c1116]"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
                  className={PILL}
                >
                  {isLast ? 'Done' : 'Next'}
                  {!isLast && <Icon icon="ph:arrow-right" width={13} height={13} />}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default ShieldTour
