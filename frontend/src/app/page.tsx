'use client'
import TextButton from '@/components/TextButton'
import { useAztecWallet } from '@/hooks/useAztecWallet'
import { useMetaMask } from '@/hooks/useMetaMask'
import { ChangeEvent, useCallback, useEffect, useState, useRef } from 'react'
import { Oval } from 'react-loader-spinner'
// import { useBridge } from '@/hooks/useBridge'
import RootStyle from '@/components/RootStyle'
import SBT from '@/components/SBT'
import StyledImage from '@/components/StyledImage'
import {
  useL1BridgeToL2,
  useL1Faucet,
  useL1HasSoulboundToken,
  useL1MintSoulboundToken,
  useL1MintTokens,
  useL1NativeBalance,
  useL1TokenBalance,
} from '@/hooks/useL1Operations'
import {
  useL2HasSoulboundToken,
  useL2MintSoulboundToken,
  useL2TokenBalance,
  useL2WithdrawTokensToL1,
} from '@/hooks/useL2Operations'
import { useToast } from '@/hooks/useToast'
import clsxm from '@/utils/clsxm'

const networks = {
  send: {
    id: 3,
    img: '/assets/svg/ethereum.svg',
    title: 'Ethereum',
  },
  received: {
    id: 5,
    img: '/assets/svg/aztec.svg',
    title: 'Aztec',
  },
}

