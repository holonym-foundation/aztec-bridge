'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Icon } from '@iconify/react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { AztecAddress } from '@aztec/stdlib/aztec-address'
import { formatFjAmount, getFeeJuicePriceUsd, getTokenPriceUsd, usdToTokenAmount } from '@/utils/fuelPricing'
import { buildSwapCandidates, getBestRoute } from '@/utils/fuelPricing'
import { BRIDGED_FPC_ADDRESS, L1_RPC_URL } from '@/config'
import { useTokenPrices } from '@/utils/coinGeckoPrice'
import { useClaimFeeEstimate } from '@/hooks/useL2Operations'

interface FuelToggleProps {
  fuelEnabled: boolean
  fuelAmount: string
  bridgeAmount: string
  // Token amount received on L2 after the fuel carve-out AND the portal fee. Passed in
  // (rather than derived from bridge - fuel) so it matches the main "You will receive".
  youWillReceive?: string
  tokenSymbol: string
  tokenDecimals: number
  tokenAddress: string
  onToggle: (enabled: boolean) => void
  onAmountChange: (amount: string) => void
  feeJuiceBalance?: string
  privateFeeJuiceBalance?: string
  feeJuiceBalanceLoading?: boolean
  privateFeeJuiceBalanceLoading?: boolean
  fuelType: 'public' | 'private'
  onFuelTypeChange: (type: 'public' | 'private') => void
  onSufficiencyChange?: (sufficient: boolean) => void
  /**
   * Whether the third-party fuel-recipient form is in a valid state. The parent uses this to
   * gate the bridge button so we don't accept an unparseable address.
   */
  onRecipientValidityChange?: (valid: boolean) => void
  // Fuel is carved OUT of the bridge amount, so the SDK requires `fuel < bridge` strictly.
  onFuelAmountValidChange?: (valid: boolean) => void
  isPrivacyModeEnabled?: boolean
  /** L2 address of the bridger — used as the default fuel recipient and for "self" comparisons. */
  selfAztecAddress?: string
  fuelRecipientOverride: string
  onFuelRecipientOverrideChange: (address: string) => void
  /** Controlled detail-accordion state, so the parent can enforce mutual exclusivity with the
   * Transaction breakdown (opening one collapses the other → the card fits with no scroll). */
  detailOpen?: boolean
  onDetailOpenChange?: (open: boolean) => void
  /** Surfaces the live V4 quote (FJ output for the current fuel amount) so the breakdown can
   * show where the reserved token goes. Null when fuel is off or the amount is invalid. */
  onFuelQuoteChange?: (fjOutput: bigint | null) => void
}

const USD_PRESETS = [1, 5, 10]

// Never silently auto-reserve more than this fraction of the bridge for gas. On a healthy
// pool the real requirement is far below this and the cap never binds; on a mis-priced testnet
// pool it stops the auto-fill from quietly eating half the deposit — we cap + warn + let the
// user opt into the full (honest) amount instead.
const MAX_AUTOFILL_FRACTION = 0.25

// Motion values mirrored from the human-tech design system (docs/tokens.css):
// --dur-normal / --ease-default for the inline detail accordion reveal.
const DS_DUR_NORMAL = 0.28
const DS_EASE_DEFAULT: [number, number, number, number] = [0.4, 0, 0.2, 1]

/**
 * Hook that fetches a real V4 on-chain quote, debounced by 500ms.
 */
