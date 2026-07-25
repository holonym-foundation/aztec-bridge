import React, { useEffect, useRef, useState } from 'react'
import StyledImage from './StyledImage'
import { BridgeDirection, BridgeState, Network as NetworkType, Token as TokenType } from '@/types/bridge'
import { motion } from 'framer-motion'
import SwapIcon from './SwapIcon'
import { Icon } from '@iconify/react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { POCH_MINT_URL } from '@/config'
import { BRIDGE_MAX_DEPOSIT_USD, TRAVEL_RULE_THRESHOLD_USD, PASSPORT_SCORE_THRESHOLD } from '@/config/env.config'

interface BridgeSectionProps {
  bridgeConfig: BridgeState
  setIsFromSection: (isFrom: boolean) => void
  setSelectNetwork: (open: boolean) => void
  setSelectToken: (open: boolean) => void
  inputAmount: string
  setInputAmount: (amount: string) => void
  l1NativeBalance: string | number | null | undefined
  l1Balance: string | number | null | undefined
  l2Balance: {
    privateBalance: string | number | null | undefined
    publicBalance: string | number | null | undefined
  }
  direction: BridgeDirection
  inputRef: React.RefObject<HTMLInputElement>
  onSwap?: () => void
  isPrivacyModeEnabled: boolean
  feeJuiceBalance?: string
  feeJuiceLoading?: boolean
  attestationMethod?: 'poch' | 'passport' | null
  passportMaxAmount?: bigint
  // Max USD the user can bridge right now (remaining budget under the active cap). Undefined
  // when the cap is disabled — the pill then falls back to the static cap label.
  remainingDepositUsd?: number
  // Passport tier score vs threshold, for the "score ≥ threshold" badge tooltip.
  passportScore?: number
  passportThreshold?: number
  // USD held by a pending attestation reservation (already netted out of remainingDepositUsd).
  // Surfaced in the badge tooltip as a temporary hold when > 0.
  reservedDepositUsd?: number
  // Clean-Hands (PoCH) daily deposit limit in USD, for the verified-tier pill. Undefined when
  // the value is not surfaced to the client — the pill then shows the verified state with no
  // fabricated figure. Never hardcode it here; thread the real config/backend value in.
  pochDailyLimitUsd?: number
  // Post-fee amount the user receives on the destination (net of the portal fee)
  youWillReceive?: string
  // Space-yielding: when a detail accordion below (Transaction breakdown / fuel detail)
  // expands, the From/To sections collapse to one-line summary rows so the expanded detail
  // fits inside the card's no-scroll budget instead of scrolling. Restores on collapse.
  compact?: boolean
}

// Amount fit-to-width bounds. The typed amount stays at the prominent max until the value is
// too wide for the input, then scales DOWN to the exact size that fits — never below the floor,
// which is low enough that even a max-length balance shows every character rather than clipping.
const AMOUNT_MAX_FONT_PX = 32
const AMOUNT_MIN_FONT_PX = 11

// Full USD for the limit headline / hold detail: 1000 → "$1,000",
// 1234.5 → "$1,234.50". Drops cents when the amount is whole.
function formatUsd(usd: number): string {
  const hasCents = !Number.isInteger(usd)
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}`
}

// Network marks sit on white/light selector chips. The Aztec mark is a light-green
// diamond that vanishes on a light surface, so it gets a dark circular chip with the
// mark inset. Every other mark renders bare.
function NetworkMark({
  src,
  network,
  chip,
  inner,
}: {
  src: string
  network?: string
  chip: string
  inner: string
}) {
  if (network === 'aztec') {
    return (
      <span className={`inline-flex items-center justify-center rounded-full bg-[#0A0A0A] shrink-0 ${chip}`}>
        <StyledImage src={src} alt="" className={inner} />
      </span>
    )
  }
  return <StyledImage src={src} alt="" className={`${chip} shrink-0`} />
}

