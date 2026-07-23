import React, { useState } from 'react'
import TextButton from './TextButton'
import StyledImage from './StyledImage'
import { BridgeDirection } from '@/types/bridge'
import { useToast } from '@/hooks/useToast'
import { extractErrorMessage } from '@/utils'
import { parseUnits } from 'viem'
import CongestionWarningModal from './model/CongestionWarningModal'
import { useL2PendingTxCount, useNetworkHealth } from '@/hooks/useL2Operations'
import { POCH_MINT_URL } from '@/config'

// Single-loader policy (#298): progress lives in the top mini progress bar
// (BridgeHeader's LoadingBar), so the button no longer renders its own spinner.
// It just shows a clean text state ("Bridging Tokens…", "Verifying…") that
// tracks the same phase without a second, competing spinner.
function LoadingContent({ label }: { label: string }) {
  return <span>{label}</span>
}

interface BridgeActionButtonProps {
  isDisabled?: boolean
  // Specific reason the button is disabled by an EXTERNAL gate (fuel sufficiency / recipient /
  // amount / auth), so we never show a silent greyed button — the reason renders under it.
  // The internal disable cases already surface themselves in the button label.
  disabledReason?: string

  // Binding guard: the connected (L1, L2) pair is a CONFLICT (the EVM wallet is
  // bound to a different Aztec account, or vice-versa). Bridging would deposit
  // into a guaranteed-failing pair, so block up-front (issues #98/#130). The
  // button just disables with a concise reason; the full switch-your-wallet
  // notice is pushed into the Messages feed by the parent (#297b).
  bindingBlocked?: boolean
  // Retained for compatibility; the detailed switch-wallet copy now lives in the
  // Messages feed rather than the button label, so the button no longer reads it.
  bindingBlockedLabel?: string

  // Connection states
  isWaapConnected: boolean
  connectWaapWallet: () => void
  getWalletProvider: () => string | null
  loginMethod: string | null
  walletProvider: string | null
  isAztecConnected: boolean
  connectAztec: () => void
  inputRef: React.RefObject<HTMLInputElement | null>

  // Balance and amount states
  inputAmount: string
  l1Balance: string
  l2Balance: string
  l1BalanceLoading?: boolean
  l2BalanceLoading?: boolean
  feeJuiceLoading?: boolean

  // Bridge direction
  direction: BridgeDirection

  // Core operations
  bridgeTokensToL2: (amount: string) => void
  withdrawTokensToL1: (amount: string) => void
  requestFaucet: () => void
  useExternalFaucet?: boolean
  handleExternalFaucet?: () => void

  // Loading states
  isStateInitialized?: boolean
  requestFaucetPending?: boolean
  bridgeTokensToL2Pending?: boolean
  withdrawTokensToL1Pending?: boolean

  // Faucet related
  isEligibleForFaucet: boolean
  needsGas?: boolean
  needsTokensOnly?: boolean

  // SBT related
  hasL1SBT: boolean | unknown
  hasL2SBT: boolean | undefined
  setShowSBTModal: (show: boolean) => void
  setCurrentSBTChain: (chain: 'Ethereum' | 'Aztec') => void

  // Claim-gas guard: the L2 claim would be paid from standing FeeJuice the user
  // doesn't have. When true, the button becomes an "enable gas top-up" CTA.
  needsClaimGas?: boolean
  onAddClaimGas?: () => void
  // Compliance attestation
  pochEligible?: boolean
  pochLoading?: boolean
  pochReason?: string
  // Opens the verification step/screen when attestation is required (replaces a toast).
  onRequestVerification?: () => void
  attestationMethod?: 'poch' | 'passport' | null
  passportMaxAmount?: bigint
  // Alpha per-day (rolling 24h) deposit cap: USD left for this user (undefined = cap disabled)
  remainingDepositUsd?: number
  // Travel Rule: passport tier blocked because lifetime volume reached the threshold.
  travelRuleBlocked?: boolean
  // Travel Rule: USD budget left before the threshold (undefined = disabled).
  travelRuleRemainingUsd?: number
  // USD held by an outstanding attestation reservation (already netted out of the remaining
  // budgets above). When a block is charged to this, it's temporary — clears when the pending
  // deposit confirms or the reservation expires (<= 30 min) — so we disable with a hold label
  // rather than routing the user to Clean Hands verification.
  reservedDepositUsd?: number

