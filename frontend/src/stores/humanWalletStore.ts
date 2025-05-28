import { l1ChainId, silkConfig } from '@/config/l1.config'
import { showToast } from '@/hooks/useToast'
import { initSilk, SILK_METHOD } from '@silk-wallet/silk-wallet-sdk'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

// Add type declaration for window.silk
declare global {
  interface Window {
    silk: any
  }
}

interface HumanWalletState {
  address: string
  chainId: number | null
  isConnected: boolean
  error: Error | null
  walletName: string | null

  // Human Wallet Actions
  initializeHumanWallet: () => void
  login: () => Promise<void>
  logout: () => Promise<void>
  switchChain: (chainId: number) => Promise<void>
  getChainId: () => Promise<number>
  signMessage: (message: string) => Promise<string>
  getAccount: () => Promise<string | null>

  // Reset the store
  reset: () => void
}

const initialState = {
  address: '',
  chainId: null,
  isConnected: false,
  error: null,
  walletName: null,
}

// Utility functions for common operations
const handleError = (err: unknown, message: string, set: any) => {
  // console.error(message, err)
  const error = err instanceof Error ? err : new Error(String(err))
  set({ error })
  showToast('error', `${message}: ${error.message}`)
  throw error
}

export const requestHumanWallet = async (
  method: SILK_METHOD,
  params?: any[]
) => {
  return window.silk.request({ method, params })
}

// Export the store directly for use with getState
export const humanWalletStore = create<HumanWalletState>((set, get) => ({
  ...initialState,

  initializeHumanWallet: () => {
    try {
      initSilk(silkConfig)

      const { getAccount, switchChain } = get()

      // Get initial account
      getAccount()

      // Switch to mainnet
      // switchChain(1)

      // Set up event listeners
      window.silk.on('accountsChanged', (accounts: string[]) => {
        set({ address: accounts[0], isConnected: accounts.length > 0 })
      })

      window.silk.on('chainChanged', (chainId: string) => {
        const chainIdNumber = parseInt(chainId, 16)
        set({ chainId: chainIdNumber })
      })
    } catch (err) {
      handleError(err, 'Failed to initialize human wallet', set)
    }
  },

  login: async () => {
    try {
      const result = await window.silk.login()
      console.log('🚀MMM - ~ login: ~ result:', result)
      const { getAccount, switchChain, getChainId } = get()
      const address = await getAccount()
      await switchChain(l1ChainId)
      const chainId = await getChainId()

      const state = {
        address: address || '',
        chainId,
        isConnected: !!address,
        walletName: result,
      }
      console.log('🚀MMM - ~ login: ~ state:', state)

      set(state)
    } catch (err) {
      console.log('🚀MMM - ~ login: ~ err:', err)
      handleError(err, 'Failed to login', set)
    }
  },

  logout: async () => {
    try {
      await window.silk.logout()
      set(initialState)
    } catch (err) {
      handleError(err, 'Failed to logout', set)
    }
  },

  switchChain: async (chainId: number) => {
    try {
      const chainIdHex = `0x${chainId.toString(16)}`
      await requestHumanWallet(SILK_METHOD.wallet_switchEthereumChain, [
        { chainId: chainIdHex },
      ])
      set({ chainId })
    } catch (err) {
      handleError(err, 'Failed to switch chain', set)
    }
  },

  getChainId: async () => {
    try {
      const chainId = await requestHumanWallet(SILK_METHOD.eth_chainId)
      const chainIdNumber = parseInt(chainId as string, 16)
      set({ chainId: chainIdNumber })
      return chainIdNumber
    } catch (err) {
      return handleError(err, 'Failed to get chain ID', set)
    }
  },

  getAccount: async () => {
    try {
      const accounts = await requestHumanWallet(SILK_METHOD.eth_requestAccounts)
      const address = (accounts as string[])[0]

      if (!address) {
        set({ address: '', isConnected: false })
        return null
      }

      set({ address, isConnected: !!address })
      return address
    } catch (err) {
      return handleError(err, 'Failed to get account', set)
    }
  },

  signMessage: async (message: string) => {
    try {
      const { address } = get()
      if (!address) {
        throw new Error('No wallet connected')
      }

      const signature = await requestHumanWallet(SILK_METHOD.personal_sign, [
        message,
        address,
      ])
      return signature as string
    } catch (err) {
      return handleError(err, 'Failed to sign message', set)
    }
  },

  reset: () => set(initialState),
}))

// Export the hook for use in components
export const useHumanWalletStore = () =>
  humanWalletStore(
    useShallow((state) => ({
      // Human Wallet State
      address: state.address,
      chainId: state.chainId,
      isConnected: state.isConnected,
      error: state.error,
      walletName: state.walletName,

      // Actions
      initializeHumanWallet: state.initializeHumanWallet,
      login: state.login,
      logout: state.logout,
      switchChain: state.switchChain,
      getChainId: state.getChainId,
      signMessage: state.signMessage,
      getAccount: state.getAccount,
      reset: state.reset,
    }))
  )
