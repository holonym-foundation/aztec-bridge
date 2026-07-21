'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Icon } from '@iconify/react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { formatUnits, parseUnits } from 'viem'
import { formatFjAmount, usdToTokenAmount, buildSwapCandidates, getBestRoute } from '@/utils/fuelPricing'
import { checkFuelSufficiency } from '@/utils/fuelGasEstimate'
import { BRIDGED_FPC_ADDRESS, L1_RPC_URL, L1_TOKENS, SWAP_BRIDGE_ROUTER_ADDRESS } from '@/config'
import { useTokenPrices } from '@/utils/coinGeckoPrice'
import { useClaimFeeEstimate } from '@/hooks/useL2Operations'
import { useL1TopUpFeeJuice } from '@/hooks/useL1Operations'
import { useWalletStore } from '@/stores/walletStore'

interface WithdrawFuelPanelProps {
  /** Public L2 Fee Juice balance (what pays the L2 burn gas). */
  feeJuiceBalance?: string
  /** BridgedFPC balance — shown for context when privacy mode is on. */
  privateFeeJuiceBalance?: string
  feeJuiceBalanceLoading?: boolean
  privateFeeJuiceBalanceLoading?: boolean
  isPrivacyModeEnabled?: boolean
  /** The withdraw amount the user has entered (drives the "you have an active withdraw" nudge). */
  bridgeAmount?: string
}

const USD_PRESETS = [1, 5, 10]

/**
 * Real V4 on-chain quote for `tokenAmount` of the L1 funding token → FeeJuice,
 * debounced by 500ms. Mirrors FuelToggle's useV4FuelQuote so the top-up sizes
 * against the same pool rate the deposit-fuel carve uses.
 */
function useTopUpQuote(
  tokenAmount: string,
  tokenAddress: string,
  tokenDecimals: number,
): { fjOutput: bigint | null; loading: boolean; error: string | null } {
  const [fjOutput, setFjOutput] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const amount = Number(tokenAmount)
    if (!tokenAmount || amount <= 0 || !tokenAddress) {
      setFjOutput(null)
      setError(null)
      return
    }

    let inputRaw: bigint
    try {
      inputRaw = parseUnits(tokenAmount, tokenDecimals)
    } catch {
      setFjOutput(null)
      return
    }
    if (inputRaw <= 0n) {
      setFjOutput(null)
      return
    }

    setLoading(true)
    setError(null)

    const timeout = setTimeout(async () => {
      try {
        const candidates = buildSwapCandidates(tokenAddress as `0x${string}`)
        const best = await getBestRoute({ candidates, inputAmount: inputRaw, l1RpcUrl: L1_RPC_URL })
        setFjOutput(best.expectedOutput)
        setError(null)
      } catch (err) {
        setFjOutput(null)
        const errMsg = err instanceof Error ? err.message : String(err)
        const isRevert = errMsg.includes('reverted') || errMsg.includes('execution reverted')
        setError(isRevert ? 'Swap amount exceeds pool liquidity — try a smaller amount' : 'Quote failed')
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => clearTimeout(timeout)
  }, [tokenAmount, tokenAddress, tokenDecimals])

  return { fjOutput, loading, error }
}

/** Whether the quoted FJ output covers the claim fee for `fuelType`. Debounced on fjOutput. */
function useTopUpSufficiency(
  fjOutput: bigint | null,
  fuelType: 'public' | 'private',
): { sufficient: boolean | null; feeLimitFj: string | null; loading: boolean } {
  const [sufficient, setSufficient] = useState<boolean | null>(null)
  const [feeLimitFj, setFeeLimitFj] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (fjOutput === null || fjOutput === 0n) {
      setSufficient(null)
      setFeeLimitFj(null)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const result = await checkFuelSufficiency(fjOutput, fuelType)
        if (!cancelled) {
          setSufficient(result.sufficient)
          setFeeLimitFj(result.feeLimitFj)
        }
      } catch {
        if (!cancelled) {
          setSufficient(null)
          setFeeLimitFj(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fjOutput, fuelType])

  return { sufficient, feeLimitFj, loading }
}

function QuoteSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 bg-neutral-300 rounded w-3/4" />
      <div className="h-3 bg-neutral-300 rounded w-full" />
    </div>
  )
}

