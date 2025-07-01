import { useState } from 'react'
import TextButton from './TextButton'
import StyledImage from './StyledImage'
import { Oval } from 'react-loader-spinner'
import { BridgeDirection } from '@/types/bridge'
import { useToast } from '@/hooks/useToast'
import { parseUnits } from 'viem'
import CongestionWarningModal from './model/CongestionWarningModal'
import { useL2PendingTxCount } from '@/hooks/useL2Operations'

function LoadingContent({ label }: { label: string }) {
  return (
    <div className='flex justify-center gap-2'>
      <Oval
        height='20'
        width='20'
        color='#ccc'
        visible={true}
        ariaLabel='oval-loading'
        secondaryColor='#ccc'
        strokeWidth={6}
        strokeWidthSecondary={6}
      />
      <span>{label}</span>
    </div>
  )
}

function BridgeActionButton({
  isDisabled = false,
  // Connection states
  isMetaMaskConnected,
  connectMetaMask,
  isAztecConnected,
  connectAztec,
  inputRef,

  // Balance and amount states
  inputAmount,
  l1Balance,
  l2Balance,
  l1BalanceLoading = false,
  l2BalanceLoading = false,

  // Bridge direction
  direction,

  // Core operations
  bridgeTokensToL2,
  withdrawTokensToL1,
  requestFaucet,
  useExternalFaucet = false,
  handleExternalFaucet,

  // Loading states
  isStateInitialized = true,
  requestFaucetPending = false,
  bridgeTokensToL2Pending = false,
  withdrawTokensToL1Pending = false,

  // Faucet related
  isEligibleForFaucet,
  needsGas = false,
  needsTokensOnly = false,

  // SBT related
  hasL1SBT,
  hasL2SBT,
  setShowSBTModal,
  setCurrentSBTChain,

  // Operation completion state
  bridgeCompleted = false,
  l2NodeError = false,
  l2NodeIsReadyLoading = false,
}: {
  isDisabled?: boolean
  // Connection states
  isMetaMaskConnected: boolean
  connectMetaMask: () => void
  isAztecConnected: boolean
  connectAztec: () => void
  inputRef: React.RefObject<HTMLInputElement | null>

  // Balance and amount states
  inputAmount: string
  l1Balance: string
  l2Balance: string
  l1BalanceLoading?: boolean
  l2BalanceLoading?: boolean

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

  // Operation completion state
  bridgeCompleted?: boolean
  l2NodeError?: boolean
  l2NodeIsReadyLoading?: boolean
}) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isOperationPending, setIsOperationPending] = useState(false)
  const notify = useToast()
  const [showCongestionWarning, setShowCongestionWarning] = useState(false)
  const { data: pendingTxCount } = useL2PendingTxCount()
  const isCongested = pendingTxCount && pendingTxCount > 40

  // Helper functions for bridge operations
  const getOperationType = (direction: BridgeDirection) =>
    direction === BridgeDirection.L2_TO_L1 ? 'withdrawal' : 'bridge'

  const getOperationLabel = (direction: BridgeDirection) =>
    direction === BridgeDirection.L2_TO_L1 ? 'Withdraw Tokens' : 'Bridge Tokens'
    // direction === BridgeDirection.L2_TO_L1 ? 'Withdraw Tokens coming soon' : 'Bridge Tokens'
  // isDisabled = direction === BridgeDirection.L2_TO_L1

  const getBalanceForDirection = (
    direction: BridgeDirection,
    l1Balance: string,
    l2Balance: string
  ) => (direction === BridgeDirection.L1_TO_L2 ? l1Balance : l2Balance)

  const getSBTChainForDirection = (direction: BridgeDirection) =>
    direction === BridgeDirection.L2_TO_L1 ? 'Aztec' : 'Ethereum'

  // Process operations for bridging or withdrawing
  const processBridgeOperation = async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      notify('error', 'Please enter a valid amount')
      inputRef.current?.focus()
      return
    }

    setIsOperationPending(true)
    try {
      // const amount = BigInt(inputAmount)
      // this should come from token
      // const amount = parseUnits(inputAmount, 6)
      const amount = inputAmount // we parse it in progress page before calling function
      const operationType = getOperationType(direction)

      if (direction === BridgeDirection.L2_TO_L1) {
        await withdrawTokensToL1(amount)
      } else {
        await bridgeTokensToL2(amount)
      }
    } catch (error) {
      const operationType = getOperationType(direction)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      // Check for common error patterns
      if (errorMsg.includes('insufficient')) {
        notify('error', `Insufficient funds for ${operationType} operation`)
      } else if (errorMsg.includes('rejected') || errorMsg.includes('denied')) {
        notify('error', `Transaction rejected by user`)
      } else {
        notify(
          'error',
          `${
            operationType.charAt(0).toUpperCase() + operationType.slice(1)
          } failed: ${errorMsg}`
        )
      }
    } finally {
      setIsOperationPending(false)
    }
  }

  // Check if user has all needed SBTs for the current operation
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

  // Main action handler for the button click
  const handleButtonClick = async () => {
    // Step 1: Connect MetaMask if not connected
    if (!isMetaMaskConnected) {
      setIsConnecting(true)
      setIsOperationPending(true)
      try {
        await connectMetaMask()
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error'

        if (errorMsg.includes('rejected') || errorMsg.includes('denied')) {
          notify('error', 'MetaMask connection was rejected')
        } else if (errorMsg.includes('install')) {
          notify('error', 'Please install MetaMask to continue')
        } else {
          notify('error', `Failed to connect MetaMask: ${errorMsg}`)
        }
      } finally {
        setIsConnecting(false)
        setIsOperationPending(false)
      }
      return
    }

    // Step 2: Connect Aztec if not connected
    if (!isAztecConnected) {
      setIsConnecting(true)
      setIsOperationPending(true)
      try {
        await connectAztec()
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error'

        if (errorMsg.includes('rejected') || errorMsg.includes('denied')) {
          notify('error', 'Aztec connection was rejected')
        } else if (
          errorMsg.includes('not found') ||
          errorMsg.includes('install')
        ) {
          notify(
            'error',
            'Please install the Aztec wallet extension to continue'
          )
        } else {
          notify('error', `Failed to connect Aztec: ${errorMsg}`)
        }
      } finally {
        setIsConnecting(false)
        setIsOperationPending(false)
      }
      return
    }

    // Step 3: If faucet is needed (no gas or tokens), request it
    if (isStateInitialized && isEligibleForFaucet) {
      if (useExternalFaucet && handleExternalFaucet) {
        // Redirect to external faucet (Google Cloud)
        handleExternalFaucet()
        return
      } else {
        // Use internal faucet API
        setIsOperationPending(true)
        try {
          await requestFaucet()
        } catch (error) {
          // const errorMsg =
          //   error instanceof Error ? error.message : 'Unknown error'
          // notify('error', `Faucet request failed: ${errorMsg}`)
        } finally {
          setIsOperationPending(false)
        }
        return
      }
    }

    // Step 4: Check if user has the required SBTs
    if (!checkSBTRequirements()) {
      return // Let the SBT modal handle the next steps
    }

    // Step 5: Validate input amount before proceeding with bridge/withdraw
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      notify('error', 'Please enter a valid amount')
      inputRef.current?.focus()
      return
    }

    // Check for congestion before proceeding
    if (isCongested) {
      setShowCongestionWarning(true)
      return
    }

    // Step 6: Process the bridge/withdraw operation
    processBridgeOperation()
  }

  const handleConfirmBridge = () => {
    setShowCongestionWarning(false)
    processBridgeOperation()
  }

  // Determine button label based on current state
  const getButtonLabel = () => {
    // Show loading if checking node
    if (l2NodeIsReadyLoading) {
      return 'Checking Aztec Network Status...';
    }
    // Show error if node is down
    if (l2NodeError) {
      return 'Aztec Network Unavailable';
    }
    // Show success message when bridge operation completes
    if (bridgeCompleted) {
      return 'Bridge Complete!'
    }

    // Priority 1: Show loading states for balance fetching
    if (
      isMetaMaskConnected &&
      isAztecConnected &&
      (!isStateInitialized || l1BalanceLoading)
    ) {
      return 'Loading balances...'
    }

    // Priority 2: Connection states
    if (!isMetaMaskConnected) return 'Connect Ethereum Wallet'
    if (!isAztecConnected) return 'Connect Aztec Wallet'

    // Priority 3: Faucet (gas and tokens)
    if (needsGas || needsTokensOnly) {
      // if (useExternalFaucet) {
      //   return needsTokensOnly ? 'Get Tokens (External)' : 'Get Testnet ETH (External)'
      // }
      return needsTokensOnly ? 'Get Tokens' : 'Get Testnet ETH'
    }

    // Priority 4: SBT requirements
    const requiredChain = getSBTChainForDirection(direction)
    if (direction === BridgeDirection.L2_TO_L1) {
      if (!hasL2SBT) return `Get SBT on ${requiredChain}`
    } else {
      if (hasL1SBT !== true) return `Get SBT on ${requiredChain}`
    }

    // Priority 5: Bridge operations
    return getOperationLabel(direction)
  }

  // Determine if the button should be disabled
  const isButtonDisabled =
    l2NodeIsReadyLoading ||
    l2NodeError ||
    // Disable during loading states
    (isMetaMaskConnected &&
      isAztecConnected &&
      (!isStateInitialized || l1BalanceLoading)) ||
    isConnecting ||
    requestFaucetPending ||
    withdrawTokensToL1Pending ||
    bridgeTokensToL2Pending ||
    isOperationPending ||
    bridgeCompleted
    //  ||
    // // Disable bridge/withdraw when amount is invalid and user has all SBTs
    // (parseFloat(inputAmount) <= 0 
    // &&
    //   ((direction === BridgeDirection.L2_TO_L1 && hasL2SBT === true) ||
    //     (direction === BridgeDirection.L1_TO_L2 && hasL1SBT === true)))


  // console.log({
  //   l2NodeIsReadyLoading,
  //   l2NodeError,
  //   third:(isMetaMaskConnected &&
  //     isAztecConnected &&
  //     (!isStateInitialized || l1BalanceLoading)),
  //     isConnecting,
  //   requestFaucetPending,
  //   withdrawTokensToL1Pending,
  //   bridgeTokensToL2Pending,
  //   isOperationPending,
  //   isButtonDisabled,
  // })
  // Show loading spinner during operation loading states
  const showLoadingSpinner =
    l2NodeIsReadyLoading ||
    isConnecting ||
    requestFaucetPending ||
    withdrawTokensToL1Pending ||
    bridgeTokensToL2Pending ||
    isOperationPending

  // Get the loading text for the spinner
  const getLoadingText = () => {
    if (l2NodeIsReadyLoading) return 'Checking Aztec Network Status...';
    if (isConnecting) return 'Connecting...';
    if (requestFaucetPending) return 'Getting Eth & Testnet USDC...';
    if (withdrawTokensToL1Pending) return 'Withdrawing Tokens...';
    if (bridgeTokensToL2Pending) return 'Bridging Tokens...';
    return 'Loading...';
  }

  return (
    <>
      <div className='w-full'>
        <TextButton
          onClick={handleButtonClick}
          disabled={isButtonDisabled || isDisabled}
          className=''>
          {showLoadingSpinner ? (
            <LoadingContent label={getLoadingText()} />
          ) : bridgeCompleted ? (
            <div className='flex items-center gap-2'>
              <StyledImage
                src='/assets/svg/check-circle.svg'
                alt=''
                className='h-5 w-5'
              />
              <span>Bridge Complete!</span>
            </div>
          ) : (
            getButtonLabel()
          )}
        </TextButton>
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