function useV4FuelQuote(
  fuelAmount: string,
  tokenAddress: string,
  tokenDecimals: number,
): { fjOutput: bigint | null; loading: boolean; error: string | null } {
  const [fjOutput, setFjOutput] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const amount = Number(fuelAmount)
    if (!fuelAmount || amount <= 0 || !tokenAddress) {
      setFjOutput(null)
      setError(null)
      return
    }

    const inputRaw = BigInt(Math.floor(amount * 10 ** tokenDecimals))
    if (inputRaw <= 0n) {
      setFjOutput(null)
      return
    }

    setLoading(true)
    setError(null)

    const timeout = setTimeout(async () => {
      try {
        const candidates = buildSwapCandidates(tokenAddress as `0x${string}`)
        const best = await getBestRoute({
          candidates,
          inputAmount: inputRaw,
          l1RpcUrl: L1_RPC_URL,
        })
        console.log(
          `[FuelToggle] Best route: ${best.route.label} → ${(Number(best.expectedOutput) / 1e18).toFixed(4)} FJ`,
        )
        setFjOutput(best.expectedOutput)
        setError(null)
      } catch (err) {
        console.error('[FuelToggle] V4 quote failed:', err)
        setFjOutput(null)
        const errMsg = err instanceof Error ? err.message : String(err)
        const isRevert = errMsg.includes('reverted') || errMsg.includes('execution reverted')
        setError(isRevert ? 'Swap amount exceeds pool liquidity — try a smaller amount' : 'Quote failed')
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => clearTimeout(timeout)
  }, [fuelAmount, tokenAddress, tokenDecimals])

  return { fjOutput, loading, error }
}

/**
 * Compute a fuel token amount expected to cover the L2 claim gas.
 *
 * We probe the actual V4 pool for its real FeeJuice-per-token rate rather than
 * trusting the FJ price feed, because off mainnet the feed and the pool diverge wildly,
 * so any price-based sizing is wrong. The price feed is used only to pick a
 * sensible probe *size*; the rate that sizes the recommendation comes from the
 * on-chain quote. The live sufficiency check downstream still validates the result.
 */
interface FuelRecommendation {
  /** Amount to actually pre-fill — the honest amount, clamped to the sane ceiling. */
  amount: string
  /** Full token amount that covers the L2 claim gas at the current pool rate (uncapped). */
  honestAmount: string
  forType: 'public' | 'private'
  /** True when the honest amount exceeded the sane ceiling, so `amount` is the capped value. */
  capped: boolean
  /** Honest amount as a percentage of the bridge amount (for the warning copy). */
  honestPct: number
}

function useRecommendedFuelAmount(
  enabled: boolean,
  fuelType: 'public' | 'private',
  claimFeeLimit: bigint | undefined,
  existingFj: number,
  tokenAddress: string,
  tokenDecimals: number,
  tokenSymbol: string,
  bridgeNum: number,
  prices: Record<string, number> | null | undefined,
): FuelRecommendation | null {
  // Tagged with the fuel type it was computed for, so a stale (previous-mode) value is
  // never applied to the current mode during a public<->private switch.
  const [recommended, setRecommended] = useState<FuelRecommendation | null>(null)

  useEffect(() => {
    // Clear any stale recommendation immediately so consumers never act on a value
    // sized for a different fuel type while the new probe is still in flight.
    setRecommended(null)
    if (!enabled || claimFeeLimit == null || !tokenAddress || bridgeNum <= 0) return
    let cancelled = false
    const timeout = setTimeout(async () => {
      try {
        const needFj = Number(claimFeeLimit) / 1e18
        // Existing FJ already covers the claim → recommend nothing (no top-up required).
        if (existingFj >= needFj) return
        // PUBLIC: only the shortfall needs bridging (existing + claimed pay together).
        // PRIVATE: the fresh bridge self-funds its landing claim, so size to the whole claim.
        const requiredFj = fuelType === 'public' ? needFj - existingFj : needFj
        const fjUsd = getFeeJuicePriceUsd(prices)
        const tokenUsd = getTokenPriceUsd(tokenSymbol, prices)
        // Order-of-magnitude probe size (not the rate; the rate is measured on-chain).
        const guess = tokenUsd > 0 && fjUsd > 0 ? (requiredFj * fjUsd) / tokenUsd : bridgeNum * 0.05
        const probeToken = Math.min(Math.max(guess, 1e-6), bridgeNum * 0.9)
        const probeRaw = BigInt(Math.floor(probeToken * 10 ** tokenDecimals))
        if (probeRaw <= 0n) return
        const candidates = buildSwapCandidates(tokenAddress as `0x${string}`)
        const best = await getBestRoute({ candidates, inputAmount: probeRaw, l1RpcUrl: L1_RPC_URL })
        if (cancelled || best.expectedOutput <= 0n) return
        const fjPerToken = Number(best.expectedOutput) / 1e18 / probeToken
        if (fjPerToken <= 0) return
        const BUFFER = 1.3 // headroom for price impact between probe and final size + swap slippage
        // Honest amount that actually covers gas at the measured pool rate. On a healthy pool this
        // is tiny; on a mis-priced testnet pool it can be a huge fraction of the bridge — which is
        // why we never blindly pre-fill it (see the cap below).
        const recToken = (requiredFj * BUFFER) / fjPerToken
        // Round the honest amount UP to a token-aware precision (~$0.01 granularity), so it's a
        // clean number without ever dipping below the computed (buffered) amount. Cheap
        // tokens like USDC get 2 dp; high-value tokens (WBTC) keep more so it's not coarse.
        const centsDecimals = tokenUsd > 0 ? Math.ceil(Math.log10(tokenUsd) + 2) : 2
        const displayDecimals = Math.min(Math.max(centsDecimals, 2), tokenDecimals)
        const factor = 10 ** displayDecimals
        const honestRounded = Math.ceil(recToken * factor) / factor
        // Sane ceiling: the auto-fill never silently exceeds MAX_AUTOFILL_FRACTION of the bridge.
        // When the honest requirement is above the ceiling the pool rate is unusable — we pre-fill
        // the capped amount and the UI warns + offers a one-tap opt-in to the full honest amount.
        const ceiling = bridgeNum * MAX_AUTOFILL_FRACTION
        const capped = honestRounded > ceiling
        const autoFill = capped ? Math.max(Math.floor(ceiling * factor) / factor, 0) : honestRounded
        const honestPct = bridgeNum > 0 ? (honestRounded / bridgeNum) * 100 : 0
        if (honestRounded > 0 && !cancelled) {
          setRecommended({
            amount: String(autoFill),
            honestAmount: String(honestRounded),
            forType: fuelType,
            capped,
            honestPct,
          })
        }
      } catch {
        if (!cancelled) setRecommended(null)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [enabled, fuelType, claimFeeLimit, existingFj, tokenAddress, tokenDecimals, tokenSymbol, bridgeNum, prices])

  return recommended
}

/**
 * Hook that checks whether the expected FJ output is sufficient to cover L2 claim gas costs.
 * Debounced: only runs when fjOutput changes and is non-null.
 */
function useFuelSufficiency(fjOutput: bigint | null, fuelType: 'public' | 'private'): {
  sufficient: boolean | null
  feeLimitFj: string | null
  loading: boolean
} {
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
        const { checkFuelSufficiency } = await import('@/utils/fuelGasEstimate')
        const result = await checkFuelSufficiency(fjOutput, fuelType)
        if (!cancelled) {
          setSufficient(result.sufficient)
          setFeeLimitFj(result.feeLimitFj)
        }
      } catch (err) {
        console.warn('[FuelToggle] Sufficiency check failed:', err)
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
      <div className="h-4 bg-neutral-300 rounded w-3/4" />
      <div className="h-4 bg-neutral-300 rounded w-full" />
    </div>
  )
}

function shortenAztecAddress(addr: string): string {
  if (!addr) return ''
  if (addr.length <= 14) return addr
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

const FuelToggle: React.FC<FuelToggleProps> = ({
  fuelEnabled,
  fuelAmount,
  bridgeAmount,
  youWillReceive,
  tokenSymbol,
  tokenDecimals,
  tokenAddress,
  onToggle,
  onAmountChange,
  feeJuiceBalance,
  privateFeeJuiceBalance,
  feeJuiceBalanceLoading,
  privateFeeJuiceBalanceLoading,
  fuelType,
  onFuelTypeChange,
  onSufficiencyChange,
  onRecipientValidityChange,
  onFuelAmountValidChange,
  isPrivacyModeEnabled = false,
  selfAztecAddress = '',
  fuelRecipientOverride,
  onFuelRecipientOverrideChange,
  detailOpen: detailOpenProp,
  onDetailOpenChange,
  onFuelQuoteChange,
}) => {
  const bridgeNum = Number(bridgeAmount) || 0
  const fuelNum = Number(fuelAmount) || 0
  const isValid = fuelNum > 0 && fuelNum < bridgeNum
  const netBridge = bridgeNum - fuelNum
  const hasBridgedFpc = !!BRIDGED_FPC_ADDRESS
  const shouldReduceMotion = useReducedMotion()

  // The enable switch and the detail accordion are independent: fuel top-up defaults ON
  // (business logic), but its editing UI (public/private, amount, send-to) stays collapsed
  // until the user asks for it — this is what keeps the card in-viewport by default.
  // Controlled when the parent passes detailOpen/onDetailOpenChange (used to enforce mutual
  // exclusivity with the Transaction breakdown), otherwise falls back to local state.
  const [detailOpenInternal, setDetailOpenInternal] = useState(false)
  const detailOpen = detailOpenProp ?? detailOpenInternal
  const setDetailOpen = (next: boolean | ((open: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(detailOpen) : next
    if (onDetailOpenChange) onDetailOpenChange(value)
    else setDetailOpenInternal(value)
  }
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Worst-case FeeJuice the final L2 claim will cost, surfaced up front so the
  // user knows the gas requirement before committing the (irreversible) deposit.
  const { data: claimFeeLimit, isLoading: claimFeeLoading } = useClaimFeeEstimate(fuelType)
  const claimFeeFj = claimFeeLimit != null ? formatFjAmount(claimFeeLimit, 2) : null

  // Only the FeeJuice balance for the active fuel mode is relevant: public fuel
  // pays the claim from the user's own FJ, private fuel from the BridgedFPC.
  const usePrivateFj = fuelType === 'private' && hasBridgedFpc
  const activeFjBalance = usePrivateFj ? privateFeeJuiceBalance : feeJuiceBalance
  const activeFjLoading = usePrivateFj ? privateFeeJuiceBalanceLoading : feeJuiceBalanceLoading
  const activeFjZero = activeFjBalance != null && Number(activeFjBalance) === 0
  // Existing FeeJuice in the active mode's balance. For PUBLIC fuel this pays the L2 claim
  // alongside freshly-claimed FJ (existing + swap pay together), so it counts toward sufficiency.
  // For PRIVATE fuel the fresh bridge self-funds its own landing claim (BridgedFPC mint_and_pay_fee
  // asserts the fresh amount alone covers gas, issue #47), so existing private FJ does NOT pay that
  // claim — it only means "no top-up needed" when it already covers the claim on its own.
  const existingActiveFj =
    activeFjBalance != null && activeFjBalance !== '--' ? Number(activeFjBalance) : 0

  // Privacy mode drives fuel type: a private deposit requires private (BridgedFPC) fuel.
  // Force private while privacy is on, and default back to public when it turns off
  // (else fuelType stays stuck on 'private' and the FJ estimate never reverts). The
  // off->public reset is transition-only so the Public/Private tabs stay usable.
  const prevPrivacyRef = useRef(isPrivacyModeEnabled)
  useEffect(() => {
    if (isPrivacyModeEnabled && fuelType !== 'private') {
      onFuelTypeChange('private')
    } else if (prevPrivacyRef.current && !isPrivacyModeEnabled && fuelType !== 'public') {
      onFuelTypeChange('public')
    }
    prevPrivacyRef.current = isPrivacyModeEnabled
  }, [isPrivacyModeEnabled, fuelType, onFuelTypeChange])

  // Recipient-override UI is only shown for public fuel; private fuel always routes to the FPC.
  const recipientOverrideAvailable = fuelType === 'public'
  const [recipientOverrideOpen, setRecipientOverrideOpen] = useState(false)
  // Auto-open the override section if the store already has an address (e.g. on page reload).
  useEffect(() => {
    if (recipientOverrideAvailable && fuelRecipientOverride.trim().length > 0) {
      setRecipientOverrideOpen(true)
    }
  }, [recipientOverrideAvailable, fuelRecipientOverride])
  // Close + clear when fuel mode flips to private (FJ goes to FPC, not a user L2).
  useEffect(() => {
    if (!recipientOverrideAvailable) {
      setRecipientOverrideOpen(false)
      if (fuelRecipientOverride.length > 0) onFuelRecipientOverrideChange('')
    }
  }, [recipientOverrideAvailable, fuelRecipientOverride, onFuelRecipientOverrideChange])

  const recipientStatus = useMemo<{
    valid: boolean
    isThirdParty: boolean
    error: string | null
    parsed: string | null
  }>(() => {
    const raw = fuelRecipientOverride.trim()
    if (raw.length === 0) {
      return { valid: true, isThirdParty: false, error: null, parsed: null }
    }
    try {
      const parsed = AztecAddress.fromStringUnsafe(raw).toString()
      const isSelf = !!selfAztecAddress && parsed.toLowerCase() === selfAztecAddress.toLowerCase()
      return { valid: true, isThirdParty: !isSelf, error: null, parsed }
    } catch {
      return { valid: false, isThirdParty: false, error: 'Not a valid Aztec address', parsed: null }
    }
  }, [fuelRecipientOverride, selfAztecAddress])

  // Inline confirmation that the user understands FJ is non-transferable. Only required when
  // the recipient resolves to a third-party L2 (different from self).
  const [confirmedThirdParty, setConfirmedThirdParty] = useState(false)
  useEffect(() => {
    // Reset the checkbox when the override clears or flips to self — guards against stale consent.
    if (!recipientStatus.isThirdParty) setConfirmedThirdParty(false)
  }, [recipientStatus.isThirdParty])

  // Bubble validity up so the parent can disable the bridge button if the override is broken
  // or the third-party warning hasn't been acknowledged.
  useEffect(() => {
    const ok =
      !recipientOverrideAvailable ||
      fuelRecipientOverride.trim().length === 0 ||
      (recipientStatus.valid && (!recipientStatus.isThirdParty || confirmedThirdParty))
    onRecipientValidityChange?.(ok)
  }, [
    recipientOverrideAvailable,
    fuelRecipientOverride,
    recipientStatus.valid,
    recipientStatus.isThirdParty,
    confirmedThirdParty,
    onRecipientValidityChange,
  ])

  const { prices, isLoading: pricesLoading, error: pricesError } = useTokenPrices()

  const { fjOutput, loading, error } = useV4FuelQuote(isValid ? fuelAmount : '', tokenAddress, tokenDecimals)
  // feeLimitFj/sufficiencyLoading feed the copy; the actual sufficiency decision is computed
  // below crediting the user's EXISTING FJ (mode-aware), not from the swap output alone.
  const { feeLimitFj, loading: sufficiencyLoading } = useFuelSufficiency(fjOutput, fuelType)

  // Mode-aware sufficiency (mirrors the /fee-juice FeeJuiceTopUp fix):
  //  - needFj: worst-case FJ the L2 claim costs.
  //  - PUBLIC: existing public FJ + freshly-claimed swap FJ pay the claim together
  //    → sufficient when (existingActiveFj + swapFj) >= needFj; and if existingActiveFj >= needFj
  //      the user is fully covered and needs no top-up at all.
  //  - PRIVATE: the fresh bridge must self-fund its landing claim → swapFj alone must clear needFj
  //    (but existing private FJ >= needFj still means "already covered, no top-up needed").
  const needFj = claimFeeLimit != null ? Number(claimFeeLimit) / 1e18 : null
  const swapFj = fjOutput != null ? Number(fjOutput) / 1e18 : null
  const alreadyCovered = needFj != null && existingActiveFj >= needFj
  const effectiveSufficient: boolean | null = alreadyCovered
    ? true
    : needFj == null || swapFj == null
      ? null
      : usePrivateFj
        ? swapFj >= needFj
        : existingActiveFj + swapFj >= needFj

  useEffect(() => {
    if (!fuelEnabled) {
      onSufficiencyChange?.(true)
      return
    }
    // Existing balance already covers the claim → sufficient regardless of any swap.
    if (alreadyCovered) {
      onSufficiencyChange?.(true)
      return
    }
    if (!isValid) {
      onSufficiencyChange?.(true)
      return
    }
    if (!sufficiencyLoading && effectiveSufficient !== null) {
      onSufficiencyChange?.(effectiveSufficient)
    }
  }, [fuelEnabled, isValid, alreadyCovered, effectiveSufficient, sufficiencyLoading, onSufficiencyChange])

  useEffect(() => {
    onFuelAmountValidChange?.(!fuelEnabled || isValid)
  }, [fuelEnabled, isValid, onFuelAmountValidChange])

  // Surface the live FJ quote up to the parent so the Transaction breakdown can show the
  // fee-juice destination. Null whenever fuel is off or the amount is invalid.
  useEffect(() => {
    onFuelQuoteChange?.(fuelEnabled && isValid ? fjOutput : null)
  }, [fuelEnabled, isValid, fjOutput, onFuelQuoteChange])

  // Auto-size: when gas top-up is switched on with no amount yet, pre-fill an amount
  // sized from the real pool rate to cover the L2 claim gas. One-time per enable
  // (ref resets on toggle-off) so we never fight a user who edits the field.
  const recommendedFuel = useRecommendedFuelAmount(
    fuelEnabled,
    fuelType,
    claimFeeLimit,
    existingActiveFj,
    tokenAddress,
    tokenDecimals,
    tokenSymbol,
    bridgeNum,
    prices,
  )
  // Track which fuel type we last auto-sized for. Fill on first enable (only if the
  // user hasn't typed their own amount), and re-fill whenever the fuel type changes,
  // since public vs private have different requirements. recommendedFuel is null while
  // the new-mode probe is in flight, so we always fill with a value sized for this mode.
  const autoSizedForRef = useRef<'public' | 'private' | null>(null)
  useEffect(() => {
    if (!fuelEnabled) {
      autoSizedForRef.current = null
      return
    }
    // Only apply a recommendation computed for the current fuel type (guards the
    // switch race where a stale previous-mode value is still in state).
    if (!recommendedFuel || recommendedFuel.forType !== fuelType) return
    const firstFill = autoSizedForRef.current === null && !fuelAmount
    const modeChanged = autoSizedForRef.current !== null && autoSizedForRef.current !== fuelType
    if (!firstFill && !modeChanged) return
    autoSizedForRef.current = fuelType
    onAmountChange(recommendedFuel.amount)
  }, [fuelEnabled, fuelType, fuelAmount, recommendedFuel, onAmountChange])

  // Check which USD preset is currently selected (if any)
  const activePreset = USD_PRESETS.find((usd) => fuelAmount === usdToTokenAmount(usd, tokenSymbol, prices))

  const detailId = 'fuel-toggle-detail'

  return (
    <div className="bg-[#F5F5F5] rounded-md p-2.5 mt-1.5 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 min-w-0 text-left disabled:cursor-default"
          onClick={() => setDetailOpen((open) => !open)}
          disabled={!fuelEnabled}
          aria-expanded={fuelEnabled && detailOpen}
          aria-controls={detailId}
        >
          <span className="text-sm font-medium text-latest-grey-700">Top up gas balance</span>
          {fuelEnabled && (
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              className={`shrink-0 transition-transform ${detailOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <path d="M1 3L5 7L9 3" stroke="#747474" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={fuelEnabled}
          aria-label="Enable gas top-up"
          className="relative shrink-0"
          onClick={() => onToggle(!fuelEnabled)}
        >
          <div
            className="w-9 h-5 rounded-full transition-colors"
            style={{ backgroundColor: fuelEnabled ? '#81133B' : '#d1d5db' }}
          />
          <div
            className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
            style={{
              transform: fuelEnabled ? 'translateX(1rem)' : 'translateX(0)',
            }}
          />
        </button>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-xs text-latest-grey-500">
        <span>
          Est. L2 txn gas{' '}
          <span className="font-semibold text-latest-black-300">
            {claimFeeLoading || claimFeeFj == null ? '…' : `~${claimFeeFj} FJ`}
          </span>
        </span>
        <span className="flex items-center gap-1">
          you have
          {activeFjLoading ? (
            <span className="inline-block h-2.5 w-10 bg-neutral-300 rounded animate-pulse" />
          ) : activeFjZero ? (
            <>
              <Icon
                icon="ph:warning-circle-fill"
                width={13}
                height={13}
                className="text-[#D92D20]"
                data-tooltip-id="fj-warning"
                data-tooltip-content="You need Fee Juice to complete the bridge transaction."
              />
              <span
                className="font-semibold text-[#D92D20]"
                data-tooltip-id="fj-warning"
                data-tooltip-content="You need Fee Juice to complete the bridge transaction."
              >
                {activeFjBalance} FJ
              </span>
            </>
          ) : (
            <span className="font-semibold">{activeFjBalance ?? '--'} FJ</span>
          )}
        </span>
      </div>
      <ReactTooltip id="fj-warning" place="top" className="z-[100]" style={{ fontSize: '12px', maxWidth: '220px' }} />

      {/* Already covered: the user's existing FJ meets the claim requirement, so no top-up is
          needed. Show a calm, non-alarming note (never the red bad-rate warning). */}
      {fuelEnabled && alreadyCovered && (
        <div className="mt-2 flex items-start gap-1.5 rounded-[8px] bg-[#17235E]/[0.08] px-2.5 py-1.5">
          <Icon icon="ph:check-circle-fill" width={13} height={13} className="mt-0.5 flex-shrink-0 text-[#17235E]" />
          <p className="text-[11px] leading-[15px] text-[#737373]">
            <span className="font-semibold text-[#17235E]">You have enough Fee Juice.</span> Top-up is optional.
          </p>
        </div>
      )}

      {/* Bad-rate guard: only when a top-up is ACTUALLY needed (a genuine shortfall — existing FJ
          doesn't cover the claim) AND the testnet pool would charge more than the sane ceiling to
          buy the shortfall. We cap the auto-reserve instead of silently spending it — and say so,
          with a one-tap opt-in to the honest amount. Hidden entirely once the user is covered. */}
      {fuelEnabled && !alreadyCovered && recommendedFuel?.capped && fuelNum < Number(recommendedFuel.honestAmount) && (
        <div className="mt-2 flex items-start gap-1.5 rounded-[8px] bg-[#FDECEC] px-2.5 py-1.5">
          <Icon icon="ph:warning-circle-fill" width={13} height={13} className="mt-0.5 flex-shrink-0 text-[#D92D20]" />
          <div className="text-[11px] leading-[15px] text-[#737373]">
            <span className="font-semibold text-[#D92D20]">Gas swap rate is unusually high on testnet.</span>{' '}
            Fully covering L2 gas would cost ~{recommendedFuel.honestAmount} {tokenSymbol} (
            {recommendedFuel.honestPct.toFixed(0)}% of your bridge). We reserved a capped{' '}
            {fuelAmount || '0'} {tokenSymbol} — edit it below, turn gas top-up off, or:
            <button
              type="button"
              onClick={() => {
                setDetailOpen(true)
                onAmountChange(recommendedFuel.honestAmount)
              }}
              className="mt-1 block font-semibold text-[#81133B] hover:underline"
            >
              Reserve {recommendedFuel.honestAmount} {tokenSymbol} to fully cover gas
            </button>
          </div>
        </div>
      )}

      {fuelEnabled && !detailOpen && (
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="mt-1 flex w-full items-center gap-1 text-left text-xs font-medium text-[#17235E] transition-colors hover:underline"
        >
          <Icon icon="ph:sliders-horizontal-fill" width={12} height={12} className="flex-shrink-0" />
          {fuelNum > 0 ? `${fuelAmount} ${tokenSymbol} reserved for gas. Edit amount` : 'Set an amount'}
        </button>
      )}

      <AnimatePresence initial={false}>
        {fuelEnabled && detailOpen && (
          <motion.div
            id={detailId}
            key="fuel-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : DS_DUR_NORMAL, ease: DS_EASE_DEFAULT }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              <div className="text-xs text-latest-grey-500 space-y-0.5">
                <div className="flex justify-between items-center h-4">
                  <span>Public Fee Juice:</span>
                  <span className="font-semibold">
                    {feeJuiceBalanceLoading ? (
                      <span className="inline-block h-2.5 w-12 bg-neutral-300 rounded animate-pulse" />
                    ) : (
                      (feeJuiceBalance ?? '--')
                    )}
                  </span>
                </div>
                {hasBridgedFpc && (
                  <div className="flex justify-between items-center h-4">
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
              </div>
              <div className="flex items-start gap-1.5 rounded-[8px] bg-[#E5EFFF] px-2.5 py-1.5">
                <Icon icon="ph:lightning-fill" width={13} height={13} className="mt-0.5 flex-shrink-0 text-[#17235E]" />
                <p className="text-[11px] leading-[15px] text-[#737373]">
                  <span className="font-semibold text-[#0A0A0A]">Fee Juice is gas on Aztec.</span> Add a bit extra so you
                  stay funded for your next transactions.
                </p>
              </div>

              {/* Concrete sizing guidance: tie the fuel amount to the actual L2 claim requirement. */}
              {claimFeeFj != null && (
                <p className="text-[11px] leading-[15px] text-latest-grey-500">
                  Aim for at least{' '}
                  <span className="font-semibold text-[#81133B]">≈{claimFeeFj} FJ</span> to cover the L2 claim — the
                  amount below is auto-sized to reach it.
                </p>
              )}

              {/* Privacy mode pays the claim from private (BridgedFPC) fuel; a public claim would deanonymize. */}
              {isPrivacyModeEnabled && (
                <div className="flex items-start gap-1.5 rounded-[8px] bg-[#F9EEF3] px-2.5 py-1.5">
                  <Icon icon="ph:lock-key-fill" width={13} height={13} className="mt-0.5 flex-shrink-0 text-[#81133B]" />
                  <p className="text-[11px] leading-[15px] text-[#737373]">
                    <span className="font-semibold text-[#81133B]">Private Fee Juice enforced.</span> Privacy mode pays L2
                    gas from private fee juice so your claim stays anonymous.
                  </p>
                </div>
              )}
              {isPrivacyModeEnabled && fuelType === 'public' && (
                <p className="text-[11px] font-medium text-[#D92D20]">
                  Public fee juice reveals your claim — use Private to stay anonymous.
                </p>
              )}

              {pricesError && <p className="text-xs text-amber-600">Live prices unavailable — using fallback prices</p>}

              <div className="flex items-center gap-1.5 max-w-full">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={`Amount in ${tokenSymbol}`}
                  value={fuelAmount}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || !isNaN(Number(v))) onAmountChange(v)
                  }}
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {USD_PRESETS.map((usd) => {
                  const tokenEquiv = usdToTokenAmount(usd, tokenSymbol, prices)
                  return (
                    <button
                      key={usd}
                      onClick={() => onAmountChange(tokenEquiv)}
                      title={`${tokenEquiv} ${tokenSymbol}`}
                      className={`shrink-0 px-1.5 py-1 text-xs rounded border ${
                        activePreset === usd
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      ${usd}
                    </button>
                  )
                })}
              </div>

              {fuelAmount && !isValid && fuelNum >= bridgeNum && (
                <p className="text-xs text-red-500">Gas amount must be less than bridge amount</p>
              )}
              {isValid && (loading || (fjOutput === null && !error)) && <QuoteSkeleton />}
              {isValid && error && <p className="text-xs text-red-500">{error}</p>}
              {isValid && !loading && !error && fjOutput !== null && (
                <div className="text-xs text-latest-grey-700 space-y-0.5">
                  <p>
                    Swapping {fuelNum} {tokenSymbol} → ~{formatFjAmount(fjOutput)} FJ
                  </p>
                  <p>
                    You&apos;ll receive: {youWillReceive ?? Number(netBridge.toFixed(6))} {tokenSymbol} + ~
                    {formatFjAmount(fjOutput)} Fee
                    Juice
                  </p>
                  {!sufficiencyLoading && effectiveSufficient === false && (
                    <p className="text-red font-medium mt-1">
                      Not enough gas: ~{formatFjAmount(fjOutput)} FJ from swap but ~{feeLimitFj} FJ needed for L2 claim.
                      {fuelNum >= bridgeNum * 0.9
                        ? ' Gas costs nearly your whole bridge, so increase the bridge amount.'
                        : ' Increase the fuel amount.'}
                    </p>
                  )}
                </div>
              )}

              {((hasBridgedFpc && !isPrivacyModeEnabled) || recipientOverrideAvailable) && (
                <div className="border-t border-gray-200 pt-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-latest-grey-700 hover:text-black transition-colors"
                  >
                    Advanced options
                    <Icon icon={showAdvanced ? 'ph:caret-up' : 'ph:caret-down'} width={12} height={12} />
                  </button>
                  {showAdvanced && (
                    <div className="mt-2 space-y-2">
                      {hasBridgedFpc && !isPrivacyModeEnabled && (
                        <div className="flex rounded-md overflow-hidden border border-gray-200 text-xs">
                          <button
                            onClick={() => onFuelTypeChange('public')}
                            className={`flex-1 py-1.5 px-3 font-medium transition-colors ${
                              fuelType === 'public' ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            Public
                          </button>
                          <button
                            onClick={() => onFuelTypeChange('private')}
                            className={`flex-1 py-1.5 px-3 font-medium transition-colors ${
                              fuelType === 'private' ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            Private
                          </button>
                        </div>
                      )}

                      {recipientOverrideAvailable && (
                        <div className="text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-latest-grey-700 font-medium">Send fee juice to</span>
                              <span className="text-latest-grey-500">
                                {recipientStatus.parsed && recipientStatus.isThirdParty
                                  ? shortenAztecAddress(recipientStatus.parsed)
                                  : selfAztecAddress
                                    ? `${shortenAztecAddress(selfAztecAddress)} (this wallet)`
                                    : 'this wallet'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const next = !recipientOverrideOpen
                                setRecipientOverrideOpen(next)
                                if (!next) {
                                  // Closing the panel cancels any pending override.
                                  if (fuelRecipientOverride.length > 0) onFuelRecipientOverrideChange('')
                                  setConfirmedThirdParty(false)
                                }
                              }}
                              className="text-blue-600 hover:underline"
                            >
                              {recipientOverrideOpen ? 'Cancel' : 'Edit'}
                            </button>
                          </div>

                          {recipientOverrideOpen && (
                            <div className="mt-2 space-y-2">
                              <input
                                type="text"
                                spellCheck={false}
                                autoComplete="off"
                                placeholder="Aztec L2 address (0x…)"
                                value={fuelRecipientOverride}
                                onChange={(e) => onFuelRecipientOverrideChange(e.target.value.trim())}
                                className={`w-full px-3 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 ${
                                  recipientStatus.error
                                    ? 'border-red-400 focus:ring-red-400'
                                    : 'border-gray-300 focus:ring-blue-500'
                                }`}
                              />
                              {recipientStatus.error && <p className="text-red-500">{recipientStatus.error}</p>}
                              {recipientStatus.valid && recipientStatus.isThirdParty && (
                                <div className="rounded-md bg-amber-50 border border-amber-200 p-2 space-y-1.5">
                                  <p className="text-amber-800">
                                    <span className="font-semibold">Heads up:</span> fee juice is non-transferable on
                                    Aztec. Once it lands at this address it cannot be moved. The recipient will need a
                                    claim link from you to actually receive it.
                                  </p>
                                  <p className="text-amber-800">
                                    Your token claim will pay L2 gas from your{' '}
                                    <span className="font-semibold">existing</span> Fee Juice balance
                                    {feeJuiceBalance ? ` (currently ${feeJuiceBalance})` : ''}, so make sure you have
                                    enough or your token claim will fail.
                                  </p>
                                  <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={confirmedThirdParty}
                                      onChange={(e) => setConfirmedThirdParty(e.target.checked)}
                                      className="mt-0.5 shrink-0"
                                    />
                                    <span className="text-amber-800">
                                      I&apos;ve double-checked the address and understand this is irreversible.
                                    </span>
                                  </label>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default FuelToggle