/**
 * Withdraw-direction gas panel (L2 → L1).
 *
 * On a withdrawal the user is already on L2 and the burn tx is paid from their
 * standing Fee Juice. A user with 0 FJ is stuck. There is no direct L2 FJ mint,
 * so this panel reuses the deposit path's mechanism as a standalone action: it
 * buys Fee Juice on L1 and bridges it to L2 via `bridgeL1ToL2` with a `fuel`
 * carve (token → ETH → FeeJuice on Uniswap V4, claimed on L2). Privacy mode
 * routes the top-up through private (BridgedFPC) fuel, matching the deposit path.
 * It auto-expands when the burn would be underfunded (mirrors the deposit-side
 * auto-enable latch).
 */
const WithdrawFuelPanel: React.FC<WithdrawFuelPanelProps> = ({
  feeJuiceBalance,
  privateFeeJuiceBalance,
  feeJuiceBalanceLoading,
  privateFeeJuiceBalanceLoading,
  isPrivacyModeEnabled = false,
  bridgeAmount,
}) => {
  const shouldReduceMotion = useReducedMotion()
  const hasBridgedFpc = !!BRIDGED_FPC_ADDRESS
  const [open, setOpen] = useState(false)

  const { isWaapConnected, isAztecConnected } = useWalletStore()

  // Privacy mode forces private (BridgedFPC) fuel so the topped-up FJ and its L2
  // claim stay anonymous — same enforcement as the deposit-fuel path.
  const fuelType: 'public' | 'private' = isPrivacyModeEnabled && hasBridgedFpc ? 'private' : 'public'

  // The L2 claim fee for the top-up itself is paid via the fuel type in use.
  const { data: claimFeeLimit, isLoading: claimFeeLoading } = useClaimFeeEstimate(fuelType)
  const claimFeeFj = claimFeeLimit != null ? formatFjAmount(claimFeeLimit, 2) : null

  const fjLoading = feeJuiceBalanceLoading
  const fjZero = feeJuiceBalance != null && Number(feeJuiceBalance) === 0
  const underfunded =
    feeJuiceBalance != null &&
    claimFeeLimit != null &&
    Number(feeJuiceBalance) < Number(claimFeeLimit) / 1e18

  // Auto-expand once when the burn would be underfunded — the withdraw analog of
  // the deposit-side one-time auto-enable latch. Reset when funding recovers so a
  // later shortfall re-opens it.
  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (underfunded && !autoOpenedRef.current) {
      autoOpenedRef.current = true
      setOpen(true)
    } else if (!underfunded) {
      autoOpenedRef.current = false
    }
  }, [underfunded])

  // ── Standalone "buy + bridge Fee Juice" top-up ──────────────────────
  const fundingToken = L1_TOKENS[0]
  const fundingSymbol = fundingToken?.symbol ?? 'USDC'
  const fundingDecimals = fundingToken?.decimals ?? 6
  const fundingAddress = fundingToken?.l1TokenContract ?? ''
  const canTopUp = !!SWAP_BRIDGE_ROUTER_ADDRESS && (!isPrivacyModeEnabled || hasBridgedFpc) && !!fundingAddress

  const { prices, error: pricesError } = useTokenPrices()
  const [spendAmount, setSpendAmount] = useState('')

  // Carve almost the entire spend into Fee Juice: the SDK requires fuel < amount
  // strictly, so we leave a single base-unit of the token behind (negligible dust
  // that lands on L2 as the paired token). The swap is quoted on this fuel amount.
  const fuelAmount = (() => {
    if (!spendAmount || Number(spendAmount) <= 0) return ''
    try {
      const raw = parseUnits(spendAmount, fundingDecimals)
      if (raw <= 1n) return ''
      return formatUnits(raw - 1n, fundingDecimals)
    } catch {
      return ''
    }
  })()

  const { fjOutput, loading: quoteLoading, error: quoteError } = useTopUpQuote(fuelAmount, fundingAddress, fundingDecimals)
  const { sufficient, feeLimitFj, loading: sufficiencyLoading } = useTopUpSufficiency(fjOutput, fuelType)

  const topUp = useL1TopUpFeeJuice(() => {
    setSpendAmount('')
  })

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
    sufficient === false ||
    topUp.isPending

  const handleConfirm = () => {
    if (confirmDisabled) return
    topUp.mutate({
      tokenSymbol: fundingSymbol,
      spendAmount,
      fuelAmount,
      fuelType,
    })
  }

  const detailId = 'withdraw-fuel-detail'

  return (
    <div className="bg-[#F5F5F5] rounded-md p-3 mt-3 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={detailId}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <Icon icon="ph:gas-pump-fill" width={14} height={14} className="shrink-0 text-[#17235E]" />
          <span className="text-sm font-medium text-latest-grey-700">L2 gas for withdrawal</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M1 3L5 7L9 3" stroke="#747474" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {underfunded && (
          <Icon
            icon="ph:warning-circle-fill"
            width={15}
            height={15}
            className="shrink-0 text-[#D92D20]"
            data-tooltip-id="withdraw-fj-warning"
            data-tooltip-content="Not enough Fee Juice to pay L2 gas for this withdrawal."
          />
        )}
      </button>

      <div className="mt-1 flex items-center justify-between text-xs text-latest-grey-500">
        <span>
          Est. L2 burn gas{' '}
          <span className="font-semibold text-latest-black-300">
            {claimFeeLoading || claimFeeFj == null ? '…' : `~${claimFeeFj} FJ`}
          </span>
        </span>
        <span className="flex items-center gap-1">
          you have
          {fjLoading ? (
            <span className="inline-block h-2.5 w-10 bg-neutral-300 rounded animate-pulse" />
          ) : (
            <span className={`font-semibold ${underfunded || fjZero ? 'text-[#D92D20]' : ''}`}>
              {feeJuiceBalance ?? '--'} FJ
            </span>
          )}
        </span>
      </div>
      <ReactTooltip
        id="withdraw-fj-warning"
        place="top"
        className="z-[100]"
        style={{ fontSize: '12px', maxWidth: '220px' }}
      />

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={detailId}
            key="withdraw-fuel-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {hasBridgedFpc && isPrivacyModeEnabled && (
                <div className="flex justify-between items-center h-4 text-xs text-latest-grey-500">
                  <span>Private Fee Juice:</span>
                  <span className="font-semibold">
                    {privateFeeJuiceBalanceLoading ? (
                      <span className="inline-block h-2.5 w-12 bg-neutral-300 rounded animate-pulse" />
                    ) : (
                      (privateFeeJuiceBalance ?? '--')
                    )}
                  </span>
                </div>
              )}

              {underfunded ? (
                <div className="flex items-start gap-1.5 rounded-[8px] bg-[#FDECEC] px-2.5 py-1.5">
                  <Icon
                    icon="ph:warning-circle-fill"
                    width={13}
                    height={13}
                    className="mt-0.5 flex-shrink-0 text-[#D92D20]"
                  />
                  <p className="text-[11px] leading-[15px] text-[#737373]">
                    <span className="font-semibold text-[#D92D20]">Not enough Fee Juice.</span> This withdrawal burns on
                    Aztec and needs <span className="font-semibold">≈{claimFeeFj} FJ</span> for L2 gas, but you have{' '}
                    <span className="font-semibold">{feeJuiceBalance ?? '--'} FJ</span>.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 rounded-[8px] bg-[#E5EFFF] px-2.5 py-1.5">
                  <Icon icon="ph:lightning-fill" width={13} height={13} className="mt-0.5 flex-shrink-0 text-[#17235E]" />
                  <p className="text-[11px] leading-[15px] text-[#737373]">
                    <span className="font-semibold text-[#0A0A0A]">Fee Juice is gas on Aztec.</span> Withdrawing burns
                    your tokens on L2, so you need <span className="font-semibold">≈{claimFeeFj ?? '…'} FJ</span> on hand
                    to pay for it.
                  </p>
                </div>
              )}

              {/* Real top-up: buy Fee Juice on L1 and bridge it to L2 (same mechanism as
                  deposit-fuel — bridgeL1ToL2 with a fuel carve via SwapBridgeRouter). */}
              <div className="rounded-[8px] border border-[#81133B]/40 bg-[#F9EEF3] px-2.5 py-2 space-y-2">
                <p className="text-[11px] font-semibold text-[#81133B]">Add Fee Juice</p>

                {!canTopUp ? (
                  <p className="text-[11px] leading-[15px] text-[#737373]">
                    Fee Juice top-up isn&apos;t available on this deployment. Bridge in with{' '}
                    <span className="font-semibold">Top up gas balance</span> on the Deposit tab, then return to withdraw.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] leading-[15px] text-[#737373]">
                      Buy Fee Juice with {fundingSymbol} on Ethereum and bridge it to Aztec — no need to switch tabs.
                      Almost all of it converts to Fee Juice; a negligible remainder lands on L2 as c{fundingSymbol}.
                    </p>

                    {isPrivacyModeEnabled && (
                      <div className="flex items-start gap-1.5 rounded-[6px] bg-white/60 px-2 py-1.5">
                        <Icon icon="ph:lock-key-fill" width={12} height={12} className="mt-0.5 flex-shrink-0 text-[#81133B]" />
                        <p className="text-[11px] leading-[15px] text-[#737373]">
                          <span className="font-semibold text-[#81133B]">Private Fee Juice.</span> Privacy mode routes the
                          top-up through private (BridgedFPC) fuel so your withdrawal stays anonymous.
                        </p>
                      </div>
                    )}

                    {pricesError && (
                      <p className="text-[11px] text-amber-600">Live prices unavailable — using fallback prices</p>
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
                    {amountValid && quoteError && <p className="text-[11px] text-red-500">{quoteError}</p>}
                    {amountValid && !quoteLoading && !quoteError && fjOutput !== null && (
                      <div className="text-[11px] leading-[15px] text-latest-grey-700 space-y-0.5">
                        <p>
                          {spendAmount} {fundingSymbol} → <span className="font-semibold">~{formatFjAmount(fjOutput)} FJ</span>
                        </p>
                        {!sufficiencyLoading && sufficient === false && (
                          <p className="text-[#D92D20] font-medium">
                            Not enough: ~{formatFjAmount(fjOutput)} FJ from this swap but ~{feeLimitFj} FJ needed for the L2
                            claim. Increase the amount.
                          </p>
                        )}
                        {!sufficiencyLoading && sufficient === true && (
                          <p className="text-[#17235E]">Covers the L2 claim (~{feeLimitFj} FJ needed).</p>
                        )}
                      </div>
                    )}

                    {!walletsReady && (
                      <p className="text-[11px] text-[#737373]">Connect both wallets to buy Fee Juice.</p>
                    )}

                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={confirmDisabled}
                      className="w-full flex items-center justify-center gap-1.5 rounded-md bg-[#81133B] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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

                    {topUp.isPending && (
                      <p className="text-[11px] leading-[15px] text-[#737373]">
                        Keep this page open — the bridge to Aztec can take ~5–15 minutes.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default WithdrawFuelPanel
