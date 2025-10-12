import { useEffect, useCallback } from 'react'
import { useAccount as useAztecAccount } from '@nemi-fi/wallet-sdk/react'
import { sdk, connectWallet } from '../aztec'
import { useWalletStore } from '@/stores/walletStore'
import { useContractStore } from '@/stores/contractStore'
import { showToast } from '@/hooks/useToast'
import { logInfo, logError } from '@/utils/datadog'
import { AztecWalletType } from '@/types/wallet'
import { useHumanWalletStore } from '@/stores/humanWalletStore'
import { sepolia } from 'wagmi/chains'

export function useWalletSync() {
  // MetaMask hooks
  const {
    address: metaMaskAddress,
    isConnected: isMetaMaskConnected,
    chainId,
    walletName,
    login: connect,
    logout: wagmiDisconnect,
    switchChain,
    signMessage,
    getCurrentLoginMethod,
  } = useHumanWalletStore()

  // Aztec hooks
  const account = useAztecAccount(sdk)
  const aztecAddress = account?.address.toString()
  const isAztecConnected = !!aztecAddress

  // Get store actions
  const {
    setMetaMaskState,
    setAztecWalletType,
    setAztecState,
    disconnectAztecWallet,
    executeAztecTransaction,
    azguardClient,
    setShowWalletModal,
  } = useWalletStore()

  // Get contract store actions
  const { setL2Contracts, resetContracts } = useContractStore()

  // Sync MetaMask state with store
  useEffect(() => {
    setMetaMaskState({
      address: metaMaskAddress || null,
      isConnected: isMetaMaskConnected,
      chainId: chainId || null,
    })
  }, [metaMaskAddress, isMetaMaskConnected, chainId, setMetaMaskState])

  // Log wallet connection method when wallet is already connected
  useEffect(() => {
    if (isMetaMaskConnected && walletName) {
      // Log the connection method for already connected wallets
      logInfo('Ethereum wallet already connected', {
        walletType: 'Ethereum',
        connectionMethod: walletName,
        walletProvider: walletName,
        address: metaMaskAddress || '',
        chainId,
        userAction: 'ethereum_wallet_already_connected',
        loginMethod: walletName,
      })
    }
  }, [isMetaMaskConnected, walletName, metaMaskAddress, chainId])

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
      if (isMetaMaskConnected && chainId && chainId !== sepolia.id) {
        try {
          await switchChain(sepolia.id)
        } catch (error) {
          logError('Failed to switch network', { error, chainId })
          showToast('error', 'Failed to switch to Sepolia network')
        }
      }
    }
    handleNetworkSwitch()
  }, [isMetaMaskConnected, chainId, switchChain])

  // Connect MetaMask
  const connectMetaMask = useCallback(async () => {
    try {
      await connect()
      
      // After successful connection, get the connection method
      if (getCurrentLoginMethod) {
        const loginMethod = await getCurrentLoginMethod()
        logInfo('Ethereum wallet connection completed', {
          walletType: 'Ethereum',
          connectionMethod: loginMethod,
          loginMethod: loginMethod,
          userAction: 'ethereum_wallet_connection_completed',
        })
      }
    } catch (error) {
      console.log('🚀MMM - ~ connectMetaMask ~ error:', error)
      logError('Failed to connect Ethereum wallet', { error })
      showToast('error', 'Failed to connect Ethereum wallet')
      throw error
    }
  }, [connect, getCurrentLoginMethod])

  // Connect Aztec Wallet
  const connectAztecWallet = useCallback(
    async (type: AztecWalletType) => {
      try {
        // Log wallet connection attempt
        logInfo('Aztec wallet connection initiated', {
          walletType: type,
          walletProvider: type === 'azguard' ? 'Azguard' : 'Obsidion',
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
          walletType: type,
          walletProvider: type === 'azguard' ? 'Azguard' : 'Obsidion',
          aztecAddress: connectedAccount?.address.toString(),
          connectionSuccess: true,
        })

        return connectedAccount
      } catch (error) {
        // Log wallet connection failure
        logError('Failed to connect Aztec wallet', {
          walletType: type,
          walletProvider: type === 'azguard' ? 'Azguard' : 'Obsidion',
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

  // Disconnect MetaMask
  const disconnectMetaMask = useCallback(async () => {
    try {
      await wagmiDisconnect()
    } catch (error) {
      logError('Failed to disconnect Ethereum wallet', { error })
      showToast('error', 'Failed to disconnect Ethereum wallet')
    }
  }, [wagmiDisconnect])

  // Disconnect Aztec
  const disconnectAztec = useCallback(async () => {
    try {
      await disconnectAztecWallet()
    } catch (error) {
      logError('Failed to disconnect Aztec wallet', { error })
      showToast('error', 'Failed to disconnect Aztec wallet')
    }
  }, [disconnectAztecWallet])

  return {
    // MetaMask
    metaMaskAddress,
    isMetaMaskConnected,
    connectMetaMask,
    disconnectMetaMask,

    // Aztec
    aztecAddress,
    isAztecConnected,
    connectAztecWallet,
    disconnectAztec,
    executeAztecTransaction,
    azguardClient,
  }
}
