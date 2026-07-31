'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import { formatFjAmount } from '@/utils/fuelPricing'
import { BRIDGED_FPC_ADDRESS } from '@/config'
import { useClaimFeeEstimate } from '@/hooks/useL2Operations'

interface WithdrawFuelPanelProps {
  /** Public L2 Fee Juice balance — pays the L2 burn gas in non-privacy mode. */
  feeJuiceBalance?: string
  /** BridgedFPC balance — pays the L2 burn gas (via pay_fee) in privacy mode. */
  privateFeeJuiceBalance?: string
  feeJuiceBalanceLoading?: boolean
  privateFeeJuiceBalanceLoading?: boolean
  isPrivacyModeEnabled?: boolean
}

/**
 * Withdraw-direction gas row (L2 → L1).
 *
 * A withdrawal burns on L2 and the wallet pays that burn from the user's standing
 * fuel automatically — private (BridgedFPC, via pay_fee) in privacy mode, else
 * native Fee Juice. So this row only *reports* the fuel position; it never asks the
 * user to pick a payment source, and it never hosts a buy form. Adding fuel is a
 * separate, multi-minute L1→L2 bridge, so it lives on its own screen (/fee-juice)
 * behind a pill — inlining that form here made the card scroll and buried the
 * balance the row exists to show.
 */
const WithdrawFuelPanel: React.FC<WithdrawFuelPanelProps> = ({
  feeJuiceBalance,
  privateFeeJuiceBalance,
  feeJuiceBalanceLoading,
  privateFeeJuiceBalanceLoading,
  isPrivacyModeEnabled = false,
}) => {
  const router = useRouter()
  const hasBridgedFpc = !!BRIDGED_FPC_ADDRESS

  // Privacy mode forces private (BridgedFPC) fuel so the burn stays anonymous —
  // same enforcement as the deposit-fuel path.
  const fuelType: 'public' | 'private' = isPrivacyModeEnabled && hasBridgedFpc ? 'private' : 'public'
  const usingPrivateFuel = fuelType === 'private'

  const applicableBalance = usingPrivateFuel ? privateFeeJuiceBalance : feeJuiceBalance
  const applicableLoading = usingPrivateFuel ? privateFeeJuiceBalanceLoading : feeJuiceBalanceLoading

  const { data: burnFeeCeiling, isLoading: feeLoading } = useClaimFeeEstimate(fuelType)
  const ceilingFj = burnFeeCeiling != null ? formatFjAmount(burnFeeCeiling, 2) : null

  const balanceNum =
    applicableBalance != null && applicableBalance !== '--' && !isNaN(Number(applicableBalance))
      ? Number(applicableBalance)
      : null
  // Empty is the only provable "cannot pay" state. Below the ceiling is advisory: the
  // ceiling is a worst-case bound, and the wallet sizes the real fee from a preflight
  // simulation of this exact burn.
  const empty = balanceNum === 0
  const tight = balanceNum != null && balanceNum > 0 && burnFeeCeiling != null && balanceNum < Number(burnFeeCeiling) / 1e18

  const fuelLabel = usingPrivateFuel ? 'private fuel' : 'Fee Juice'

  return (
    <div className="mt-3 rounded-md bg-[#F5F5F5] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon icon="ph:gas-pump-fill" width={14} height={14} className="shrink-0 text-[#17235E]" />
          <span className="truncate text-sm font-medium text-latest-grey-700">L2 gas for withdrawal</span>
          <Icon
            icon="ph:info"
            width={12}
            height={12}
            className="shrink-0 cursor-help text-latest-grey-500"
            data-tooltip-id="withdraw-fuel-info"
            data-tooltip-content={
              usingPrivateFuel
                ? 'Withdrawing burns your tokens on Aztec. Privacy mode pays that gas from your private (BridgedFPC) fuel, which is separate from the Fee Juice in your wallet. The figure is a safe ceiling; you are charged the actual cost.'
                : 'Withdrawing burns your tokens on Aztec, paid automatically from your Fee Juice. The figure is a safe ceiling; you are charged the actual cost.'
            }
          />
        </span>
        <button
          type="button"
          onClick={() => router.push('/fee-juice')}
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            empty
              ? 'bg-[#81133B] text-white hover:bg-[#BF1254]'
              : 'border border-[#17235E] text-[#17235E] hover:bg-[#17235E]/[0.08]'
          }`}
        >
          <Icon icon="ph:plus-circle-fill" width={12} height={12} />
          Top up
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-latest-grey-500">
        <span>
          Up to{' '}
          <span className="font-semibold text-latest-black-300">
            {feeLoading || ceilingFj == null ? '…' : `~${ceilingFj} FJ`}
          </span>
        </span>
        <span className="flex items-center gap-1">
          {usingPrivateFuel ? 'private fuel' : 'you have'}
          {applicableLoading ? (
            <span className="inline-block h-2.5 w-10 animate-pulse rounded bg-neutral-300" />
          ) : (
            <span className={`font-semibold ${empty ? 'text-[#D92D20]' : ''}`}>
              {applicableBalance ?? '--'} FJ
            </span>
          )}
        </span>
      </div>

      {empty ? (
        <p className="mt-1.5 text-[11px] leading-[15px] text-[#D92D20]">
          You have no {fuelLabel}. Top up to withdraw.
        </p>
      ) : tight ? (
        <p className="mt-1.5 text-[11px] leading-[15px] text-latest-grey-500">
          Close to the ceiling. If the burn needs more, it stops before your tokens move.
        </p>
      ) : null}

      <ReactTooltip
        id="withdraw-fuel-info"
        place="top"
        className="z-[100]"
        style={{ fontSize: '12px', maxWidth: '240px' }}
      />
    </div>
  )
}

export default WithdrawFuelPanel
