import { useEffect, useCallback } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { sepolia } from 'wagmi/chains'
import { useAccount as useAztecAccount } from '@nemi-fi/wallet-sdk/react'
import { sdk, connectWallet } from '../aztec'
import { useWalletStore } from '@/stores/walletStore'
import { useContractStore } from '@/stores/contractStore'
import { showToast } from '@/utils/toast'
import { logError } from '@/utils/datadog'
import { AztecWalletType } from '@/types/wallet'

export function useWalletSync() {
  // MetaMask hooks
  const { address: metaMaskAddress, isConnected: isMetaMaskConnected, chainId } = useAccount()
  const { connect } = useConnect()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

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
    setShowWalletModal
  } = useWalletStore()

  // Get contract store actions
  const { setL2Contracts, resetContracts } = useContractStore()

  // Sync MetaMask state with store
  useEffect(() => {
    setMetaMaskState({
      address: metaMaskAddress || null,
      isConnected: isMetaMaskConnected,
      chainId: chainId || null
    })
  }, [metaMaskAddress, isMetaMaskConnected, chainId, setMetaMaskState])

  // Sync Aztec state with store
  useEffect(() => {
    if (aztecAddress) {
      setAztecState({
        address: aztecAddress,
        account: account,
        isConnected: true
      })
      
      // Update contract state
      setL2Contracts(account)
    } else {
      // Reset Aztec state
      setAztecState({
        address: null,
        account: null,
        isConnected: false
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
          await switchChain({ chainId: sepolia.id })
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
      await connect({ connector: injected() })
    } catch (error) {
      logError('Failed to connect MetaMask', { error })
      showToast('error', 'Failed to connect MetaMask wallet')
      throw error
    }
  }, [connect])

  // Connect Aztec Wallet
  const connectAztecWallet = useCallback(async (type: AztecWalletType) => {
    try {
      const connectedAccount = await connectWallet(type)
      
      // Update wallet type
      setAztecWalletType(type)
      
      // Update Aztec state
      setAztecState({
        address: connectedAccount?.address.toString() || null,
        account: connectedAccount,
        isConnected: !!connectedAccount
      })
      
      // Update contract state
      if (connectedAccount) {
        setL2Contracts(connectedAccount)
      }
      
      // Close wallet modal
      setShowWalletModal(false)
      
      return connectedAccount
    } catch (error) {
      logError('Failed to connect Aztec wallet', { error })
      showToast('error', `Failed to connect to ${type} wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }, [setAztecWalletType, setAztecState, setL2Contracts, setShowWalletModal])

  // Disconnect MetaMask
  const disconnectMetaMask = useCallback(async () => {
    try {
      await wagmiDisconnect()
    } catch (error) {
      logError('Failed to disconnect MetaMask', { error })
      showToast('error', 'Failed to disconnect MetaMask wallet')
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