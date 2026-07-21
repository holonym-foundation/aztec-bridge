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
  onSuccess,
}) => {
  const hasBridgedFpc = !!BRIDGED_FPC_ADDRESS
  const { isWaapConnected, isAztecConnected } = useWalletStore()

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
  const alreadyEnough = needFj != null && existingFj >= needFj
  const effectiveSufficient: boolean | null =
    alreadyEnough
      ? true
      : needFj == null || swapFj == null
        ? null
        : fuelType === 'public'
          ? existingFj + swapFj >= needFj
          : swapFj >= needFj

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

  // One-tap "auto": fill the recommended amount AND fire the top-up in a single
  // click. It is NOT silent — the user chooses it — but it removes the sizing step.
  const autoReady = canTopUp && walletsReady && !!recommended && !topUp.isPending
  const handleAuto = () => {
    if (!autoReady || !recommended) return
    setSpendAmount(recommended)
    spend(recommended)
  }

  return (
    <div className="rounded-md border border-[#81133B]/40 bg-[#F9EEF3] px-3 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-13 font-semibold text-[#81133B]">Add Fee Juice</p>
        <span className="flex items-center gap-1 text-11 text-latest-grey-500">
          <Icon icon="ph:gas-pump-fill" width={12} height={12} className="text-[#17235E]" />
          claim gas {claimFeeLoading || claimFeeFj == null ? '…' : `~${claimFeeFj} FJ`}
        </span>
      </div>

      {!canTopUp ? (
        <p className="text-12 leading-[16px] text-[#737373]">
          Fee Juice top-up isn&apos;t available on this deployment.
        </p>
      ) : (
        <>
          <p className="text-11 leading-[15px] text-[#737373]">
            Buy with {fundingSymbol} on Ethereum, bridged to Aztec.
            {isPrivacyModeEnabled && (
              <span
                className="ml-1 inline-flex items-center gap-0.5 font-medium text-[#81133B]"
                title="Privacy mode routes the top-up through private (BridgedFPC) fuel so your claim stays anonymous."
              >
                <Icon icon="ph:lock-key-fill" width={11} height={11} />
                Private
              </span>
            )}
          </p>

          {pricesError && (
            <p className="text-11 text-amber-600">Live prices unavailable — using fallback prices</p>
          )}

          {alreadyEnough ? (
            <p className="flex items-center gap-1 text-12 font-medium text-[#17235E]">
              <Icon icon="ph:check-circle-fill" width={14} height={14} />
              You have enough Fee Juice — no top-up needed.
            </p>
          ) : (
            <>
              {/* One-tap auto: recommended amount + immediate top-up (single click, never silent). */}
              <button
                type="button"
                onClick={handleAuto}
                disabled={!autoReady}
                className="w-full flex items-center justify-center gap-1.5 rounded-md border border-[#17235E]/40 bg-[#17235E]/[0.08] px-3 py-2 text-12 font-semibold text-[#17235E] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon icon="ph:magic-wand-fill" width={13} height={13} />
                {topUp.isPending
                  ? 'Topping up…'
                  : recommended
                    ? `Auto top up ~${recommended} ${fundingSymbol}`
                    : 'Calculating…'}
              </button>

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
                      ? `Not enough yet — add ~${recommended} ${fundingSymbol} to cover your claim.`
                      : 'Not enough yet — increase the amount.'
                    : `Covers your claim (~${feeLimitFj ?? claimFeeFj} FJ needed).`}
                </p>
              )}
            </>
          )}

          {!walletsReady && !alreadyEnough && (
            <p className="text-11 text-[#737373]">Connect both wallets to buy Fee Juice.</p>
          )}

          {!alreadyEnough && (
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
          )}

          {topUp.isPending && (
            <p className="text-11 leading-[15px] text-[#737373]">
              Keep this page open — the bridge to Aztec can take ~5–15 minutes.
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default FeeJuiceTopUp
