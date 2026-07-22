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

  // Subtly pulse the Privacy Mode toggle in the top nav so the user learns that's how modes
  // switch (we deliberately do NOT build a second toggle here). Class-toggling an element
  // outside this subtree is the only way to reach the shared nav; cleaned up on unmount.
  const pulsePrivacyToggle = (on: boolean) => {
    if (typeof document === 'undefined') return
    document.querySelector('.privacy-mode-toggle')?.classList.toggle('fj-mode-hint', on)
  }
  useEffect(() => () => pulsePrivacyToggle(false), [])

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
  const alreadyEnough = needFj != null && existingFj >= needFj && !selfFundLandingShort
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

  // Flag an auto amount that's inflated by the mis-priced testnet pool (well above a $10 buy),
  // so we can explain the "why so expensive" up front instead of leaving the user guessing.
  const tenUsdToken = Number(usdToTokenAmount(10, fundingSymbol, prices)) || 0
  const autoHigh = recommended != null && tenUsdToken > 0 && Number(recommended) > tenUsdToken

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

  // One-tap "auto": fill the recommended amount AND fire the top-up in a single
  // click. It is NOT silent — the user chooses it — but it removes the sizing step.
  const autoReady = canTopUp && walletsReady && !!recommended && !topUp.isPending
  const handleAuto = () => {
    if (!autoReady || !recommended) return
    setSpendAmount(recommended)
    spend(recommended)
  }

  // Covered = the applicable-mode balance already meets the claim, so no top-up is required.
  // Drives the headline (no "Add Fee Juice" call-to-action when nothing needs adding) and
  // hides the form behind a subtle opt-in.
  const covered = alreadyEnough
  const showForm = !covered || optionalTopUpOpen
  const modeIsPrivate = fuelType === 'private'
  const modeIcon = modeIsPrivate ? 'ph:lock-key-fill' : 'ph:globe-hemisphere-west-fill'
  const modeColor = modeIsPrivate ? '#81133B' : '#17235E'
  const modeLabel = modeIsPrivate ? 'Private' : 'Public'
  const haveBalance = applicableBalanceStr != null && applicableBalanceStr !== '--' ? applicableBalanceStr : '--'
  const needLabel = claimFeeLoading || claimFeeFj == null ? '…' : `~${claimFeeFj} FJ`

  return (
    <div className="rounded-md border border-[#81133B]/40 bg-[#F9EEF3] px-3 py-3 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Icon
          icon={covered ? 'ph:check-circle-fill' : 'ph:plus-circle-fill'}
          width={16}
          height={16}
          style={{ color: covered ? '#17235E' : '#81133B' }}
        />
        <p className="text-13 font-semibold" style={{ color: covered ? '#17235E' : '#81133B' }}>
          {covered ? 'You have enough Fee Juice' : 'Add Fee Juice'}
        </p>
      </div>

      {!canTopUp ? (
        <p className="text-12 leading-[16px] text-[#737373]">
          Fee Juice top-up isn&apos;t available on this deployment.
        </p>
      ) : (
        <>
          <style>{`
            @keyframes fjModePulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(129, 19, 59, 0); }
              50% { box-shadow: 0 0 0 4px rgba(129, 19, 59, 0.35); }
            }
            .privacy-mode-toggle.fj-mode-hint { animation: fjModePulse 1s ease-in-out infinite; border-radius: 9999px; }
          `}</style>

          {/* Available vs required — one compact, mode-aware line (#204). Globe = public, lock = private. */}
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

          {/* Single mode indicator: which Fee Juice you're buying, with a worded pointer to the
              Privacy Mode slider in the top nav. Hovering pulses that slider (no toggle built here). */}
          <div
            onMouseEnter={() => pulsePrivacyToggle(true)}
            onMouseLeave={() => pulsePrivacyToggle(false)}
            title="Change modes with the Privacy Mode slider in the top nav"
            className={`cursor-help rounded-md border px-2.5 py-1.5 ${
              modeIsPrivate ? 'border-[#81133B]/40 bg-[#81133B]/[0.06]' : 'border-[#17235E]/30 bg-[#17235E]/[0.06]'
            }`}
          >
            <div className="flex items-center gap-1.5 text-12 font-semibold" style={{ color: modeColor }}>
              <Icon icon={modeIcon} width={14} height={14} />
              {modeLabel} Fee Juice
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-11 text-latest-grey-500">
              <Icon icon="ph:arrow-up-bold" width={10} height={10} />
              Change in Privacy Mode (top nav)
            </div>
          </div>

          {pricesError && (
            <p className="text-11 text-amber-600">Live prices unavailable, using fallback prices</p>
          )}

          {/* One coherent status line — mode-specific, never two opposing statements. */}
          {covered ? (
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
          ) : (
            <p className="text-11 leading-[15px] text-[#737373]">
              Buy with {fundingSymbol} on Ethereum, bridged to Aztec.
            </p>
          )}

          {covered && !optionalTopUpOpen && (
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
              {/* One-tap auto: recommended amount + immediate top-up (single click, never silent).
                  Becomes an active connect prompt when a wallet is missing — never a dead button. */}
              {walletsReady ? (
                <button
                  type="button"
                  onClick={handleAuto}
                  disabled={!autoReady}
                  title="Sized to cover your claim shortfall. Testnet pool pricing can make this higher than mainnet."
                  className="w-full flex items-center justify-center gap-1.5 rounded-md border border-[#17235E]/40 bg-[#17235E]/[0.08] px-3 py-2 text-12 font-semibold text-[#17235E] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon icon="ph:magic-wand-fill" width={13} height={13} />
                  {topUp.isPending
                    ? 'Topping up…'
                    : recommended
                      ? `Auto top up ~${recommended} ${fundingSymbol}`
                      : 'Calculating…'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full flex items-center justify-center gap-1.5 rounded-md border border-[#17235E]/40 bg-[#17235E]/[0.08] px-3 py-2 text-12 font-semibold text-[#17235E] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon icon="ph:plugs-connected-fill" width={13} height={13} />
                  {connecting ? 'Connecting…' : `${connectLabel} to auto top up`}
                </button>
              )}
              {walletsReady && autoHigh && (
                <p className="flex items-start gap-1 text-11 leading-[15px] text-latest-grey-500">
                  <Icon icon="ph:info" width={12} height={12} className="mt-0.5 flex-shrink-0" />
                  High due to live testnet pool pricing. The real cost on mainnet is far lower.
                </p>
              )}

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
