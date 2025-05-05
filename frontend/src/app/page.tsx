'use client'
import TextButton from '@/components/TextButton'
import { useAztecWallet } from '@/hooks/useAztecWallet'
import { useMetaMask } from '@/hooks/useMetaMask'
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
} from '@/hooks/useL1Operations'
import {
  useL2HasSoulboundToken,
  useL2MintSoulboundToken,
  useL2TokenBalance,
  useL2WithdrawTokensToL1,
} from '@/hooks/useL2Operations'
import { useToast } from '@/hooks/useToast'
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
import { L1_NETWORKS, L2_NETWORKS, L1_TOKENS, L2_TOKENS } from '@/config'
import MetaMaskPrompt from '@/components/model/MetaMaskPrompt'
import BalanceCard from '@/components/BalanceCard'
import { logInfo, logError } from '@/utils/datadog'

const DEFAULT_BRIDGE_STATE: BridgeState = {
  from: { network: L1_NETWORKS[0], token: L1_TOKENS[0] },
  to: { network: L2_NETWORKS[0], token: L2_TOKENS[0] },
  direction: BridgeDirection.L1_TO_L2,
}

const variants = {
  hidden: { opacity: 0, y: 100 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -100 },
}

export default function Home() {
  // UI state
  const [bridgeConfig, setBridgeConfig] =
    useState<BridgeState>(DEFAULT_BRIDGE_STATE)
  const [inputAmount, setInputAmount] = useState<string>('')
  const [usdValue, setUsdValue] = useState<string>('$0.00')
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectNetwork, setSelectNetwork] = useState<boolean>(false)
  const [selectToken, setSelectToken] = useState<boolean>(false)
  const [isFromSection, setIsFromSection] = useState<boolean>(true)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Operational state
  const [showSBTModal, setShowSBTModal] = useState(false)
  const [currentSBTChain, setCurrentSBTChain] = useState<'Ethereum' | 'Aztec'>(
    'Ethereum'
  )
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

  // Helper functions for bridge operations
  const getCurrentSection = () => (isFromSection ? 'from' : 'to')
  const getOppositeSection = () => (isFromSection ? 'to' : 'from')

  // Handle network selection
  const handleSelectNetwork = (network: NetworkType) => {
    const section = getCurrentSection()
    setBridgeConfig((prev) => ({
      ...prev,
      [section]: { ...prev[section], network },
    }))
    console.log('Selected network:', network)
  }

  // Handle token selection
  const handleSelectToken = (token: TokenType) => {
    const section = getCurrentSection()
    setBridgeConfig((prev) => ({
      ...prev,
      [section]: { ...prev[section], token },
    }))
    console.log('Selected token:', token)
  }

  // Network and token swap handler
  const handleSwap = () => {
    setBridgeConfig((prev) => ({
      from: prev.to,
      to: prev.from,
      direction:
        prev.direction === BridgeDirection.L1_TO_L2
          ? BridgeDirection.L2_TO_L1
          : BridgeDirection.L1_TO_L2,
    }))
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

  // Check for MetaMask on component mount
  const [showMetaMaskPrompt, setShowMetaMaskPrompt] = useState(false)
  
  // Page visit tracking and component mount effects
  useEffect(() => {
    setMounted(true)
    
    // Log page visit when component mounts
    if (typeof window !== 'undefined') {
      logInfo('User visited bridge page', {
        url: window.location.href,
        referrer: document.referrer || 'direct'
      })
    }
    
    // Check for MetaMask
    const checkMetaMask = async () => {
      if (typeof window !== 'undefined' && !window.ethereum) {
        setShowMetaMaskPrompt(true)
      }
    }
    checkMetaMask()
  }, [])
  
  if (!mounted) return null

  return (
    <>
      <RootStyle>
        {showMetaMaskPrompt && (
          <MetaMaskPrompt onClose={() => setShowMetaMaskPrompt(false)} />
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

        <div className='grid grid-rows-[max-content_1fr_max-content] h-full'>
          <div className='mt-4'>
            <BridgeHeader
              onClick={() => {
                disconnectMetaMask()
                disconnectAztec()
                window.location.reload()
              }}
            />
          </div>
          <div className='p-5 py-3'>
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
                    inputAmount={inputAmount}
                    setInputAmount={setInputAmount}
                    l1NativeBalance={l1NativeBalance}
                    l1Balance={l1Balance}
                    l2PublicBalance={l2PublicBalance}
                    direction={bridgeConfig.direction}
                    inputRef={inputRef as React.RefObject<HTMLInputElement>}
                    onSwap={handleSwap}
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
            {' '}
            <div className='bg-white rounded-md pt-4 px-5 flex flex-col h-full'>
              <div className='flex-1'>
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
                    // Bridge direction
                    direction={bridgeConfig.direction}
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
              </div>
              <BridgeFooter />
            </div>
          </div>
        </div>
      </RootStyle>
    </>
  )
}