const tokens = {
  send: {
    id: 1,
    img: '/assets/svg/USDC.svg',
    title: 'USDC',
    about: 'Ethereum',
    amount: '$50.27',
    percentage: '+0.62%',
  },
  received: {
    id: 3,
    img: '/assets/svg/USDC.svg',
    title: 'USDC',
    about: 'USDC',
    amount: '$970.10',
    percentage: '+1.05%',
  },
}

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

  // Operation mode
  isWithdrawing,

  // Core operations
  bridgeTokensToL2,
  withdrawTokensToL1,
  requestFaucet,

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
}: {
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

  // Operation mode
  isWithdrawing: boolean

  // Core operations
  bridgeTokensToL2: (amount: bigint) => void
  withdrawTokensToL1: (amount: bigint) => void
  requestFaucet: () => void

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
}) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isOperationPending, setIsOperationPending] = useState(false)
  const notify = useToast()

  // Process operations for bridging or withdrawing
  const processBridgeOperation = async () => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      notify('error', 'Please enter a valid amount')
      inputRef.current?.focus()
      return
    }

    setIsOperationPending(true)
    try {
      const amount = BigInt(inputAmount)
      if (isWithdrawing) {
        await withdrawTokensToL1(amount)
      } else {
        await bridgeTokensToL2(amount)
      }
    } catch (error) {
      // More specific error messaging based on operation type
      const operationType = isWithdrawing ? 'withdrawal' : 'bridge'
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
    if (isWithdrawing) {
      // For withdrawing, we need L2 SBT
      if (!hasL2SBT) {
        setCurrentSBTChain('Aztec')
        setShowSBTModal(true)
        return false
      }
    } else {
      // For bridging, we need L1 SBT
      if (hasL1SBT !== true) {
        setCurrentSBTChain('Ethereum')
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
      setIsOperationPending(true)
      try {
        await requestFaucet()
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error'
        notify('error', `Faucet request failed: ${errorMsg}`)
      } finally {
        setIsOperationPending(false)
      }
      return
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

    // Step 6: Process the bridge/withdraw operation
    processBridgeOperation()
  }

  // Determine button label based on current state
  const getButtonLabel = () => {
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
    if (!isMetaMaskConnected) return 'Connect MetaMask'
    if (!isAztecConnected) return 'Connect Aztec'

    // Priority 3: Faucet (gas and tokens)
    if (needsGas || needsTokensOnly)
      return needsTokensOnly ? 'Get Tokens' : 'Get Faucet'

    // Priority 4: SBT requirements
    if (isWithdrawing) {
      if (!hasL2SBT) return 'Get SBT on Aztec'
    } else {
      if (hasL1SBT !== true) return 'Get SBT on Ethereum'
    }

    // Priority 5: Bridge operations
    return isWithdrawing ? 'Withdraw Tokens' : 'Bridge Tokens'
  }

  // Determine if the button should be disabled
  const isButtonDisabled =
    // Disable during loading states
    (isMetaMaskConnected &&
      isAztecConnected &&
      (!isStateInitialized || l1BalanceLoading)) ||
    isConnecting ||
    requestFaucetPending ||
    withdrawTokensToL1Pending ||
    bridgeTokensToL2Pending ||
    isOperationPending ||
    bridgeCompleted ||
    // Disable bridge/withdraw when amount is invalid and user has all SBTs
    (parseFloat(inputAmount) <= 0 &&
      ((isWithdrawing && hasL2SBT === true) ||
        (!isWithdrawing && hasL1SBT === true)))

  // Show loading spinner during operation loading states
  const showLoadingSpinner =
    isConnecting ||
    requestFaucetPending ||
    withdrawTokensToL1Pending ||
    bridgeTokensToL2Pending ||
    isOperationPending

  // Get the loading text for the spinner
  const getLoadingText = () => {
    if (isConnecting) return 'Connecting...'
    if (requestFaucetPending) return 'Getting Tokens & ETH...'
    if (withdrawTokensToL1Pending) return 'Withdrawing Tokens...'
    if (bridgeTokensToL2Pending) return 'Bridging Tokens...'
    return 'Loading...'
  }

  return (
    <div>
      <TextButton onClick={handleButtonClick} disabled={isButtonDisabled} className=''>
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
  )
}

export default function Home() {
  // UI state
  const [isOpen, setIsOpen] = useState(false)
  const [networkData, setNetworkData] = useState(networks)
  const [tokensData, setTokensData] = useState(tokens)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [inputAmount, setInputAmount] = useState<string>('')
  const [usdValue, setUsdValue] = useState<string>('$0.00')
  const inputRef = useRef<HTMLInputElement>(null)

  // Operational state
  const [showSBTModal, setShowSBTModal] = useState(false)
  const [currentSBTChain, setCurrentSBTChain] = useState<'Ethereum' | 'Aztec'>(
    'Ethereum'
  )
  // Use a state variable to track bridge operation completion
  const [bridgeCompleted, setBridgeCompleted] = useState(false)

  // Notification system
  const notify = useToast()

  // MetaMask wallet connection
  const {
    address: metaMaskAddress,
    isConnected: isMetaMaskConnected,
    connect: connectMetaMask,
    disconnect: disconnectMetaMask,
  } = useMetaMask()

  // Aztec wallet connection
  const {
    account: aztecAccount,
    address: aztecAddress,
    isConnected: isAztecConnected,
    isConnecting: isAztecConnecting,
    connect: connectAztec,
    disconnect: disconnectAztec,
  } = useAztecWallet()

  // Success callbacks
  const mintL1SBTOnSuccess = (data: any) => {
    console.log('L1 SBT minted:', data)
    setShowSBTModal(false)
  }

  const mintL2SBTOnSuccess = (data: any) => {
    console.log('L2 SBT minted:', data)
    setShowSBTModal(false)
  }

  // L1 (Ethereum) balances and operations
  const { data: l1NativeBalance } = useL1NativeBalance()
  const {
    data: l1Balance,
    isLoading: l1BalanceLoading,
    refetch: refetchL1Balance,
  } = useL1TokenBalance()
  const { data: hasL1SBT } = useL1HasSoulboundToken()
  const { mutate: mintL1SBT, isPending: mintL1SBTPending } =
    useL1MintSoulboundToken(mintL1SBTOnSuccess)

  const { mutate: mintL1Tokens, isPending: mintL1TokensPending } =
    useL1MintTokens()

  // L2 (Aztec) balances and operations
  const {
    data: l2Balance,
    isLoading: l2BalanceLoading,
    refetch: refetchL2Balance,
  } = useL2TokenBalance()
  const l2PrivateBalance = l2Balance?.privateBalance
  const l2PublicBalance = l2Balance?.publicBalance
  const { data: hasL2SBT } = useL2HasSoulboundToken()
  const { mutate: mintL2SBT, isPending: mintL2SBTPending } =
    useL2MintSoulboundToken(mintL2SBTOnSuccess)

  // Bridge success callback
  const handleBridgeSuccess = useCallback(
    (data: any) => {
      // Refetch balances after a successful bridge operation
      refetchL1Balance()
      refetchL2Balance()
      setInputAmount('')
      setBridgeCompleted(true)
      setTimeout(() => {
        setBridgeCompleted(false)
      }, 3000)
    },
    [refetchL1Balance, refetchL2Balance]
  )

  const { mutate: bridgeTokensToL2, isPending: bridgeTokensToL2Pending } =
    useL1BridgeToL2(handleBridgeSuccess)

  const { mutate: withdrawTokensToL1, isPending: withdrawTokensToL1Pending } =
    useL2WithdrawTokensToL1(handleBridgeSuccess)
  // Faucet operations
  const {
    mutate: requestFaucet,
    isPending: requestFaucetPending,
    needsGas,
    needsTokens,
    needsTokensOnly,
    isEligibleForFaucet,
    hasGas,
    nativeBalanceLoading,
    balancesLoaded,
  } = useL1Faucet()

  // Check which SBT to mint based on operation direction and SBT status
  useEffect(() => {
    if (isWithdrawing && !hasL2SBT) {
      setCurrentSBTChain('Aztec')
    } else if (!isWithdrawing && !hasL1SBT) {
      setCurrentSBTChain('Ethereum')
    }
  }, [isWithdrawing, hasL1SBT, hasL2SBT])

  // Component mount and client-side hydration
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  if (!mounted) return null

  // Network and token swap handler
  const handleSwap = () => {
    setTokensData({ send: tokensData?.received, received: tokensData?.send })
    setNetworkData({ send: networkData?.received, received: networkData?.send })
    setIsWithdrawing(!isWithdrawing)
    setInputAmount('')
  }

  // Input amount change handler
  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || !isNaN(Number(value))) {
      setInputAmount(value)
    }
  }

  // SBT minting handler
  const handleSBTMinted = async () => {
    try {
      if (isWithdrawing) {
        await mintL2SBT()
      } else {
        await mintL1SBT()
      }
    } catch (error) {
      notify(
        'error',
        `Error minting SBT: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }
  }

  return (
    <>
      <RootStyle>
        {showSBTModal && (
          <SBT
            address={metaMaskAddress || ''}
            buttonText={`Get SBT on ${currentSBTChain}`}
            chain={currentSBTChain}
            onMint={handleSBTMinted}
            onClose={() => setShowSBTModal(false)}
            isPending={isWithdrawing ? mintL2SBTPending : mintL1SBTPending}
          />
        )}

        {/* Header */}
        <div className=''>
          <div className=' bg-latest-grey-200 p-5 py-3'>
            <div className='flex items-center gap-3 max-w-[150px] mx-auto rounded-full bg-white px-4 py-1'>
              <StyledImage
                src='/assets/svg/bridgeIcon.svg'
                alt=''
                className='h-5 w-5 '
              />
              <p
                className='font-bold text-20 cursor-pointer'
                onClick={() => {
                  disconnectMetaMask()
                  disconnectAztec()
                  window.location.reload()
                  // mintL1Tokens()
                }}>
                BRIDGE
              </p>
            </div>

            {/* From section */}
            <div className='mt-5 bg-white rounded-md p-4 relative'>
              <p className='text-14 font-semibold text-latest-grey-100'>From</p>
              <div className='flex justify-between'>
                <div className='mt-4 flex gap-2 items-center rounded-[12px] cursor-pointer bg-latest-grey-200 p-[2px] max-w-[172px]'>
                  <StyledImage
                    src={networkData?.send?.img || '/assets/svg/ethLogo.svg'}
                    alt=''
                    className='h-6 w-6'
                  />
                  <p className='text-16 font-medium text-latest-black-100 w-[106px]'>
                    {networkData?.send?.title}
                  </p>
                  <StyledImage
                    src='/assets/svg/dropDown.svg'
                    alt=''
                    className='h-2.5 w-1.5 p-1.5 mr-1.5'
                  />
                </div>
                <div className='mt-4 flex gap-2 items-center rounded-md cursor-pointer bg-latest-grey-200 p-[2px]'>
                  <StyledImage
                    src={tokensData?.send?.img || '/assets/svg/USDC.svg'}
                    alt=''
                    className='h-6 w-6'
                  />
                  <p className='text-16 font-medium text-latest-black-100'>
                    {tokensData?.send?.title}
                  </p>
                  <StyledImage
                    src='/assets/svg/dropDown.svg'
                    alt=''
                    className='h-2.5 w-1.5 p-1.5 mr-1.5'
                  />
                </div>
              </div>
              <hr className='text-latest-grey-300 my-3' />
              <div className='flex justify-between my-1'>
                <input
                  ref={inputRef}
                  type='text'
                  placeholder='0'
                  value={inputAmount}
                  onChange={handleAmountChange}
                  className='max-w-[150px] placeholder-latest-grey-400 outline-none bg-[transparent] text-32 font-medium'
                  autoFocus
                />


                <div className='flex flex-col gap-2'>
                  <div className='flex gap-2 w-max'>
                    <p className='text-latest-grey-500 text-12 font-medium'>
                      Native Balance:
                    </p>
                    <div className='flex gap-1'>
                      <p className='text-latest-grey-500 text-12 font-medium break-all'>
                        {isWithdrawing ? '' : l1NativeBalance || '0'}
                      </p>
                      <p className='text-latest-grey-500 text-12 font-medium'>
                        {isWithdrawing ? '' : 'ETH'}
                      </p>
                    </div>
                  </div>

                  <div className='flex gap-2 w-full justify-between items-center'>
                    <p className='text-latest-grey-500 text-12 font-medium'>
                      Balance:
                    </p>
                    <div className='flex gap-1 ml-auto'>
                      <p className='text-latest-grey-500 text-12 font-medium break-all'>
                        {isWithdrawing ? l2PublicBalance : l1Balance}
                      </p>
                      <p className='text-latest-grey-500 text-12 font-medium'>
                        USDC
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className='flex justify-between mt-2'>
                <p className='text-16 font-medium text-latest-grey-500'>
                  {/* {usdValue} */}
                </p>
                <p
                  className='text-14 font-medium text-latest-black-200 bg-latest-grey-200 px-2.5 rounded-[32px] h-5 cursor-pointer'
                  onClick={() =>
                    setInputAmount(
                      isWithdrawing ? l2PublicBalance || '0' : l1Balance || '0'
                    )
                  }>
                  Max
                </p>
              </div>
              <div className='absolute mb-0 bottom-[-30px] left-0 right-0 text-center'>
                <button onClick={handleSwap} className='mx-auto w-10 h-10'>
                  <StyledImage
                    src='/assets/svg/swap.svg'
                    alt=''
                    className='h-10 w-10'
                  />
                </button>
              </div>
            </div>

            {/* To section */}
            <div className='mt-2 bg-white rounded-md p-4'>
              <p className='text-14 font-regular text-latest-grey-100'>To</p>
              <div className='flex justify-between'>
                <div className='mt-4 flex gap-2 items-center rounded-[12px] cursor-pointer bg-latest-grey-200 p-[2px] max-w-[172px]'>
                  <StyledImage
                    src={networkData?.received?.img || '/assets/svg/aztec.svg'}
                    alt=''
                    className='h-6 w-6'
                  />
                  <p className='text-16 font-medium text-latest-black-100 w-[106px]'>
                    {networkData?.received?.title}
                  </p>
                  <StyledImage
                    src='/assets/svg/dropDown.svg'
                    alt=''
                    className='h-2.5 w-1.5 p-1.5 mr-1.5'
                  />
                </div>
                <div className='mt-4 flex gap-2 items-center rounded-md cursor-pointer bg-latest-grey-200 p-[2px]'>
                  <StyledImage
                    src={tokensData?.received?.img || '/assets/svg/ethLogo.svg'}
                    alt=''
                    className='h-6 w-6'
                  />
                  <p className='text-16 font-medium text-latest-black-100'>
                    {tokensData?.received?.title}
                  </p>
                  <StyledImage
                    src='/assets/svg/dropDown.svg'
                    alt=''
                    className='h-2.5 w-1.5 p-1.5 mr-1.5'
                  />
                </div>
              </div>
              <hr className='text-latest-grey-300 my-3' />
              <div className='flex justify-between'>
                <p className='text-14 font-medium text-latest-grey-100'>
                  You will receive
                </p>
                <p className='text-black text-14 font-semibold'>
                  {inputAmount} USDC
                </p>
              </div>

              <div className='flex justify-between mt-2'>
                <p className='text-latest-grey-500 text-12 font-medium'>
                  Current Balance:
                </p>
                <p className='text-latest-grey-500 text-12 font-medium break-all'>
                  {isWithdrawing ? l1Balance : l2PublicBalance} USDC
                </p>
              </div>
            </div>

            {/* Transaction breakdown */}
            <div
              className={clsxm(
                'rounded-md bg-white mt-2 p-4 transition-all duration-400 ease-in-out',
                isOpen ? 'h-[244px]' : 'h-[54px]'
              )}>
              <button
                className='flex justify-between font-semibold w-full'
                onClick={() => setIsOpen(!isOpen)}>
                Transaction breakdown
                <span className=''>
                  <StyledImage
                    src='/assets/svg/buttons.svg'
                    className={clsxm(
                      'w-6 h-6',
                      isOpen &&
                        'transition-transform duration-200 ease-in-out rotate-90'
                    )}
                    alt='open'
                  />
                </span>
              </button>
              {isOpen && (
                <div>
                  <div className='mt-4 flex justify-between'>
                    <p className='text-sm font-medium text-latest-grey-700'>
                      Time to Aztec
                    </p>
                    <p className='text-latest-black-300 text-14 font-medium'>
                      ~2 mins
                    </p>
                  </div>
                  <div className='mt-[14px] flex justify-between'>
                    <p className='text-sm font-medium text-latest-grey-700'>
                      Net fee
                    </p>
                    <p className='text-latest-black-300 text-14 font-medium'>
                      $ 0.04
                    </p>
                  </div>
                  <div className='mt-[14px] flex justify-between'>
                    <div className='flex gap-1 items-center text-center'>
                      <p className='text-sm font-medium text-latest-grey-700'>
                        Bridge fee
                      </p>
                      <StyledImage
                        src='/assets/svg/info.svg'
                        alt=''
                        className='h-4 w-4'
                      />
                    </div>
                    <p className='text-latest-grey-100 text-14 font-medium'>
                      $ 0.01{' '}
                      <span className='text-latest-black-300'>
                        0.0000029 ETH
                      </span>
                    </p>
                  </div>
                  <div className='mt-[14px] flex justify-between'>
                    <div className='flex gap-1 items-center'>
                      <p className='text-sm font-medium text-latest-grey-700'>
                        Destination <br /> Gas fee
                      </p>
                      <StyledImage
                        src='/assets/svg/info.svg'
                        alt=''
                        className='h-4 w-4'
                      />
                    </div>
                    <p className='text-latest-grey-100 text-14 font-medium'>
                      $ 0.03{' '}
                      <span className='text-latest-black-300'>
                        0.0000103 ETH
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action button and footer */}
          <div className='bg-white rounded-md pt-4 px-5'>
            <div className='pb-4'>
              <BridgeActionButton
                // Connection states
                isMetaMaskConnected={isMetaMaskConnected}
                connectMetaMask={connectMetaMask}
                isAztecConnected={isAztecConnected}
                connectAztec={connectAztec}
                inputRef={inputRef}
                // Balance and amount states
                inputAmount={inputAmount}
                l1Balance={l1Balance || '0'}
                l2Balance={l2PublicBalance || '0'}
                l1BalanceLoading={l1BalanceLoading || nativeBalanceLoading}
                l2BalanceLoading={l2BalanceLoading}
                // Operation mode
                isWithdrawing={isWithdrawing}
                // Core operations
                bridgeTokensToL2={bridgeTokensToL2}
                withdrawTokensToL1={withdrawTokensToL1}
                requestFaucet={requestFaucet}
                // Loading states
                isStateInitialized={balancesLoaded}
                requestFaucetPending={requestFaucetPending}
                bridgeTokensToL2Pending={bridgeTokensToL2Pending}
                withdrawTokensToL1Pending={withdrawTokensToL1Pending}
                // Faucet related
                isEligibleForFaucet={isEligibleForFaucet || false}
                needsGas={needsGas || false}
                needsTokensOnly={needsTokensOnly || false}
                // SBT related
                hasL1SBT={hasL1SBT}
                hasL2SBT={hasL2SBT}
                setShowSBTModal={setShowSBTModal}
                setCurrentSBTChain={setCurrentSBTChain}
                // Operation completion state
                bridgeCompleted={bridgeCompleted}
              />
            </div>
            <div className='flex justify-center gap-2 pb-3'>
              <StyledImage
                src='/assets/svg/silk0.4.svg'
                alt=''
                className='h-4 w-[14px]'
              />
              <p className='text-12 font-medium text-latest-grey-600'>
                Secured by Human Wallet
              </p>
            </div>
          </div>
        </div>
      </RootStyle>
    </>
  )
}
