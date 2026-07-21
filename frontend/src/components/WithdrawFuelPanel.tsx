'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Icon } from '@iconify/react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { formatFjAmount } from '@/utils/fuelPricing'
import { BRIDGED_FPC_ADDRESS } from '@/config'
import { useClaimFeeEstimate } from '@/hooks/useL2Operations'

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

/**
 * Withdraw-direction gas panel (L2 → L1).
 *
 * On a withdrawal the user is already on L2 and the burn tx is paid from their
 * standing Fee Juice. A user with 0 FJ is stuck. Unlike the deposit direction —
 * where the SwapBridgeRouter can atomically carve a slice of the bridged token
 * into Fee Juice — the SDK exposes NO way to top up L2 Fee Juice inline on a
 * withdraw (see `withdrawL2ToL1` / `WithdrawL2ToL1Params`: no fuel field, and
 * `HumanTechBridge` has no mint/claim/FPC-topup method). So this panel is
 * informational: it surfaces the gas requirement, warns when the burn would be
 * underfunded, and tells the user how to get Fee Juice today. It auto-expands
 * when underfunded (mirrors the deposit-side auto-enable latch).
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

  // The L2 burn is paid from standing (public) Fee Juice regardless of privacy mode —
  // the withdraw path sets no FeeJuicePaymentMethod, so it draws on the account's FJ.
  const { data: claimFeeLimit, isLoading: claimFeeLoading } = useClaimFeeEstimate('public')
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

              {/* Stub: direct L2 top-up is not yet supported by the SDK on the withdraw path. */}
              <div className="rounded-[8px] border border-dashed border-[#81133B]/40 bg-[#F9EEF3] px-2.5 py-2 space-y-1.5">
                <p className="text-[11px] font-semibold text-[#81133B]">Add Fee Juice — coming soon</p>
                <p className="text-[11px] leading-[15px] text-[#737373]">
                  Direct Fee Juice top-up on withdrawals isn&apos;t available yet. To fund this withdrawal now:
                </p>
                <ul className="text-[11px] leading-[15px] text-[#737373] list-disc pl-4 space-y-0.5">
                  <li>
                    Switch to <span className="font-semibold">Deposit</span> and bridge in with{' '}
                    <span className="font-semibold">Top up gas balance</span> enabled — that swaps a slice of your
                    deposit into Fee Juice on L2.
                  </li>
                  <li>Then return here to withdraw.</li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default WithdrawFuelPanel
