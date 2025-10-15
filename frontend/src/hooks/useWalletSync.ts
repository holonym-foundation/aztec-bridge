import { useEffect, useCallback } from 'react'
import { useAccount as useAztecAccount } from '@nemi-fi/wallet-sdk/react'
import { sdk, connectWallet } from '../aztec'
import { useWalletStore } from '@/stores/walletStore'
import { useContractStore } from '@/stores/contractStore'
import { showToast } from '@/hooks/useToast'
import { logInfo, logError } from '@/utils/datadog'
import { AztecLoginMethod, WalletType } from '@/types/wallet'
import { useWaapWalletStore } from '@/stores/waapWalletStore'
import { sepolia } from 'wagmi/chains'

export function useWalletSync() {
  // WaaP (Wallet as a Protocol) hooks
  const {
    address: waapAddress,
    isConnected: isWaapConnected,
    chainId,
    loginMethod,
    walletProvider,
    walletIcon,
    login: connect,
    logout: wagmiDisconnect,
    switchChain,
    signMessage,
    getLoginMethod,
    getWalletProvider,
    getWalletIcon,
  } = useWaapWalletStore()

  // Aztec hooks
  const account = useAztecAccount(sdk)
  const aztecAddress = account?.address.toString()
  const isAztecConnected = !!aztecAddress

  // Get store actions
  const {
    setWaapState,
    setAztecWalletType,
    setAztecState,
    disconnectAztecWallet,
    executeAztecTransaction,
    azguardClient,
    setShowWalletModal,
  } = useWalletStore()

  // Get contract store actions
  const { setL2Contracts, resetContracts } = useContractStore()

  // Sync WaaP state with store
  useEffect(() => {
    setWaapState({
      address: waapAddress || null,
      isConnected: isWaapConnected,
      chainId: chainId || null,
    })
  }, [waapAddress, isWaapConnected, chainId, setWaapState])

  // Retrieve login method when wallet is already connected (e.g., on page reload)
  useEffect(() => {
    if (isWaapConnected && !loginMethod && getLoginMethod) {
      console.log('🔄 Wallet connected but loginMethod is null, retrieving login method...')
      // Get the login method for already connected wallets
      getLoginMethod()
    }
  }, [isWaapConnected, loginMethod, getLoginMethod])

  // Log wallet connection method when wallet is already connected
  useEffect(() => {
    if (isWaapConnected && loginMethod && walletProvider) {
      // Log the connection method for already connected wallets
      logInfo('WaaP wallet already connected', {
        walletType: WalletType.WAAP,
        loginMethod: loginMethod,
        walletProvider: walletProvider,
        address: waapAddress || '',
        chainId,
        userAction: 'waap_wallet_already_connected',
      })
    }
  }, [isWaapConnected, loginMethod, walletProvider, waapAddress, chainId])

  // Sync Aztec state with store
  useEffect(() => {
    if (aztecAddress) {
      setAztecState({
        address: aztecAddress,
        account: account,
        isConnected: true,
      })

      // Update contract state
      setL2Contracts(account)
    } else {
      // Reset Aztec state
      setAztecState({
        address: null,
        account: null,
        isConnected: false,
      })

      // Reset contract state
      resetContracts()
    }
  }, [aztecAddress, account, setAztecState, setL2Contracts, resetContracts])

  // Handle network switching
  useEffect(() => {
    const handleNetworkSwitch = async () => {
      if (isWaapConnected && chainId && chainId !== sepolia.id) {
        try {
          // Log network switch attempt
          logInfo('Network switch initiated', {
            walletType: WalletType.WAAP,
            fromChainId: chainId,
            toChainId: sepolia.id,
            userAction: 'network_switch_attempt',
          })
          
          await switchChain(sepolia.id)
          
          // Log successful network switch
          logInfo('Network switch successful', {
            walletType: WalletType.WAAP,
            fromChainId: chainId,
            toChainId: sepolia.id,
            userAction: 'network_switch_success',
          })
        } catch (error) {
          logError('Failed to switch network', { 
            walletType: WalletType.WAAP,
            fromChainId: chainId,
            toChainId: sepolia.id,
            userAction: 'network_switch_failure',
            error 
          })
          showToast('error', 'Failed to switch to Sepolia network')
        }
      }
    }
    handleNetworkSwitch()
  }, [isWaapConnected, chainId, switchChain])

  // Connect WaaP wallet
  const connectWaapWallet = useCallback(async () => {
    try {
      await connect()
      
      // After successful connection, get the connection method
      if (getLoginMethod) {
        const loginMethod = await getLoginMethod()
        
        logInfo('WaaP wallet connection completed', {
          walletType: WalletType.WAAP,
          loginMethod: loginMethod,
          walletProvider: walletProvider,
          userAction: 'waap_wallet_connection_completed',
        })
      }
    } catch (error) {
      console.log('🚀MMM - ~ connectWaapWallet ~ error:', error)
      logError('Failed to connect WaaP wallet', { error })
      if (typeof error === 'string') {
        showToast('error', error)
      }
      throw error
    }
  }, [connect, getLoginMethod])

  // Connect Aztec Wallet
  const connectAztecWallet = useCallback(
    async (type: AztecLoginMethod) => {
      try {
        // Log wallet connection attempt
        logInfo('Aztec wallet connection initiated', {
          walletType: WalletType.AZTEC,
          loginMethod: type,
          connectionAttempt: true,
        })

        const connectedAccount = await connectWallet(type)

        // Update wallet type
        setAztecWalletType(type)

        // Update Aztec state
        setAztecState({
          address: connectedAccount?.address.toString() || null,
          account: connectedAccount,
          isConnected: !!connectedAccount,
        })

        // Update contract state
        if (connectedAccount) {
          setL2Contracts(connectedAccount)
        }

        // Close wallet modal
        setShowWalletModal(false)

        // Log successful wallet connection
        logInfo('Aztec wallet connected successfully', {
          walletType: WalletType.AZTEC,
          loginMethod: type,
          aztecAddress: connectedAccount?.address.toString(),
          connectionSuccess: true,
        })

        return connectedAccount
      } catch (error) {
        // Log wallet connection failure
        logError('Failed to connect Aztec wallet', {
          walletType: WalletType.AZTEC,
          loginMethod: type,
          connectionFailure: true,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        
        showToast(
          'error',
          `Failed to connect to ${type} wallet: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
        throw error
      }
    },
    [setAztecWalletType, setAztecState, setL2Contracts, setShowWalletModal]
  )

  // Disconnect WaaP wallet
  const disconnectWaapWallet = useCallback(async () => {
    try {
      // Log disconnection attempt
      logInfo('WaaP wallet disconnection initiated', {
        walletType: WalletType.WAAP,
        loginMethod: loginMethod,
        walletProvider: walletProvider,
        address: waapAddress || '',
        userAction: 'waap_wallet_disconnection_attempt',
      })
      
      await wagmiDisconnect()
      
      // Log successful disconnection
      logInfo('WaaP wallet disconnected successfully', {
        walletType: WalletType.WAAP,
        loginMethod: loginMethod,
        walletProvider: walletProvider,
        userAction: 'waap_wallet_disconnection_success',
      })
    } catch (error) {
      logError('Failed to disconnect WaaP wallet', { 
        walletType: WalletType.WAAP,
        loginMethod: loginMethod,
        walletProvider: walletProvider,
        userAction: 'waap_wallet_disconnection_failure',
        error 
      })
      showToast('error', 'Failed to disconnect Ethereum wallet')
    }
  }, [wagmiDisconnect, loginMethod, walletProvider, waapAddress])

  // Disconnect Aztec
  const disconnectAztec = useCallback(async () => {
    try {
      // Log disconnection attempt
      logInfo('Aztec wallet disconnection initiated', {
        walletType: WalletType.AZTEC,
        aztecAddress: aztecAddress || '',
        userAction: 'aztec_wallet_disconnection_attempt',
      })
      
      await disconnectAztecWallet()
      
      // Log successful disconnection
      logInfo('Aztec wallet disconnected successfully', {
        walletType: WalletType.AZTEC,
        userAction: 'aztec_wallet_disconnection_success',
      })
    } catch (error) {
      logError('Failed to disconnect Aztec wallet', { 
        walletType: WalletType.AZTEC,
        aztecAddress: aztecAddress || '',
        userAction: 'aztec_wallet_disconnection_failure',
        error 
      })
      showToast('error', 'Failed to disconnect Aztec wallet')
    }
  }, [disconnectAztecWallet, aztecAddress])

  return {
    // WaaP wallet
    waapAddress,
    isWaapConnected,
    connectWaapWallet,
    disconnectWaapWallet,
    loginMethod,
    walletProvider,
    walletIcon,
    getWalletProvider,
    getWalletIcon,

    // Aztec
    aztecAddress,
    isAztecConnected,
    connectAztecWallet,
    disconnectAztec,
    executeAztecTransaction,
    azguardClient,
  }
}
