'use client'

import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { formatUnits, parseUnits } from 'viem'
import {
  formatFjAmount,
  usdToTokenAmount,
  buildSwapCandidates,
  getBestRoute,
  getFeeJuicePriceUsd,
  getTokenPriceUsd,
} from '@/utils/fuelPricing'
import { BRIDGED_FPC_ADDRESS, L1_RPC_URL, L1_TOKENS, SWAP_BRIDGE_ROUTER_ADDRESS } from '@/config'
import { useTokenPrices } from '@/utils/coinGeckoPrice'
import { useClaimFeeEstimate } from '@/hooks/useL2Operations'
import { useL1TopUpFeeJuice } from '@/hooks/useL1Operations'
import { useTopUpQuote, useTopUpSufficiency } from '@/components/WithdrawFuelPanel'
import { useWalletStore } from '@/stores/walletStore'

const USD_PRESETS = [1, 5, 10]

/**
 * Recommended top-up spend for the "auto" convenience.
 *
 * Sizes the spend to cover the SHORTFALL between the L2 claim fee and the FJ the
 * user already holds — not the full claim fee. Public fuel claims into the
 * account's public FJ balance, so an existing balance offsets what must be
 * bridged. Private fuel (BridgedFPC) self-funds its own landing claim
 * (mint_and_pay_fee asserts the fresh amount ≥ gas), so a private top-up must
 * still cover the whole claim — but if the user already holds enough, no top-up
 * is recommended at all. We probe the real V4 pool for its FeeJuice-per-token
 * rate (off mainnet the FJ price feed and the pool diverge, so price-based
 * sizing is wrong), then size the spend with headroom.
 */