const BridgeSection: React.FC<BridgeSectionProps> = ({
  bridgeConfig: bridge,
  setIsFromSection,
  setSelectNetwork,
  setSelectToken,
  inputAmount,
  setInputAmount,
  l1NativeBalance,
  l1Balance,
  l2Balance,
  direction,
  inputRef,
  onSwap,
  isPrivacyModeEnabled,
  feeJuiceBalance,
  feeJuiceLoading = false,
  attestationMethod,
  passportMaxAmount,
  remainingDepositUsd,
  passportScore,
  passportThreshold,
  reservedDepositUsd,
  pochDailyLimitUsd,
  youWillReceive,
  compact = false,
}) => {
  // Normalize balances to strings
  const l1NativeBalanceStr = l1NativeBalance != null ? l1NativeBalance.toString() : ''
  const l1BalanceStr = l1Balance != null ? l1Balance.toString() : ''

  const l2PublicBalanceStr = l2Balance?.publicBalance != null ? l2Balance?.publicBalance.toString() : ''
  const l2PrivateBalanceStr = l2Balance?.privateBalance != null ? l2Balance?.privateBalance.toString() : ''

  const l2BalanceStr = isPrivacyModeEnabled ? l2PrivateBalanceStr : l2PublicBalanceStr

  // Swap icon rotation state
  const [swapRotation, setSwapRotation] = useState(0)
  // Local override for the compact/collapsed summary: parent drives `compact` when a detail
  // accordion expands, but the founder expects tapping the collapsed From row to reopen the
  // full box. This lets the user re-expand without a setter from the parent.
  const [userExpanded, setUserExpanded] = useState(false)
  const handleSwapClick = () => {
    setSwapRotation((prev) => prev + 180)
    if (onSwap) onSwap()
  }

  // Attestation indicator + Proof of Clean Hands nudge. The cascade picks one method,
  // so only that tier is badged.
  const isPoch = attestationMethod === 'poch'

  // Per-human deposit LIMIT for the ACTIVE tier: the figure the pill shows. Passport-only
  // is held to the Travel-Rule threshold ($1k). Clean Hands (PoCH) unlocks the full alpha
  // cap ($25k). These are strictly tier-gated so a Passport-only user never sees the
  // Clean-Hands cap. pochDailyLimitUsd is threaded from BRIDGE_MAX_DEPOSIT_USD upstream;
  // fall back to the same config value if it isn't passed.
  const cleanHandsLimitUsd = pochDailyLimitUsd ?? Number(BRIDGE_MAX_DEPOSIT_USD)
  const passportLimitUsd = Number(TRAVEL_RULE_THRESHOLD_USD)
  // Personhood score gate for the Passport tier. Sourced from the config constant
  // (source of truth) rather than the per-request passportThreshold prop, which was
  // surfacing the scorer's internal passing value (1) instead of the real gate.
  const passportScoreThreshold = Number(PASSPORT_SCORE_THRESHOLD)
  const tierLimitUsd = isPoch ? cleanHandsLimitUsd : passportLimitUsd

  const amountNum = Number(inputAmount)
  // The alpha deposit cap is deposit-only (L1->L2). Showing a per-human limit on funds
  // LEAVING Aztec is misleading and implies double-counting, so the limit indicator (both
  // the "Limit: $X" state and the Clean Hands nudge) renders only when this flow is a deposit.
  const isDeposit = direction === BridgeDirection.L1_TO_L2
  // Fit-to-width: the typed amount owns the free space and scales its font size DOWN so a long
  // number (e.g. "1234.5678", or a full balance) stays fully visible instead of being clipped
  // behind the input's right edge. A prior length-based heuristic (200/length) ignored the real
  // pixel width the input actually gets, so it still clipped when the row's right column was wide.
  // Instead we measure the rendered text against the input's true content width and pick the exact
  // size that fits: text width scales linearly with font-size, so fit = max * (available / width).
  // A ResizeObserver re-fits whenever the input's width changes (e.g. the balance figure grows or
  // the layout reflows), keeping the number un-clipped without touching the row's height.
  const [amountFontPx, setAmountFontPx] = useState(AMOUNT_MAX_FONT_PX)
  const amountMeasureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const el = inputRef.current
    if (!el || typeof window === 'undefined') return

    const fitAmountFont = () => {
      const styles = window.getComputedStyle(el)
      const paddingX = parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0')
      const available = el.clientWidth - paddingX
      if (!(available > 0)) return

      const canvas = amountMeasureCanvasRef.current ?? (amountMeasureCanvasRef.current = document.createElement('canvas'))
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const text = inputAmount || el.placeholder || '0'
      ctx.font = `${styles.fontWeight} ${AMOUNT_MAX_FONT_PX}px ${styles.fontFamily}`
      const widthAtMax = ctx.measureText(text).width

      // 0.98 leaves a hair of slack so sub-pixel rounding never re-introduces a clip.
      let next = AMOUNT_MAX_FONT_PX
      if (widthAtMax > available) {
        next = Math.floor(AMOUNT_MAX_FONT_PX * (available / widthAtMax) * 0.98)
      }
      next = Math.max(AMOUNT_MIN_FONT_PX, Math.min(AMOUNT_MAX_FONT_PX, next))
      setAmountFontPx((prev) => (prev === next ? prev : next))
    }

    fitAmountFont()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fitAmountFont)
    observer.observe(el)
    return () => observer.disconnect()
  }, [inputAmount, inputRef])
  // Mutually exclusive with the "Limit: $X" indicator: once a Passport-only user crosses the
  // tier cap, the Clean Hands nudge REPLACES the limit indicator in the same slot. PoCH users
  // already hold the higher cap, so they keep the plain limit indicator and are never nagged.
  const showCleanHandsNudge =
    attestationMethod === 'passport' &&
    !isNaN(amountNum) &&
    amountNum > 0 &&
    amountNum > tierLimitUsd

  // Verified-tier badge: the tier's brand mark alongside the per-human limit. Passport
  // tier uses the Human Passport mark, Clean Hands tier uses the Clean Hands mark. The
  // mark is rendered in black via CSS mask so it reads as the real brand logo, not a tint.
  const badgeIconSrc = isPoch ? '/assets/svg/clean-hands.svg' : '/assets/svg/passport.svg'
  const badgeClass = isPoch
    ? 'bg-[rgba(15,123,79,0.10)] text-[#0F7B4F]'
    : 'bg-[rgba(23,35,94,0.08)] text-[#17235E]'
  // Compact cap shown under the balance. Passport is a per-human tier limit; the Clean Hands cap
  // ($25k) is a DAILY cap, so it carries a "/day" suffix. The "per human" framing lives in the tooltip.
  const limitLabel = tierLimitUsd > 0 ? `Limit: ${formatUsd(tierLimitUsd)}${isPoch ? '/day' : ''}` : null
  // Temporary hold from a pending deposit, appended to the badge tooltip when present.
  const reservedNote =
    reservedDepositUsd != null && reservedDepositUsd > 0
      ? ` ${formatUsd(reservedDepositUsd)} on hold from a pending deposit.`
      : ''
  const badgeTooltip = isPoch
    ? `Verified with Proof of Clean Hands. Bridge up to ${formatUsd(cleanHandsLimitUsd)}/day per human.${reservedNote}`
    : `Verified with Passport (score above ${passportScoreThreshold}). Bridge up to ${formatUsd(passportLimitUsd)} per human.${reservedNote} Verify with Proof of Clean Hands to unlock ${formatUsd(cleanHandsLimitUsd)}/day.`

  // Compact summary rows shown while a detail accordion is expanded — e.g.
  // "From Eth Sepolia · 100 USDC" / "To Aztec · cUSDC". Tapping either row reopens the
  // full From/To boxes (the founder-reported dead click). userExpanded lets the local
  // control override the parent's compact request until the user is done editing.
  if (compact && !userExpanded) {
    const fromSummary = `${bridge.from.network?.title ?? ''} · ${inputAmount || '0'} ${bridge.from.token?.symbol ?? ''}`
    const toReceive = youWillReceive ?? inputAmount
    const toSummary = `${bridge.to.network?.title ?? ''} · ${toReceive || '0'} ${bridge.to.token?.symbol ?? ''}`
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setUserExpanded(true)}
          aria-label="Expand From section"
          className="bg-[#F5F5F5] rounded-md px-3 py-2 flex items-center justify-between gap-2 text-left"
        >
          <span className="text-12 font-semibold text-latest-grey-100 shrink-0">From</span>
          <span className="flex items-center gap-1.5 min-w-0">
            <NetworkMark
              src={bridge.from.network?.img || '/assets/svg/ethLogo.svg'}
              network={bridge.from.network?.network}
              chip="h-4 w-4"
              inner="h-3 w-3"
            />
            <span className="text-14 font-medium text-latest-black-100 truncate">{fromSummary}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setUserExpanded(true)}
          aria-label="Expand To section"
          className="bg-[#F5F5F5] rounded-md px-3 py-2 flex items-center justify-between gap-2 text-left"
        >
          <span className="text-12 font-semibold text-latest-grey-100 shrink-0">To</span>
          <span className="flex items-center gap-1.5 min-w-0">
            <NetworkMark
              src={bridge.to.network?.img || ''}
              network={bridge.to.network?.network}
              chip="h-4 w-4"
              inner="h-3 w-3"
            />
            <span className="text-14 font-medium text-latest-black-100 truncate">{toSummary}</span>
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* From Section */}
      {/* Extra bottom padding (pb-5) keeps the last content row clear of the swap
          toggle, which is absolutely positioned at bottom-[-30px] and straddles the
          From/To boundary. Without it the toggle's top edge overlaps the attestation pill. */}
      <div className="bg-[#F5F5F5] rounded-md p-2.5 pb-5 relative">
        <p className="text-14 font-semibold text-latest-grey-100">From</p>
        <div className="flex justify-between">
          {/* Network selector */}
          <div className="flex flex-col mt-1 gap-0.5">
            <p className="text-12 text-[#747474]">Network</p>
            <div
              className="flex gap-2 items-center rounded-[12px] cursor-pointer bg-white p-[2px] max-w-[172px]"
              onClick={() => {
                setIsFromSection(true)
                setSelectNetwork(true)
              }}
            >
              <NetworkMark
                src={bridge.from.network?.img || '/assets/svg/ethLogo.svg'}
                network={bridge.from.network?.network}
                chip="h-5 w-5"
                inner="h-3.5 w-3.5"
              />
              <p className="text-16 font-medium text-latest-black-100 w-[106px]">{bridge.from.network?.title}</p>
              <StyledImage src="/assets/svg/dropDown.svg" alt="" className="h-2.5 w-1.5 p-1.5 mr-1.5" />
            </div>
          </div>
          {/* Token selector */}
          <div className="flex flex-col mt-1 gap-0.5">
            <p className="text-12 text-[#747474]">Asset</p>
            <div
              className="flex gap-2 items-center rounded-md cursor-pointer bg-white p-[2px]"
              onClick={() => {
                setIsFromSection(true)
                setSelectToken(true)
              }}
            >
              <StyledImage src={bridge.from.token?.img || ''} alt="" className="h-5 w-5" />
              <p className="text-16 font-medium text-latest-black-100">
                {bridge.from.token?.symbol}
              </p>
              <StyledImage src="/assets/svg/dropDown.svg" alt="" className="h-2.5 w-1.5 p-1.5 mr-1.5" />
            </div>
          </div>
        </div>
        <hr className="text-latest-grey-300 my-1" />
        {/* Amount + balance/limit stack. The typed amount is the focal element (larger,
            vertically centered against the right column); the balance sits top-right and the
            per-human limit sits directly under it, right-aligned. */}
        <div className="flex justify-between items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="0"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            className="min-w-0 flex-1 placeholder-latest-grey-400 outline-none bg-[transparent] leading-tight font-medium"
            style={{ fontSize: `${amountFontPx}px` }}
            autoFocus
          />
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <div
              className="flex gap-1 items-center cursor-pointer hover:text-latest-black-100 transition-colors"
              onClick={() => setInputAmount(direction === BridgeDirection.L1_TO_L2 ? l1BalanceStr : l2BalanceStr)}
              title="Use full balance"
            >
              <p className="text-latest-grey-500 text-14 font-medium">Balance:</p>
              <p className="text-latest-grey-500 text-14 font-medium break-all">
                {direction === BridgeDirection.L1_TO_L2 ? l1BalanceStr : l2BalanceStr}
              </p>
              <p className="text-latest-grey-500 text-14 font-medium">{bridge.from.token?.title}</p>
              <p
                className="text-12 font-medium text-latest-black-200 bg-white px-2 rounded-[32px] leading-5"
                onClick={(e) => {
                  e.stopPropagation()
                  setInputAmount(direction === BridgeDirection.L1_TO_L2 ? l1BalanceStr : l2BalanceStr)
                }}
              >
                Max
              </p>
            </div>
            {direction === BridgeDirection.L2_TO_L1 && (
              <div className="flex gap-1">
                <p className="text-latest-grey-500 text-12 font-medium break-all">
                  {feeJuiceLoading ? 'Loading...' : (feeJuiceBalance ?? '--')}
                </p>
                <p className="text-latest-grey-500 text-12 font-medium">Fee Juice</p>
              </div>
            )}
          </div>
        </div>
        {/* Deposit limit indicator on its OWN full-width row below the amount, right-aligned, so it
            never competes with the amount input for horizontal space. The wide Clean Hands nudge
            used to sit in the amount row's right column and squeezed the number down to a couple of
            visible digits. One slot, mutually exclusive: under the cap the "Limit: $X" pill (tier
            brand mark + per-human tooltip); once a Passport-tier amount exceeds the cap the linked
            Clean Hands nudge REPLACES it. Deposit-only: the cap does not apply to withdrawals. */}
        {isDeposit && attestationMethod && (
          <div className="mt-1 flex justify-end">
            {showCleanHandsNudge ? (
              <a
                href={POCH_MINT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-[rgba(181,71,8,0.10)] text-[#B54708] hover:bg-[rgba(181,71,8,0.18)] transition-colors"
              >
                <Icon icon="ph:arrow-up-right-bold" width={11} height={11} className="shrink-0" />
                Above {formatUsd(passportLimitUsd)} needs Proof of Clean Hands
              </a>
            ) : (
              limitLabel && (
                <span
                  data-tooltip-id="attestation-info"
                  data-tooltip-content={badgeTooltip}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold cursor-default ${badgeClass}`}
                >
                  <span>{limitLabel}</span>
                  <span
                    aria-hidden
                    className="inline-block h-[12px] w-[12px] shrink-0 bg-[#0A0A0A]"
                    style={{
                      maskImage: `url(${badgeIconSrc})`,
                      WebkitMaskImage: `url(${badgeIconSrc})`,
                      maskRepeat: 'no-repeat',
                      WebkitMaskRepeat: 'no-repeat',
                      maskPosition: 'center',
                      WebkitMaskPosition: 'center',
                      maskSize: 'contain',
                      WebkitMaskSize: 'contain',
                    }}
                  />
                </span>
              )
            )}
          </div>
        )}
        {isDeposit && attestationMethod && !showCleanHandsNudge && limitLabel && (
          <ReactTooltip
            id="attestation-info"
            place="top"
            className="z-[100]"
            style={{ fontSize: '12px', maxWidth: '220px' }}
          />
        )}
        {onSwap && <SwapIcon onClick={onSwap} />}
      </div>

      {/* To Section */}
      {/* mt-6 opens the inter-card gap so the swap toggle (44px, hanging 30px below the
          From card) has clear space and does not crowd the "To" header below it. */}
      <div className="mt-6 bg-[#F5F5F5] rounded-md p-2.5">
        <p className="text-14 font-semibold text-latest-grey-100">To</p>
        <div className="flex justify-between">
          {/* Network selector */}
          <div className="flex flex-col mt-1 gap-0.5">
            <p className="text-12 text-[#747474]">Network</p>
            <div
              className="flex gap-2 items-center rounded-[12px] cursor-pointer bg-white p-[2px] max-w-[172px]"
              onClick={() => {
                setIsFromSection(false)
                setSelectNetwork(true)
              }}
            >
              <NetworkMark
                src={bridge.to.network?.img || ''}
                network={bridge.to.network?.network}
                chip="h-5 w-5"
                inner="h-3.5 w-3.5"
              />
              <p className="text-16 font-medium text-latest-black-100 w-[106px]">{bridge.to.network?.title}</p>
              <StyledImage src="/assets/svg/dropDown.svg" alt="" className="h-2.5 w-1.5 p-1.5 mr-1.5" />
            </div>
          </div>

          {/* Token selector */}
          <div className="flex flex-col mt-1 gap-0.5">
            <p className="text-12 text-[#747474]">Asset</p>
            <div
              className="flex gap-2 items-center rounded-md cursor-pointer bg-white p-[2px]"
              onClick={() => {
                setIsFromSection(false)
                setSelectToken(true)
              }}
            >
              <StyledImage src={bridge.to.token?.img || ''} alt="" className="h-5 w-5" />
              <p className="text-16 font-medium text-latest-black-100">
                {bridge.to.token?.symbol}
              </p>
              <StyledImage src="/assets/svg/dropDown.svg" alt="" className="h-2.5 w-1.5 p-1.5 mr-1.5" />
            </div>
          </div>
        </div>
        <hr className="text-latest-grey-300 my-1" />
        <div className="flex justify-between">
          <p className="text-14 font-medium text-latest-grey-100">You will receive</p>
          <p className="text-black text-14 font-semibold">
            {youWillReceive ?? inputAmount} {bridge.to.token?.title}
          </p>
        </div>
        <div className="flex justify-between mt-0.5">
          <p className="text-latest-grey-500 text-12 font-medium">Current Balance:</p>
          <p className="text-latest-grey-500 text-12 font-medium break-all">
            {direction === BridgeDirection.L1_TO_L2 ? l2BalanceStr : l1BalanceStr} {bridge.to.token?.title}
          </p>
        </div>
      </div>
    </div>
  )
}

export default BridgeSection
