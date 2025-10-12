'use client'
import TextButton from '@/components/TextButton'
import { useWalletSync } from '@/hooks/useWalletSync'
import { ChangeEvent, useCallback, useEffect, useState, useRef } from 'react'
import { Oval } from 'react-loader-spinner'
// import { useBridge } from '@/hooks/useBridge'
import RootStyle from '@/components/RootStyle'
import SBT from '@/components/model/SBT'
import StyledImage from '@/components/StyledImage'
import {
  useL1BridgeToL2,
  useL1Faucet,
  useL1HasSoulboundToken,
  useL1MintSoulboundToken,
  useL1MintTokens,
  useL1NativeBalance,
  useL1TokenBalance,
  useL1TokenBalances,
} from '@/hooks/useL1Operations'
import {
  useL2HasSoulboundToken,
  useL2MintSoulboundToken,
  useL2TokenBalance,
  useL2WithdrawTokensToL1,
  useL1ContractAddresses,
  useL2NodeIsReady,
} from '@/hooks/useL2Operations'
import { showToast, useToast } from '@/hooks/useToast'
import clsxm from '@/utils/clsxm'
import NetworkModal from '@/components/model/Network'
import TokensModal from '@/components/model/TokensModal'
import {
  BridgeDirection,
  BridgeState,
  Network as NetworkType,
  Token as TokenType,
} from '@/types/bridge'
import BridgeSection from '@/components/BridgeSection'
import TransactionBreakdown from '@/components/TransactionBreakdown'
import BridgeFooter from '@/components/BridgeFooter'
import BridgeHeader from '@/components/BridgeHeader'
import { motion, AnimatePresence } from 'framer-motion'
import BridgeActionButton from '@/components/BridgeActionButton'
import { L1_NETWORKS, L2_NETWORKS, L1_TOKENS, L2_TOKENS, ADDRESS } from '@/config'
import MetaMaskPrompt from '@/components/model/MetaMaskPrompt'
import BalanceCard from '@/components/BalanceCard'
import { logInfo, logError } from '@/utils/datadog'
import PopupBlockedAlert from '@/components/model/PopupBlockedAlert'
import WalletSelectionModal from '@/components/model/WalletSelectionModal'
import { AztecWalletType } from '@/types/wallet'
import AzguardPrompt from '@/components/model/AzguardPrompt'
import { useWalletStore } from '@/stores/walletStore'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useRouter } from 'next/navigation'

// Function to check if popups are blocked
const isPopupBlocked = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // Log popup test initiation
    logInfo('Popup blocking test initiated', {
      testType: 'popup_detection',
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    })
    
    const popup = window.open('about:blank', '_blank', 'width=1,height=1')
    setTimeout(() => {
      if (!popup || popup.closed || popup.closed === undefined) {
        // Log popup blocked
        logInfo('Popups are blocked - user will see popup blocked alert', {
          popupBlocked: true,
          popupClosed: popup?.closed,
          popupUndefined: popup === undefined,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        })
        resolve(true) // Popups are blocked
      } else {
        // Log popup allowed
        logInfo('Popups are allowed - user can proceed normally', {
          popupBlocked: false,
          popupClosed: popup.closed,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        })
        popup.close()
        resolve(false) // Popups are allowed
      }
    }, 50)
  })
}

const variants = {
  hidden: { opacity: 0, y: 100 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -100 },
}

