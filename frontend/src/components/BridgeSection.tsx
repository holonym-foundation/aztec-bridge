import React, { useState } from 'react'
import StyledImage from './StyledImage'
import { BridgeDirection, BridgeState, Network as NetworkType, Token as TokenType } from '@/types/bridge'
import { motion } from 'framer-motion'
import SwapIcon from './SwapIcon'
import { Icon } from '@iconify/react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { POCH_MINT_URL } from '@/config'

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

// Compact USD for limit pills: 25000 → "$25k", 1500 → "$1.5k", 900 → "$900".
function formatCompactUsd(usd: number): string {
  if (usd >= 1000) {
    const k = usd / 1000
    return `$${Number.isInteger(k) ? k : Number(k.toFixed(1))}k`
  }
  return `$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

// Full USD for the "available to bridge" headline / hold detail: 1000 → "$1,000",
// 1234.5 → "$1,234.50". Drops cents when the amount is whole.
function formatUsd(usd: number): string {
  const hasCents = !Number.isInteger(usd)
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}`
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
  const handleSwapClick = () => {
    setSwapRotation((prev) => prev + 180)
    if (onSwap) onSwap()
  }

  // Attestation indicator + Proof of Clean Hands nudge.
  // Passport (uniqueness) carries a per-tx USD cap; PoCH lifts it. The cap comes
  // from the attestation result (passportMaxAmount, token base units), never a
  // hardcoded 1000, so it tracks whatever the backend enforces.
  const passportCapUsd = passportMaxAmount != null ? Number(passportMaxAmount) / 1e6 : undefined
  const capLabel =
    passportCapUsd != null ? `$${passportCapUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''
  // Clean-Hands tier shows its DAILY limit when a real value is threaded in (e.g. "$25k/day").
  // Empty when the limit is not exposed to the client — the pill stays honest with no number.
  const dailyLimitLabel =
    pochDailyLimitUsd != null && pochDailyLimitUsd > 0 ? `${formatCompactUsd(pochDailyLimitUsd)}/day` : ''
  const amountNum = Number(inputAmount)
  // Nudge only on the Passport path, only as the amount nears or crosses the cap.
  // PoCH-verified users already have the higher limit, so they are never nagged.
  const nearPassportCap =
    attestationMethod === 'passport' &&
    passportCapUsd != null &&
    !isNaN(amountNum) &&
    amountNum > 0 &&
    amountNum >= passportCapUsd * 0.9

  // Verified-tier badge: icon + short label, matched to the humanity icons in the Header
  // tooltip (PoCH → ph:hand-soap, Passport → ph:identification-card). One method wins the
  // attestation cascade, so only that tier is badged.
  const isPoch = attestationMethod === 'poch'
  const badgeIcon = isPoch ? 'ph:hand-soap' : 'ph:identification-card'
  const badgeLabel = isPoch ? 'Clean Hands' : 'Passport'
  const badgeClass = isPoch
    ? 'bg-[rgba(15,123,79,0.10)] text-[#0F7B4F]'
    : 'bg-[rgba(23,35,94,0.08)] text-[#17235E]'
  // Headline the user cares about: how much they can bridge right now. Falls back to the
  // static cap label when the remaining budget isn't surfaced (cap disabled).
  const remainingLabel = remainingDepositUsd != null ? `${formatUsd(remainingDepositUsd)} available to bridge` : null
  const headlineLabel = remainingLabel ?? (isPoch ? dailyLimitLabel || null : capLabel ? `max ${capLabel}` : null)
  // Temporary hold from a pending deposit — appended to the badge tooltip when present.
  const reservedNote =
    reservedDepositUsd != null && reservedDepositUsd > 0
      ? ` ${formatUsd(reservedDepositUsd)} on hold from a pending deposit.`
      : ''
  const badgeTooltip = isPoch
    ? `Verified with Proof of Clean Hands.${dailyLimitLabel ? ` Daily limit ${dailyLimitLabel}.` : ''}${reservedNote}`
    : `Verified with Passport (uniqueness).${
        passportScore != null && passportThreshold != null ? ` Score ${passportScore} ≥ ${passportThreshold}.` : ''
      }${capLabel ? ` ${capLabel} lifetime limit.` : ''}${reservedNote} Verify with Proof of Clean Hands for a higher limit.`

  // Compact summary rows shown while a detail accordion is expanded — e.g.
  // "From Eth Sepolia · 100 USDC" / "To Aztec · cUSDC". Tapping a row re-selects
  // its network so the user can still edit without leaving compact mode.
  if (compact) {
    const fromSummary = `${bridge.from.network?.title ?? ''} · ${inputAmount || '0'} ${bridge.from.token?.symbol ?? ''}`
    const toReceive = youWillReceive ?? inputAmount
    const toSummary = `${bridge.to.network?.title ?? ''} · ${toReceive || '0'} ${bridge.to.token?.symbol ?? ''}`
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => {
            setIsFromSection(true)
            setSelectNetwork(true)
          }}
          className="bg-[#F5F5F5] rounded-md px-3 py-2 flex items-center justify-between gap-2 text-left"
        >
          <span className="text-12 font-semibold text-latest-grey-100 shrink-0">From</span>
          <span className="flex items-center gap-1.5 min-w-0">
            <StyledImage src={bridge.from.network?.img || '/assets/svg/ethLogo.svg'} alt="" className="h-4 w-4 shrink-0" />
            <span className="text-14 font-medium text-latest-black-100 truncate">{fromSummary}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setIsFromSection(false)
            setSelectNetwork(true)
          }}
          className="bg-[#F5F5F5] rounded-md px-3 py-2 flex items-center justify-between gap-2 text-left"
        >
          <span className="text-12 font-semibold text-latest-grey-100 shrink-0">To</span>
          <span className="flex items-center gap-1.5 min-w-0">
            <StyledImage src={bridge.to.network?.img || ''} alt="" className="h-4 w-4 shrink-0" />
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
              <StyledImage src={bridge.from.network?.img || '/assets/svg/ethLogo.svg'} alt="" className="h-5 w-5" />
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
        {/* Amount + balance/Max on one row: balance is click-to-fill and the Max chip
            sits beside it, so no separate Max row is needed (saves vertical rhythm). */}
        <div className="flex justify-between items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="0"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            className="min-w-0 flex-1 placeholder-latest-grey-400 outline-none bg-[transparent] text-26 leading-tight font-medium"
            autoFocus
          />
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <div
              className="flex gap-1 items-center cursor-pointer hover:text-latest-black-100 transition-colors"
              onClick={() => setInputAmount(direction === BridgeDirection.L1_TO_L2 ? l1BalanceStr : l2BalanceStr)}
              title="Use full balance"
            >
              <p className="text-latest-grey-500 text-12 font-medium">Balance:</p>
              <p className="text-latest-grey-500 text-12 font-medium break-all">
                {direction === BridgeDirection.L1_TO_L2 ? l1BalanceStr : l2BalanceStr}
              </p>
              <p className="text-latest-grey-500 text-12 font-medium">{bridge.from.token?.title}</p>
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
        {attestationMethod && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3">
            {/* Requirement badge (icon + tier) with the max the user can bridge alongside.
                Cap, score, and any pending hold live in the hover tooltip. */}
            <span
              data-tooltip-id="attestation-info"
              data-tooltip-content={badgeTooltip}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-12 font-medium cursor-default ${badgeClass}`}
            >
              <Icon icon={badgeIcon} width={13} height={13} className="shrink-0" />
              {badgeLabel}
            </span>
            {headlineLabel && (
              <span className="text-12 font-semibold text-latest-black-100">{headlineLabel}</span>
            )}
            {/* Contextual nudge: only near/over the Passport cap; links out to mint PoCH. */}
            {nearPassportCap && (
              <a
                href={POCH_MINT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-12 font-medium bg-[rgba(181,71,8,0.10)] text-[#B54708] hover:bg-[rgba(181,71,8,0.18)] transition-colors"
              >
                <Icon icon="ph:arrow-up-right-bold" width={12} height={12} className="shrink-0" />
                Above {capLabel} needs Proof of Clean Hands
              </a>
            )}
            <ReactTooltip
              id="attestation-info"
              place="top"
              className="z-[100]"
              style={{ fontSize: '12px', maxWidth: '220px' }}
            />
          </div>
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
              <StyledImage src={bridge.to.network?.img || ''} alt="" className="h-5 w-5" />
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