  // Operation completion state
  bridgeCompleted?: boolean
  l2NodeError?: boolean
  l2NodeIsReadyLoading?: boolean
  feeJuiceBalanceLoading?: boolean
}

function BridgeActionButton({
  isDisabled = false,
  disabledReason,
  bindingBlocked = false,
  isWaapConnected,
  connectWaapWallet,
  getWalletProvider,
  loginMethod,
  walletProvider,
  isAztecConnected,
  connectAztec,
  inputRef,
  inputAmount,
  l1Balance,
  l2Balance,
  l1BalanceLoading = false,
  l2BalanceLoading = false,
  feeJuiceLoading = false,
  direction,
  bridgeTokensToL2,
  withdrawTokensToL1,
  requestFaucet,
  useExternalFaucet = false,
  handleExternalFaucet,
  isStateInitialized = true,
  requestFaucetPending = false,
  bridgeTokensToL2Pending = false,
  withdrawTokensToL1Pending = false,
  isEligibleForFaucet,
  needsGas = false,
  needsTokensOnly = false,
  hasL1SBT,
  hasL2SBT,
  setShowSBTModal,
  setCurrentSBTChain,
  needsClaimGas = false,
  onAddClaimGas,
  pochEligible,
  pochLoading = false,
  pochReason,
  onRequestVerification,
  attestationMethod,
  passportMaxAmount,
  remainingDepositUsd,
  travelRuleBlocked = false,
  travelRuleRemainingUsd,
  reservedDepositUsd,
  bridgeCompleted = false,
  l2NodeError = false,
  l2NodeIsReadyLoading = false,
  feeJuiceBalanceLoading = false,
}: BridgeActionButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isOperationPending, setIsOperationPending] = useState(false)
  const notify = useToast()
  const [showCongestionWarning, setShowCongestionWarning] = useState(false)
  const { data: pendingTxCount } = useL2PendingTxCount()
  const isCongested = pendingTxCount && pendingTxCount > 40
  const { data: networkHealth } = useNetworkHealth()
  const isNetworkDown = networkHealth?.isNetworkDown ?? false

  const bothWalletsConnected = isWaapConnected && isAztecConnected
  const balancesLoading =
    bothWalletsConnected && (!isStateInitialized || l1BalanceLoading || l2BalanceLoading || feeJuiceLoading)

  // Helper functions
  const getOperationType = (dir: BridgeDirection) => (dir === BridgeDirection.L2_TO_L1 ? 'withdrawal' : 'bridge')

  const getOperationLabel = (dir: BridgeDirection) =>
    dir === BridgeDirection.L2_TO_L1 ? 'Withdraw Tokens' : 'Bridge Tokens'

  const getSBTChainForDirection = (dir: BridgeDirection) => (dir === BridgeDirection.L2_TO_L1 ? 'Aztec' : 'Ethereum')

  // Process operations for bridging or withdrawing
  const processBridgeOperation = async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      notify('error', 'Please enter a valid amount')
      inputRef.current?.focus()
      return
    }

    setIsOperationPending(true)
    try {
      const amount = inputAmount
      if (direction === BridgeDirection.L2_TO_L1) {
        await withdrawTokensToL1(amount)
      } else {
        await bridgeTokensToL2(amount)
      }
    } catch (error) {
      const operationType = getOperationType(direction)
      const errorMsg = extractErrorMessage(error)

      if (errorMsg.toLowerCase().includes('deposit limit')) {
        notify('error', errorMsg)
      } else if (errorMsg.includes('insufficient')) {
        notify('error', `Insufficient funds for ${operationType} operation`)
      } else if (errorMsg.includes('rejected') || errorMsg.includes('denied')) {
        notify('error', `Transaction rejected by user`)
      } else {
        notify('error', `${operationType.charAt(0).toUpperCase() + operationType.slice(1)} failed: ${errorMsg}`)
      }
    } finally {
      setIsOperationPending(false)
    }
  }

  const checkSBTRequirements = () => {
    const requiredChain = getSBTChainForDirection(direction)
    if (direction === BridgeDirection.L2_TO_L1) {
      if (!hasL2SBT) {
        setCurrentSBTChain(requiredChain)
        setShowSBTModal(true)
        return false
      }
    } else {
      if (hasL1SBT !== true) {
        setCurrentSBTChain(requiredChain)
        setShowSBTModal(true)
        return false
      }
    }
    return true
  }

  // Main action handler
  const handleButtonClick = async () => {
    // Step 1: Connect WaaP wallet
    if (!isWaapConnected) {
      setIsConnecting(true)
      setIsOperationPending(true)
      try {
        await connectWaapWallet()
      } catch (error) {
        // Error handling is done in useWalletStore
      } finally {
        setIsConnecting(false)
        setIsOperationPending(false)
      }
      return
    }

    // Step 2: Connect Aztec wallet
    if (!isAztecConnected) {
      setIsConnecting(true)
      setIsOperationPending(true)
      try {
        await connectAztec()
      } catch (error) {
        // Error handling is done in useWalletStore
      } finally {
        setIsConnecting(false)
        setIsOperationPending(false)
      }
      return
    }

    // Travel Rule: over the cumulative deposit cap — route to the Clean Hands / Passport
    // upgrade screen instead of dead-ending on a disabled button. A temporary hold is NOT
    // an upgrade prompt (the user just needs to wait), so it stays a disabled button below.
    if (travelRuleBlockedDeposit && !pendingHoldBlocked) {
      onRequestVerification?.()
      return
    }

    // Step 3: Faucet if needed
    if (isStateInitialized && isEligibleForFaucet) {
      if (useExternalFaucet && handleExternalFaucet && needsGas && !needsTokensOnly) {
        handleExternalFaucet()
        return
      } else {
        setIsOperationPending(true)
        try {
          await requestFaucet()
        } catch (error) {
          // handled elsewhere
        } finally {
          setIsOperationPending(false)
        }
        return
      }
    }

    // Step 4: SBT check
    if (!checkSBTRequirements()) {
      return
    }

    // Step 5: Attestation check — required for BOTH public and private flows.
    // The L1 TokenPortal and L2 TokenBridge gate every deposit/exit on POCH or
    // Passport regardless of privacy mode.
    if (pochLoading) {
      notify('info', 'Checking eligibility...')
      return
    }
    if (!pochEligible) {
      onRequestVerification?.()
      return
    }

    // Step 5b: Claim-gas guard — the L2 claim would have no FeeJuice to pay for
    // itself. Steer the user into enabling gas top-up rather than letting them
    // start a bridge that strands the funds at the claim step.
    if (needsClaimGas) {
      onAddClaimGas?.()
      return
    }

    // Step 6: Validate amount
    // Step 6a: Passport amount limit check (applies to both public and private)
    if (attestationMethod === 'passport' && passportMaxAmount != null) {
      try {
        const decimals = 6 // USDC decimals
        const inputBigInt = BigInt(Math.floor(parseFloat(inputAmount || '0') * 10 ** decimals))
        if (inputBigInt > passportMaxAmount) {
          const maxFormatted = (Number(passportMaxAmount) / 10 ** decimals).toFixed(2)
          notify('error', {
            heading: 'Amount Exceeds Human Passport Limit',
            message: React.createElement(
              'span',
              null,
              `Human Passport allows up to ${maxFormatted} USDC per transaction. `,
              React.createElement(
                'a',
                {
                  href: POCH_MINT_URL,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  style: { color: '#BF1254', textDecoration: 'underline' },
                },
                'get a Proof of Clean Hands',
              ),
              ' to remove this limit.',
            ) as unknown as string,
          })
          return
        }
      } catch {
        // parseFloat failed — will be caught by the next validation step
      }
    }
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      notify('error', 'Please enter a valid amount')
      inputRef.current?.focus()
      return
    }

    // Step 7: Congestion check
    if (isCongested) {
      setShowCongestionWarning(true)
      return
    }

    // Step 8: Execute
    processBridgeOperation()
  }

  const handleConfirmBridge = () => {
    setShowCongestionWarning(false)
    processBridgeOperation()
  }

  // --- Derived UI state ---

  // Alpha per-day deposit cap (deposits only). Block up-front so the user
  // can't start a bridge the attestation layer will reject. remainingDepositUsd
  // is undefined when the cap is disabled.
  const depositLimitBlocked =
    direction === BridgeDirection.L1_TO_L2 &&
    remainingDepositUsd != null &&
    (remainingDepositUsd <= 0 || parseFloat(inputAmount || '0') > remainingDepositUsd)

  // Travel Rule: passport-tier user whose lifetime volume reached the threshold — or
  // whose entered amount would cross it — must upgrade to POCH before bridging more.
  // `>=` because the threshold triggers at "$1,000 or more"; USDC is $1-pegged on Alpha.
  const travelRuleBlockedDeposit =
    direction === BridgeDirection.L1_TO_L2 &&
    (travelRuleBlocked ||
      (travelRuleRemainingUsd != null &&
        (travelRuleRemainingUsd <= 0 || parseFloat(inputAmount || '0') >= travelRuleRemainingUsd - 1e-6)))

  // A block is a *temporary hold* (a signed-but-unconfirmed deposit reserving budget), not a
  // permanent cap, when a reservation exists and it — not settled volume — is what zeroed the
  // remaining budget. `travelRuleBlocked` is settled-only, so it distinguishes a genuine
  // Travel Rule exhaustion (route to Clean Hands) from a hold (wait / disable with a hint).
  const holdUsd =
    direction === BridgeDirection.L1_TO_L2 && reservedDepositUsd != null ? reservedDepositUsd : 0
  const depositHeldOut = holdUsd > 0 && remainingDepositUsd != null && remainingDepositUsd <= 0
  const travelRuleHeldOut =
    holdUsd > 0 && !travelRuleBlocked && travelRuleRemainingUsd != null && travelRuleRemainingUsd <= 0
  const pendingHoldBlocked = depositHeldOut || travelRuleHeldOut

  // Binding conflict is only meaningful once BOTH wallets are connected (it's
  // derived from the connected pair). Before that the button is a Connect CTA,
  // so never let the guard suppress those.
  const bindingConflictBlocked = bindingBlocked && bothWalletsConnected

  const isButtonDisabled =
    l2NodeIsReadyLoading ||
    l2NodeError ||
    isNetworkDown ||
    balancesLoading ||
    isConnecting ||
    requestFaucetPending ||
    withdrawTokensToL1Pending ||
    bridgeTokensToL2Pending ||
    isOperationPending ||
    depositLimitBlocked ||
    pendingHoldBlocked ||
    bindingConflictBlocked ||
    bridgeCompleted

  const isOperationInFlight =
    isConnecting || requestFaucetPending || withdrawTokensToL1Pending || bridgeTokensToL2Pending || isOperationPending

  const showLoadingSpinner =
    l2NodeIsReadyLoading ||
    balancesLoading ||
    isOperationInFlight ||
    // Attestation eligibility check is required for both modes.
    (pochLoading && bothWalletsConnected)

  const getLoadingText = () => {
    if (l2NodeIsReadyLoading) return 'Checking Aztec Network Status...'
    if (balancesLoading) return 'Loading balances...'
    if (isConnecting) return 'Connecting...'
    if (requestFaucetPending) return 'Getting Testnet USDC...'
    if (pochLoading) return 'Checking eligibility...'
    if (withdrawTokensToL1Pending) return 'Withdrawing Tokens...'
    if (bridgeTokensToL2Pending) return 'Bridging Tokens...'
    return 'Loading...'
  }

  const getButtonLabel = () => {
    if (l2NodeIsReadyLoading) return 'Checking Aztec Network Status...'
    if (l2NodeError) return 'Aztec Network Unavailable'
    if (isNetworkDown) return 'Aztec Network is Down'
    if (bridgeCompleted) return 'Bridge Complete!'
    if (balancesLoading) return 'Loading balances...'

    // Connection states
    if (!isWaapConnected) return 'Connect Ethereum Wallet'
    if (!isAztecConnected) return 'Connect Aztec Wallet'

    // Binding conflict deliberately does NOT rewrite the label (#297b): the button
    // stays a plain, disabled operation label and the concise reason renders under
    // it, while the full switch-your-wallet notice lives in the Messages feed.

    // Temporary reservation hold: a signed-but-unconfirmed deposit is holding the user's
    // budget. Distinct from a permanent cap — say it clears itself so they wait, not verify.
    if (pendingHoldBlocked) {
      return 'Pending deposit — limit frees in ≤30 min'
    }

    // Travel Rule: passport tier exhausted, POCH required (deposits only)
    if (travelRuleBlockedDeposit) {
      return 'Verify with Clean Hands to bridge more'
    }

    // Alpha deposit cap (deposits only)
    if (depositLimitBlocked) {
      return remainingDepositUsd != null && remainingDepositUsd > 0
        ? `Only $${remainingDepositUsd.toFixed(2)} left (Alpha limit)`
        : 'Alpha Deposit Limit Reached'
    }

    // Faucet
    if (needsGas || needsTokensOnly) {
      return needsTokensOnly ? 'Click to Get Tokens' : 'Click to Get Testnet ETH'
    }

    // SBT requirements
    const requiredChain = getSBTChainForDirection(direction)
    if (direction === BridgeDirection.L2_TO_L1) {
      if (!hasL2SBT) return `Get SBT on ${requiredChain}`
    } else {
      if (hasL1SBT !== true) return `Get SBT on ${requiredChain}`
    }

    // Attestation requirement applies to both public and private modes.
    if (pochLoading) return 'Checking eligibility...'
    if (!pochEligible) return 'Verify to continue'

    // The L2 claim has no FeeJuice to pay for itself — turn on gas top-up first.
    if (needsClaimGas) return 'Add gas to claim on Aztec'

    return getOperationLabel(direction)
  }

  // Binding conflict (#297b): the button is a plain disabled control; this concise
  // reason renders under it. The full "switch to your linked pair (0x…)" notice is
  // pushed into the Messages feed by the parent, not crammed into the button label.
  const bindingShortReason = bindingConflictBlocked ? "Wallets don't match your linked pair" : undefined

  // Graceful states: when the button is disabled by an external gate whose reason isn't already
  // carried in the label (fuel / recipient / amount / auth), surface it right under the button
  // instead of leaving a silent greyed control. Suppressed while loading or on completion.
  const effectiveDisabledReason = bindingShortReason ?? disabledReason
  const showDisabledReason =
    !!effectiveDisabledReason && (isDisabled || isButtonDisabled) && !showLoadingSpinner && !bridgeCompleted

  return (
    <>
      <div className="w-full">
        <TextButton onClick={handleButtonClick} disabled={isButtonDisabled || isDisabled} className="">
          {showLoadingSpinner ? (
            <LoadingContent label={getLoadingText()} />
          ) : bridgeCompleted ? (
            <div className="flex items-center gap-2">
              <StyledImage src="/assets/svg/check-circle.svg" alt="" className="h-5 w-5" />
              <span>Bridge Complete!</span>
            </div>
          ) : (
            getButtonLabel()
          )}
        </TextButton>
        {showDisabledReason && (
          <p className="mt-1 text-center text-[11px] leading-[15px] font-medium text-[#B54708]">
            {effectiveDisabledReason}
          </p>
        )}
      </div>

      <CongestionWarningModal
        isOpen={showCongestionWarning}
        onClose={() => setShowCongestionWarning(false)}
        onConfirm={handleConfirmBridge}
      />
    </>
  )
}

export default BridgeActionButton