export default function Home() {
  const router = useRouter()

  // UI state
  const [selectNetwork, setSelectNetwork] = useState<boolean>(false)
  const [selectToken, setSelectToken] = useState<boolean>(false)
  const [isFromSection, setIsFromSection] = useState<boolean>(true)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputAmount, setInputAmount] = useState('')
  const [usdValue, setUsdValue] = useState('')

  // Operational state
  const [showSBTModal, setShowSBTModal] = useState(false)
  const [currentSBTChain, setCurrentSBTChain] = useState<'Ethereum' | 'Aztec'>(
    'Ethereum'
  )
  const [bridgeCompleted, setBridgeCompleted] = useState(false)
  const [arePopupsBlocked, setArePopupsBlocked] = useState<boolean | null>(null)
  const [showPopupBlockedAlert, setShowPopupBlockedAlert] = useState(false)

  // Notification system
  const notify = useToast()

  // Bridge store
  const {
    bridgeConfig,
    isPrivacyModeEnabled,
    updateNetwork,
    updateToken,
    swapDirection,
    setDirection,
    setBridgeConfig,
    resetStepState,
    reset: resetBridgeStore,
  } = useBridgeStore()

  // Get wallet state from useWalletSync
  const {
    isMetaMaskConnected,
    isAztecConnected,
    connectMetaMask,
    connectAztecWallet,
    disconnectMetaMask,
    disconnectAztec,
    executeAztecTransaction,
    azguardClient,
  } = useWalletSync()

  // Get UI state from walletStore
  const {
    showWalletModal,
    showAzguardPrompt,
    setShowWalletModal,
    setShowAzguardPrompt,
    aztecAddress,
    metaMaskAddress,
  } = useWalletStore()

  // Success callbacks
  const mintL1SBTOnSuccess = (data: any) => {
    console.log('L1 SBT minted:', data)
    setShowSBTModal(false)
  }

  const mintL2SBTOnSuccess = (data: any) => {
    console.log('L2 SBT minted:', data)
    setShowSBTModal(false)
  }

  const {
    data: l2NodeIsReady,
    isLoading: l2NodeIsReadyLoading,
    error: l2NodeIsReadyError,
    isError: l2NodeIsReadyIsError,
  } = useL2NodeIsReady()

  // L1 (Ethereum) balances and operations
  const {
    data: l1TokenBalances = [],
    isLoading: l1BalanceLoading,
    refetch: refetchL1Balance,
  } = useL1TokenBalances()

  // native token
  const sepoliaNativeTokens = l1TokenBalances.find(
    (token) => token.type === 'native' && token.network?.chainId === 11155111
  )
  const l1NativeBalance = sepoliaNativeTokens?.balance_formatted

  const l1Balance = l1TokenBalances.find(
    (token) => token.type === 'erc20' && token.network?.chainId === 11155111 && token.address === ADDRESS[11155111].L1.TOKEN_CONTRACT
  )?.balance_formatted

  // const { data: l1NativeBalance } = useL1NativeBalance()
  // const {
  //   data: l1Balance,
  //   ,
  //   refetch: refetchL1Balance,
  // } = useL1TokenBalance()
  const { data: hasL1SBT } = useL1HasSoulboundToken()
  const { mutate: mintL1SBT, isPending: mintL1SBTPending } =
    useL1MintSoulboundToken(mintL1SBTOnSuccess)

  // const { mutate: mintL1Tokens, isPending: mintL1TokensPending } =
  //   useL1MintTokens()

  // L2 (Aztec) balances and operations
  const {
    data: l2Balance = { privateBalance: null, publicBalance: null },
    isLoading: l2BalanceLoading,
    refetch: refetchL2Balance,
    error: l2BalanceError,
    isError: isL2BalanceError,
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
      setBridgeConfig({
        ...bridgeConfig,
        amount: '',
      })
      setBridgeCompleted(true)

      setTimeout(() => {
        setBridgeCompleted(false)
      }, 3000)
    },
    [refetchL1Balance, refetchL2Balance, setBridgeConfig, bridgeConfig]
  )

  const { mutate: bridgeTokensToL2, isPending: bridgeTokensToL2Pending } =
    useL1BridgeToL2(handleBridgeSuccess)

  const { mutate: withdrawTokensToL1, isPending: withdrawTokensToL1Pending } =
    useL2WithdrawTokensToL1(handleBridgeSuccess)

  // Faucet operations
  const useExternalFaucet = true // Set to true to redirect to Google Cloud faucet, false to use internal API
  const {
    mutate: requestFaucet,
    isPending: requestFaucetPending,
    needsGas,
    needsTokens,
    needsTokensOnly,
    isEligibleForFaucet,
    hasGas,
    balancesLoaded,
  } = useL1Faucet()

  // External faucet handler
  const handleExternalFaucet = () => {
    const googleFaucetUrl = 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia'
    
    // Log faucet redirect to Google
    logInfo('Faucet redirect to Google initiated', {
      faucetProvider: 'Google Cloud',
      faucetUrl: googleFaucetUrl,
      redirectType: 'external',
      userAction: 'faucet_redirect',
      network: 'Ethereum Sepolia',
    })
    
    window.open(googleFaucetUrl, '_blank')
  }

  // Helper functions for bridge operations
  const getCurrentSection = () => (isFromSection ? 'from' : 'to')
  const getOppositeSection = () => (isFromSection ? 'to' : 'from')

  // Handle network selection
  const handleSelectNetwork = (network: NetworkType) => {
    const section = getCurrentSection()
    updateNetwork(section, network)
    console.log('Selected network:', network)
  }

  // Handle token selection
  const handleSelectToken = (token: TokenType) => {
    const section = getCurrentSection()
    updateToken(section, token)
    console.log('Selected token:', token)
  }

  // Input amount change handler
  const handleAmountChange = (value: string) => {
    if (value === '' || !isNaN(Number(value))) {
      setBridgeConfig({
        ...bridgeConfig,
        amount: value,
      })
    }
  }

  // SBT minting handler
  const handleSBTMinted = async () => {
    try {
      if (bridgeConfig.direction === BridgeDirection.L2_TO_L1) {
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

  // Handle wallet selection
  const handleWalletSelect = async (type: AztecWalletType) => {
    try {
      // Log wallet selection attempt
      logInfo('User selected Aztec wallet type', {
        walletType: type,
        walletProvider: type === 'azguard' ? 'Azguard' : 'Obsidion',
        userAction: 'wallet_selection',
        popupsBlocked: arePopupsBlocked,
      })
      
      if (type === 'azguard' && !window.azguard) {
        // Log Azguard not installed
        logInfo('Azguard wallet not installed - showing prompt', {
          walletType: type,
          azguardInstalled: false,
          userAction: 'azguard_not_installed',
        })
        setShowAzguardPrompt(true)
        setShowWalletModal(false)
        return
      }
      
      // Log wallet connection attempt
      logInfo('Attempting to connect Aztec wallet', {
        walletType: type,
        walletProvider: type === 'azguard' ? 'Azguard' : 'Obsidion',
        userAction: 'wallet_connection_attempt',
        popupsBlocked: arePopupsBlocked,
      })
      
      await connectAztecWallet(type)
      setShowWalletModal(false)
      
      // Log successful wallet connection
      logInfo('Aztec wallet connection successful from UI', {
        walletType: type,
        walletProvider: type === 'azguard' ? 'Azguard' : 'Obsidion',
        userAction: 'wallet_connection_success',
        popupsBlocked: arePopupsBlocked,
      })
    } catch (error) {
      // Log wallet connection failure
      logError('Aztec wallet connection failed from UI', {
        walletType: type,
        walletProvider: type === 'azguard' ? 'Azguard' : 'Obsidion',
        userAction: 'wallet_connection_failure',
        popupsBlocked: arePopupsBlocked,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      
      notify(
        'error',
        `Failed to connect wallet: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }
  }

  // Test function for adding token to wallet
  // const testAddTokenToWallet = async () => {
  //   try {
  //     console.log('Testing add token to wallet...')
      
  //     if (!isAztecConnected) {
  //       throw new Error('Aztec wallet not connected')
  //     }
      
  //     // Import the SDK to access watchAssets
  //     const { sdk } = await import('../aztec')
      
  //     // Test token data (using the L2 token contract address)
  //     const testToken = {
  //       type: "ARC20" as const,
  //       options: {
  //         chainId: "1337", // Aztec testnet chain ID
  //         address: "0x011bbe04d65430ca1e05b8b7d092b9ede275b4380f34d4aea1e80ae750e645be",
  //         name: "Test USDC",
  //         symbol: "USDC",
  //         decimals: 6,
  //         image: "", // You can add a token image URL here if available
  //       },
  //     }
      
  //     console.log('Adding test token to wallet:', testToken)
      
  //     await sdk.watchAssets([testToken])
      
  //     console.log('Token successfully added to wallet')
  //     notify('success', 'Test token added to wallet successfully!')
      
  //   } catch (error) {
  //     console.error('Error testing add token to wallet:', error)
  //     notify('error', `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  //   }
  // }

  // Page visit tracking and component mount effects
  useEffect(() => {
    setMounted(true)
    
    // Log page visit/session start
    logInfo('User session started - page loaded', {
      sessionStart: true,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      referrer: document.referrer,
    })
  }, [])

  // Check if popups are blocked immediately after page load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Immediately check if popups are blocked
      isPopupBlocked().then((blocked) => {
        setArePopupsBlocked(blocked)
        if (blocked) {
          console.log('Popups are blocked for this site')
          logInfo('Popups are blocked - showing popup blocked alert to user', { 
            blocked,
            alertShown: true,
            userAction: 'popup_blocked_alert_displayed',
          })
          setShowPopupBlockedAlert(true)
        } else {
          console.log('Popups are allowed for this site')
          logInfo('Popups are allowed - user can proceed with wallet connections', {
            blocked: false,
            userAction: 'popup_allowed_proceed',
          })
        }
      })
    }
  }, [])

  useEffect(() => {
    resetStepState()
    resetBridgeStore()
  }, [resetStepState, resetBridgeStore])

  if (!mounted) return null

  const handleBridgeTokensToL2 = (amount: string) => {
    console.log('Bridge tokens to L2:', amount)
    setDirection(BridgeDirection.L1_TO_L2)
    setBridgeConfig({
      ...bridgeConfig,
      amount: amount,
    })
    router.push('/progress')
  }

  const handleWithdrawTokensToL1 = (amount: string) => {
    console.log('Withdraw tokens to L1:', amount)
    setDirection(BridgeDirection.L2_TO_L1)
    setBridgeConfig({
      ...bridgeConfig,
      amount: amount,
    })
    router.push('/progress')
  }

  return (
    <>
      <RootStyle>
        {showAzguardPrompt && (
          <AzguardPrompt onClose={() => setShowAzguardPrompt(false)} />
        )}
        {showPopupBlockedAlert && (
          <PopupBlockedAlert 
            onClose={() => {
              // Log when user closes popup blocked alert
              logInfo('User closed popup blocked alert', {
                userAction: 'popup_blocked_alert_closed',
                alertClosed: true,
                userGaveUp: true, // This might indicate user is giving up
              })
              setShowPopupBlockedAlert(false)
            }} 
          />
        )}
        {selectNetwork && (
          <NetworkModal
            setNetworkData={handleSelectNetwork}
            networkData={bridgeConfig[getCurrentSection()].network}
            handleClose={() => setSelectNetwork(false)}
            direction={bridgeConfig.direction}
            isFromSection={isFromSection}
          />
        )}
        {selectToken && (
          <TokensModal
            setTokensData={handleSelectToken}
            tokensData={bridgeConfig[getCurrentSection()].token}
            handleClose={() => setSelectToken(false)}
            direction={bridgeConfig.direction}
            isFromSection={isFromSection}
          />
        )}
        {showSBTModal && (
          <SBT
            address={metaMaskAddress || ''}
            buttonText={`Get SBT on ${currentSBTChain}`}
            chain={currentSBTChain}
            onMint={handleSBTMinted}
            onClose={() => setShowSBTModal(false)}
            isPending={
              bridgeConfig.direction === BridgeDirection.L2_TO_L1
                ? mintL2SBTPending
                : mintL1SBTPending
            }
          />
        )}
        <WalletSelectionModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          onSelect={handleWalletSelect}
        />

        <div className='grid grid-rows-[max-content_1fr_max-content] h-full'>
          <div className='p-5'>
            <BridgeHeader
              onClick={async () => {
                console.log('testing')

                // Add delay to ensure Datadog is initialized
                // setTimeout(() => {
                //   logInfo('log info testing ------------- aztec')
                //   logError('log error testing ------------- aztec')
                //   console.log('testing done')
                // }, 1000)

                await disconnectMetaMask()
                await disconnectAztec()
                localStorage.clear()
                window.location.reload()


                // const fakePromise = new Promise((resolve, reject) => {
                //   setTimeout(() => {
                //     // Change to resolve() to test success, or reject() to test error
                //     resolve('All done!')

                //     // reject(new Error('Something went wrong!'))
                //   }, 5000)
                // })

                // notify.promise(
                //   fakePromise,
                //   {
                //     pending: {
                //       message: 'Processing...',
                //       heading: 'Please wait',
                //     },
                //     success: {
                //       message: 'Operation successful!',
                //       heading: 'Success',
                //     },
                //     error: { message: 'Operation failed!', heading: 'Error' },
                //   }
                //   // { autoClose: false, animatePromise: true }
                // )
                // showToast.promise(
                //   fakePromise,
                //   {
                //     pending: 'Processing...',
                //     success: 'Operation successful!',
                //     error: 'Operation failed!',
                //   }
                // )
              }}
            />
          </div>

          <div className='px-5'>
            <AnimatePresence mode='popLayout'>
              {!showBreakdown ? (
                <motion.div
                  key='bridge'
                  initial='hidden'
                  animate='enter'
                  exit='exit'
                  variants={variants}
                  transition={{ ease: 'easeInOut', duration: 0.5 }}>
                  <BridgeSection
                    bridgeConfig={bridgeConfig}
                    setIsFromSection={setIsFromSection}
                    setSelectNetwork={setSelectNetwork}
                    setSelectToken={setSelectToken}
                    inputAmount={bridgeConfig.amount}
                    setInputAmount={handleAmountChange}
                    l1NativeBalance={l1NativeBalance}
                    l1Balance={l1Balance}
                    l2Balance={l2Balance }
                    direction={bridgeConfig.direction}
                    inputRef={inputRef as React.RefObject<HTMLInputElement>}
                    onSwap={swapDirection}
                    isPrivacyModeEnabled={isPrivacyModeEnabled}
                  />
                  <TransactionBreakdown
                    isOpen={false}
                    onToggle={() => setShowBreakdown(true)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key='breakdown'
                  initial='hidden'
                  animate='enter'
                  exit='exit'
                  variants={variants}
                  transition={{ ease: 'easeInOut', duration: 0.5 }}>
                  <TransactionBreakdown
                    isOpen={true}
                    onToggle={() => setShowBreakdown(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className='self-end'>
            <div className='rounded-[16px] border border-[#D4D4D4] bg-white shadow-[0px_0px_16px_0px_rgba(0,0,0,0.16)] flex flex-col items-center gap-[16px] pt-[16px] pr-[10px] pb-0 pl-[10px] w-full'>
              <BridgeActionButton
                // isDisabled={isMetaMaskConnected && isAztecConnected && isL2BalanceError}
                // isDisabled={isMetaMaskConnected && isAztecConnected && true}
                // Connection states
                isMetaMaskConnected={isMetaMaskConnected}
                connectMetaMask={connectMetaMask}
                isAztecConnected={isAztecConnected}
                connectAztec={() => setShowWalletModal(true)}
                inputRef={inputRef}
                // Balance and amount states
                inputAmount={bridgeConfig.amount}
                l1Balance={l1Balance?.toString() || '0'}
                l2Balance={l2PublicBalance || '0'}
                l1BalanceLoading={l1BalanceLoading}
                l2BalanceLoading={l2BalanceLoading}
                // Bridge direction
                direction={bridgeConfig.direction}
                // Core operations
                bridgeTokensToL2={handleBridgeTokensToL2}
                withdrawTokensToL1={handleWithdrawTokensToL1}
                requestFaucet={requestFaucet}
                useExternalFaucet={useExternalFaucet}
                handleExternalFaucet={handleExternalFaucet}
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
                // Disable if L2 node error
                l2NodeError={l2NodeIsReadyIsError && !l2NodeIsReadyLoading}
                l2NodeIsReadyLoading={l2NodeIsReadyLoading}
              />
              
              {/* Test button for adding token to wallet */}
              {/* {isAztecConnected && (
                <div className="px-4 pb-4">
                  <button
                    onClick={testAddTokenToWallet}
                    className="w-full bg-success-500 hover:bg-success-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Test Add Token to Wallet
                  </button>
                </div>
              )} */}
              
              <BridgeFooter />
            </div>
          </div>
        </div>
      </RootStyle>
    </>
  )
}