function useRecommendedTopUp(
  enabled: boolean,
  fuelType: 'public' | 'private',
  claimFeeLimit: bigint | undefined,
  existingFj: number,
  tokenAddress: string,
  tokenDecimals: number,
  tokenSymbol: string,
  prices: Record<string, number> | null | undefined,
): string | null {
  const [recommended, setRecommended] = useState<string | null>(null)

  useEffect(() => {
    setRecommended(null)
    if (!enabled || claimFeeLimit == null || !tokenAddress) return
    let cancelled = false
    const timeout = setTimeout(async () => {
      try {
        const needFj = Number(claimFeeLimit) / 1e18
        // Existing FJ already covers the claim → nothing to bridge.
        if (existingFj >= needFj) return
        // Public fuel: only bridge the shortfall (existing + claimed pay together).
        // Private fuel: the fresh bridge self-funds its own landing claim, so size
        // to the whole claim.
        const requiredFj = fuelType === 'public' ? needFj - existingFj : needFj
        const fjUsd = getFeeJuicePriceUsd(prices)
        const tokenUsd = getTokenPriceUsd(tokenSymbol, prices)
        // Order-of-magnitude probe size (not the rate; the rate is measured on-chain).
        const guess = tokenUsd > 0 && fjUsd > 0 ? (requiredFj * fjUsd) / tokenUsd : 1
        const probeToken = Math.max(guess, 1e-6)
        const probeRaw = BigInt(Math.floor(probeToken * 10 ** tokenDecimals))
        if (probeRaw <= 0n) return
        const candidates = buildSwapCandidates(tokenAddress as `0x${string}`)
        const best = await getBestRoute({ candidates, inputAmount: probeRaw, l1RpcUrl: L1_RPC_URL })
        if (cancelled || best.expectedOutput <= 0n) return
        const fjPerToken = Number(best.expectedOutput) / 1e18 / probeToken
        if (fjPerToken <= 0) return
        // Headroom for price impact between probe and final size + swap slippage. Slightly
        // larger than the deposit-fuel buffer so the one-tap amount comfortably clears the
        // downstream sufficiency check without a second attempt.
        const BUFFER = 1.4
        const recToken = (requiredFj * BUFFER) / fjPerToken
        const centsDecimals = tokenUsd > 0 ? Math.ceil(Math.log10(tokenUsd) + 2) : 2
        const displayDecimals = Math.min(Math.max(centsDecimals, 2), tokenDecimals)
        const factor = 10 ** displayDecimals
        const rounded = Math.ceil(recToken * factor) / factor
        if (rounded > 0 && !cancelled) setRecommended(String(rounded))
      } catch {
        if (!cancelled) setRecommended(null)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [enabled, fuelType, claimFeeLimit, existingFj, tokenAddress, tokenDecimals, tokenSymbol, prices])

  return recommended
}

/** Carve almost the whole spend into fuel: the SDK requires fuel < amount strictly. */
function deriveFuelAmount(spend: string, decimals: number): string {
  if (!spend || Number(spend) <= 0) return ''
  try {
    const raw = parseUnits(spend, decimals)
    if (raw <= 1n) return ''
    return formatUnits(raw - 1n, decimals)
  } catch {
    return ''
  }
}

function QuoteSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 bg-neutral-300 rounded w-3/4" />
      <div className="h-3 bg-neutral-300 rounded w-full" />
    </div>
  )
}

interface FeeJuiceTopUpProps {
  isPrivacyModeEnabled?: boolean
  /** Public L2 Fee Juice balance (pays public claims; string like "10.15"). */
  feeJuiceBalance?: string
  /** BridgedFPC balance — the applicable balance in privacy mode. */
  privateFeeJuiceBalance?: string
  /**
   * True when the user arrived here from an interrupted L1→L2 claim that ran short on L2 gas.
   * Drives mode-specific status copy: in PUBLIC mode the existing balance can pay the landing
   * claim, but in PRIVATE mode that landing claim self-funds, so the existing private balance
   * does NOT apply and fresh private Fee Juice must be added.
   */
  landingClaimShort?: boolean
  /**
   * True when the interrupted claim's L1→L2 message was already consumed by a prior successful
   * claim (the "no non-nullified message" case). The deposit very likely already completed, so a
   * top-up cannot fix it and "you have enough, resume" must never show — the panel points the user
   * at their L2 balance instead.
   */
  depositLikelyCompleted?: boolean
  /** Reports whether the existing balance already covers the interrupted claim (public mode). */
  onLandingCoveredChange?: (covered: boolean) => void
  /** Called with the L2 tx hash once the top-up completes and FJ lands on L2. */
  onSuccess?: (l2TxHash?: string) => void
}

/**
 * Standalone "buy + bridge Fee Juice" form.
 *
 * Reuses the exact deposit-fuel primitive via `useL1TopUpFeeJuice` (buy FJ on L1,
 * bridge to L2) and the same V4 quote + sufficiency hooks the withdraw panel uses.
 * Adds a one-tap "auto" recommendation that sizes the spend to cover the L2 claim
 * fee. Privacy mode forces private (BridgedFPC) fuel so the topped-up FJ stays
 * anonymous — same enforcement as every other fuel path.
 */
const FeeJuiceTopUp: React.FC<FeeJuiceTopUpProps> = ({
  isPrivacyModeEnabled = false,
  feeJuiceBalance,
  privateFeeJuiceBalance,
  landingClaimShort = false,
  depositLikelyCompleted = false,
  onLandingCoveredChange,
  onSuccess,
}) => {
  const hasBridgedFpc = !!BRIDGED_FPC_ADDRESS
  const { isWaapConnected, isAztecConnected, connectWaapWallet, connectAztecWallet } = useWalletStore()

  // Graceful connect: never a dead disabled button. When a wallet is missing the top-up
  // controls become ACTIVE prompts that start the connect flow for the missing chain.
  const missingEth = !isWaapConnected
  const missingAztec = !isAztecConnected
  const [connecting, setConnecting] = useState(false)
  const connectLabel = missingEth && missingAztec ? 'Connect wallets' : missingEth ? 'Connect Ethereum wallet' : 'Connect Aztec wallet'
  const handleConnect = async () => {
    if ((isWaapConnected && isAztecConnected) || connecting) return
    setConnecting(true)
    try {
      if (missingEth) await connectWaapWallet()
      else if (missingAztec) await connectAztecWallet()
    } catch {
      // Store surfaces its own error toast.
    } finally {
      setConnecting(false)
    }
  }

  const fuelType: 'public' | 'private' = isPrivacyModeEnabled && hasBridgedFpc ? 'private' : 'public'

  const fundingToken = L1_TOKENS[0]
  const fundingSymbol = fundingToken?.symbol ?? 'USDC'
  const fundingDecimals = fundingToken?.decimals ?? 6
  const fundingAddress = fundingToken?.l1TokenContract ?? ''
  const canTopUp = !!SWAP_BRIDGE_ROUTER_ADDRESS && (!isPrivacyModeEnabled || hasBridgedFpc) && !!fundingAddress

  const { prices, error: pricesError } = useTokenPrices()
  const { data: claimFeeLimit, isLoading: claimFeeLoading } = useClaimFeeEstimate(fuelType)
  const claimFeeFj = claimFeeLimit != null ? formatFjAmount(claimFeeLimit, 2) : null

  const [spendAmount, setSpendAmount] = useState('')
  // When the user is already covered we hide the top-up form, but keep a subtle opt-in
  // so they can still add more Fee Juice on purpose.
  const [optionalTopUpOpen, setOptionalTopUpOpen] = useState(false)
  const fuelAmount = deriveFuelAmount(spendAmount, fundingDecimals)

  const { fjOutput, loading: quoteLoading, error: quoteError } = useTopUpQuote(fuelAmount, fundingAddress, fundingDecimals)
  const { feeLimitFj, loading: sufficiencyLoading } = useTopUpSufficiency(fjOutput, fuelType)

  // The FJ that pays an L2 claim comes from the user's ACCOUNT balance — public
  // FJ for public fuel, BridgedFPC balance for private fuel — so the existing
  // balance counts toward "do I have enough". For public fuel the freshly
  // claimed FJ lands in that same public balance, so existing + swap pay
  // together. For private fuel the fresh bridge self-funds its own landing
  // claim, so the swap alone must clear the claim (existing private balance
  // still means no top-up is needed if it already covers the claim).
  const applicableBalanceStr = fuelType === 'private' ? privateFeeJuiceBalance : feeJuiceBalance
  const existingFj = applicableBalanceStr != null && applicableBalanceStr !== '--' ? Number(applicableBalanceStr) : 0
  const needFj = claimFeeLimit != null ? Number(claimFeeLimit) / 1e18 : null
  const swapFj = fjOutput != null ? Number(fjOutput) / 1e18 : null
  // A specific interrupted claim in PRIVATE mode self-funds its landing claim, so the user's
  // EXISTING private balance can't be applied to it — fresh private Fee Juice is required.
  // That's why "already enough" must be false here even if the private balance looks sufficient
  // (this is what prevents the contradictory "you have enough" next to "claim ran short").
  const selfFundLandingShort = landingClaimShort && fuelType === 'private'
  // "You have enough" must never sit next to a failure a top-up can't fix. A consumed-message
  // recovery (deposit likely already completed) is exactly that case, so it can't be "enough".
  const alreadyEnough =
    needFj != null && existingFj >= needFj && !selfFundLandingShort && !depositLikelyCompleted
  const effectiveSufficient: boolean | null =
    alreadyEnough
      ? true
      : needFj == null || swapFj == null
        ? null
        : fuelType === 'public'
          ? existingFj + swapFj >= needFj
          : swapFj >= needFj

  // Tell the page whether the interrupted claim is already fundable from the existing balance
  // (only possible in public mode) so it can offer Resume without a redundant top-up.
  const landingCovered = landingClaimShort && alreadyEnough
  useEffect(() => {
    onLandingCoveredChange?.(landingCovered)
  }, [landingCovered, onLandingCoveredChange])

  const topUp = useL1TopUpFeeJuice((l2TxHash) => {
    setSpendAmount('')
    onSuccess?.(l2TxHash)
  })

  const recommended = useRecommendedTopUp(
    canTopUp,
    fuelType,
    claimFeeLimit,
    existingFj,
    fundingAddress,
    fundingDecimals,
    fundingSymbol,
    prices,
  )

  const walletsReady = isWaapConnected && isAztecConnected
  const amountValid = !!fuelAmount && Number(fuelAmount) > 0
  const confirmDisabled =
    !canTopUp ||
    !walletsReady ||
    !amountValid ||
    quoteLoading ||
    fjOutput === null ||
    !!quoteError ||
    sufficiencyLoading ||
    effectiveSufficient === false ||
    topUp.isPending

  const spend = (amount: string) => {
    const fuel = deriveFuelAmount(amount, fundingDecimals)
    if (!fuel || Number(fuel) <= 0) return
    topUp.mutate({ tokenSymbol: fundingSymbol, spendAmount: amount, fuelAmount: fuel, fuelType })
  }

  const handleConfirm = () => {
    if (confirmDisabled) return
    spend(spendAmount)
  }

  // Covered = the applicable-mode balance already meets the claim, so no top-up is required.
  // Drives the headline (no "Add Fee Juice" call-to-action when nothing needs adding) and
  // hides the form behind a subtle opt-in.
  const covered = alreadyEnough
  // Likely-completed and covered both mean no top-up is needed, so the buy form collapses behind
  // the subtle opt-in in either case.
  const noTopUpNeeded = covered || depositLikelyCompleted
  const showForm = !noTopUpNeeded || optionalTopUpOpen
  const modeIsPrivate = fuelType === 'private'
  const modeColor = modeIsPrivate ? '#81133B' : '#17235E'
  const modeLabel = modeIsPrivate ? 'Private' : 'Public'
  // Solid -fill glyph for the compact "you have" chip; the header indicator uses the lighter
  // globe / lock-simple glyph the owner specified.
  const modeIcon = modeIsPrivate ? 'ph:lock-key-fill' : 'ph:globe-hemisphere-west-fill'
  const modeIndicatorIcon = modeIsPrivate ? 'ph:lock-simple' : 'ph:globe'
  const haveBalance = applicableBalanceStr != null && applicableBalanceStr !== '--' ? applicableBalanceStr : '--'
  const needLabel = claimFeeLoading || claimFeeFj == null ? '…' : `~${claimFeeFj} FJ`

  // Header state: never headline "Add Fee Juice" when none is needed, and never "you have enough"
  // next to a failure a top-up can't fix.
  const headerState: 'completed' | 'covered' | 'add' = depositLikelyCompleted
    ? 'completed'
    : covered
      ? 'covered'
      : 'add'
  const headerIcon = headerState === 'add' ? 'ph:plus-circle-fill' : 'ph:check-circle-fill'
  const headerColor = headerState === 'add' ? '#81133B' : '#17235E'
  const headerLabel =
    headerState === 'completed'
      ? 'Deposit complete'
      : headerState === 'covered'
        ? 'You have enough Fee Juice'
        : 'Add Fee Juice'

  return (
    <div className="rounded-md border border-[#81133B]/40 bg-[#F9EEF3] px-3 py-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon icon={headerIcon} width={16} height={16} style={{ color: headerColor }} />
          <p className="text-13 font-semibold" style={{ color: headerColor }}>
            {headerLabel}
          </p>
          <span
            className="cursor-help leading-none text-latest-grey-500"
            title={`Buy Fee Juice with ${fundingSymbol} on Ethereum, bridged to Aztec for L2 gas.`}
          >
            <Icon icon="ph:info" width={14} height={14} />
          </span>
        </div>
        {/* Mode indicator (#222/#223): icon + one-word tag, colored by mode. The tooltip is the
            only pointer to the nav Privacy Mode — no inline "change mode" instruction. */}
        <div
          title="Mode follows Privacy Mode in the top nav"
          className={`flex shrink-0 cursor-help items-center gap-1 rounded-full border px-2 py-0.5 text-11 font-semibold ${
            modeIsPrivate ? 'border-[#81133B]/30 bg-[#81133B]/[0.06]' : 'border-[#17235E]/30 bg-[#17235E]/[0.06]'
          }`}
          style={{ color: modeColor }}
        >
          <Icon icon={modeIndicatorIcon} width={12} height={12} />
          {modeLabel}
        </div>
      </div>

      {!canTopUp ? (
        <p className="text-12 leading-[16px] text-[#737373]">
          Fee Juice top-up isn&apos;t available on this deployment.
        </p>
      ) : (
        <>
          {/* Available vs required — one compact, mode-aware line. Globe = public, lock = private. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-11 text-latest-grey-600">
            <span className="flex items-center gap-1">
              <Icon icon="ph:gas-pump-fill" width={12} height={12} className="text-[#17235E]" />
              Need <span className="font-semibold text-latest-black-100">{needLabel}</span>
            </span>
            <span className="text-latest-grey-400">·</span>
            <span className="flex items-center gap-1">
              You have <span className="font-semibold text-latest-black-100">{haveBalance} FJ</span>
              <Icon icon={modeIcon} width={11} height={11} style={{ color: modeColor }} />
            </span>
          </div>

          {pricesError && (
            <p className="text-11 text-amber-600">Live prices unavailable, using fallback prices</p>
          )}

          {/* One coherent status line — mode-specific, never two opposing statements. A failure a
              top-up can't fix (deposit already completed) never shows "you have enough / resume". */}
          {depositLikelyCompleted ? (
            <div className="flex items-start gap-1.5 rounded-md bg-[#17235E]/[0.08] px-2.5 py-1.5">
              <Icon icon="ph:check-circle-fill" width={14} height={14} className="mt-0.5 flex-shrink-0 text-[#17235E]" />
              <p className="text-11 leading-[15px] text-[#737373]">
                <span className="font-semibold text-[#17235E]">This deposit likely already completed.</span> Check your
                L2 balance. No top-up or resume needed.
              </p>
            </div>
          ) : covered ? (
            <p className="flex items-center gap-1.5 text-11 leading-[15px] text-[#737373]">
              <Icon icon="ph:check-circle-fill" width={13} height={13} className="flex-shrink-0 text-[#17235E]" />
              {landingClaimShort ? 'You can resume now, no top-up needed.' : 'No top-up needed.'}
            </p>
          ) : selfFundLandingShort ? (
            <div className="flex items-start gap-1.5 rounded-md bg-[#D92D20]/[0.08] px-2.5 py-1.5">
              <Icon icon="ph:warning-circle-fill" width={14} height={14} className="mt-0.5 flex-shrink-0 text-[#D92D20]" />
              <p className="text-11 leading-[15px] text-[#737373]">
                <span className="font-semibold text-[#D92D20]">This claim needs fresh private Fee Juice.</span> Your
                existing private balance won&apos;t apply. Add some below, or switch to public in Privacy Mode.
              </p>
            </div>
          ) : landingClaimShort ? (
            <div className="flex items-start gap-1.5 rounded-md bg-[#D92D20]/[0.08] px-2.5 py-1.5">
              <Icon icon="ph:warning-circle-fill" width={14} height={14} className="mt-0.5 flex-shrink-0 text-[#D92D20]" />
              <p className="text-11 leading-[15px] text-[#737373]">
                <span className="font-semibold text-[#D92D20]">Claim ran short on L2 gas.</span> Add Fee Juice below,
                then resume. Your funds stay safe.
              </p>
            </div>
          ) : null}

          {noTopUpNeeded && !optionalTopUpOpen && (
            <button
              type="button"
              onClick={() => setOptionalTopUpOpen(true)}
              className="text-11 font-medium text-latest-grey-500 underline underline-offset-2 transition-colors hover:text-[#81133B]"
            >
              Top up anyway
            </button>
          )}

          {showForm && (
            <>
              {/* Minimal top-up entry: amount input + a couple of presets + the primary buy button. */}
              <div className="flex items-center gap-1.5 max-w-full">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={`Amount in ${fundingSymbol}`}
                  value={spendAmount}
                  disabled={topUp.isPending}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || !isNaN(Number(v))) setSpendAmount(v)
                  }}
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#81133B] disabled:opacity-60"
                />
                {USD_PRESETS.map((usd) => {
                  const tokenEquiv = usdToTokenAmount(usd, fundingSymbol, prices)
                  return (
                    <button
                      key={usd}
                      type="button"
                      disabled={topUp.isPending}
                      onClick={() => setSpendAmount(tokenEquiv)}
                      title={`${tokenEquiv} ${fundingSymbol}`}
                      className={`shrink-0 px-1.5 py-1 text-xs rounded border transition-colors disabled:opacity-60 ${
                        spendAmount === tokenEquiv
                          ? 'border-[#81133B] bg-[#F9EEF3] text-[#81133B]'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      ${usd}
                    </button>
                  )
                })}
              </div>

              {amountValid && (quoteLoading || (fjOutput === null && !quoteError)) && <QuoteSkeleton />}
              {amountValid && quoteError && <p className="text-11 text-red-500">{quoteError}</p>}
              {amountValid && !quoteLoading && !quoteError && fjOutput !== null && !sufficiencyLoading && (
                <p
                  className={`text-11 leading-[15px] font-medium ${
                    effectiveSufficient === false ? 'text-[#D92D20]' : 'text-[#17235E]'
                  }`}
                >
                  {effectiveSufficient === false
                    ? recommended
                      ? `Not enough yet. Add ~${recommended} ${fundingSymbol} to cover your claim.`
                      : 'Not enough yet. Increase the amount.'
                    : `Covers your claim (~${feeLimitFj ?? claimFeeFj} FJ needed).`}
                </p>
              )}
              {/* Buy / bridge — an active connect prompt when a wallet is missing (never a dead button). */}
              {walletsReady ? (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirmDisabled}
                  className="w-full flex items-center justify-center gap-1.5 rounded-md bg-[#81133B] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {topUp.isPending ? (
                    <>
                      <Icon icon="ph:spinner-gap-bold" width={13} height={13} className="animate-spin" />
                      Buying Fee Juice…
                    </>
                  ) : (
                    <>
                      <Icon icon="ph:lightning-fill" width={13} height={13} />
                      Buy &amp; bridge Fee Juice
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full flex items-center justify-center gap-1.5 rounded-md bg-[#81133B] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon icon="ph:plugs-connected-fill" width={13} height={13} />
                  {connecting ? 'Connecting…' : `${connectLabel} to buy Fee Juice`}
                </button>
              )}
            </>
          )}

          {topUp.isPending && (
            <p className="text-11 leading-[15px] text-[#737373]">
              Keep this page open. The bridge to Aztec can take ~5 to 15 minutes.
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default FeeJuiceTopUp
