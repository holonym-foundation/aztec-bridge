import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { AztecLoginMethod } from '@/types/wallet'
import { sdk, connectWallet } from '../aztec'
import { AzguardClient } from '@azguardwallet/client'
import { useAccount as useAztecAccount } from '@nemi-fi/wallet-sdk/react'
import { showToast } from '@/hooks/useToast'
import { sepolia } from 'wagmi/chains'

// Add type declaration for window.azguard
declare global {
  interface Window {
    azguard?: any
  }
}

// Constants for localStorage keys
const AZTEC_WALLET_KEY = 'aztecLoginMethod'

interface WalletState {
  // UI State
  showWalletModal: boolean
  showAzguardPrompt: boolean

  // Aztec Wallet State
  aztecLoginMethod: AztecLoginMethod | null
  aztecAddress: string | null
  aztecAccount: any | null
  isAztecConnected: boolean
  isAztecConnecting: boolean
  aztecError: Error | null
  azguardClient: AzguardClient | null

  // WaaP wallet State
  waapAddress: `0x${string}` | null
  isWaapConnected: boolean
  waapChainId: number | null
  waapError: Error | null

  // UI Actions
  setShowWalletModal: (show: boolean) => void
  setShowAzguardPrompt: (show: boolean) => void

  // Aztec Actions
  setAztecLoginMethod: (type: AztecLoginMethod | null) => void
  setAztecState: (state: {
    address: string | null
    account: any | null
    isConnected: boolean
    error?: Error | null
  }) => void
  disconnectAztecWallet: () => Promise<void>
  executeAztecTransaction: (actions: any[]) => Promise<string>

  // WaaP wallet Actions
  setWaapState: (state: {
    address: string | null
    isConnected: boolean
    chainId: number | null
    error?: Error | null
  }) => void
  switchWaapChain: (chainId: number) => Promise<void>

  // Reset
  reset: () => void
}

// Helper function to get initial wallet type from localStorage
const getInitialWalletType = (): AztecLoginMethod | null => {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(AZTEC_WALLET_KEY)
  return stored ? (stored as AztecLoginMethod) : null
}

const initialState = {
  showWalletModal: false,
  showAzguardPrompt: false,
  aztecLoginMethod: getInitialWalletType(),
  aztecAddress: null,
  aztecAccount: null,
  isAztecConnected: false,
  isAztecConnecting: false,
  aztecError: null,
  azguardClient: null,
  waapAddress: null,
  isWaapConnected: false,
  waapChainId: null,
  waapError: null,
}

const walletStore = create<WalletState>((set, get) => ({
  ...initialState,

  // UI Actions
  setShowWalletModal: (show) => set({ showWalletModal: show }),
  setShowAzguardPrompt: (show) => set({ showAzguardPrompt: show }),

  // Aztec Actions
  setAztecLoginMethod: (type) => {
    if (type) {
      localStorage.setItem(AZTEC_WALLET_KEY, type)
    } else {
      localStorage.removeItem(AZTEC_WALLET_KEY)
    }
    set({ aztecLoginMethod: type })
  },

  setAztecState: (state) => {
    // Get wallet type from localStorage if not already set
    const storedWalletType = localStorage.getItem(
      AZTEC_WALLET_KEY
    ) as AztecLoginMethod | null

    set({
      aztecAddress: state.address,
      aztecAccount: state.account,
      isAztecConnected: state.isConnected,
      aztecError: state.error || null,
      aztecLoginMethod: storedWalletType,
    })
  },

  disconnectAztecWallet: async () => {
    try {
      await sdk.disconnect()
      set({
        azguardClient: null,
        aztecAddress: null,
        aztecAccount: null,
        isAztecConnected: false,
        aztecLoginMethod: null,
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      set({ aztecError: error })
      showToast('error', `Failed to disconnect Aztec wallet: ${error.message}`)
    }
  },

  executeAztecTransaction: async (actions: any[]) => {
    const { aztecLoginMethod, azguardClient } = get()

    if (aztecLoginMethod === 'azguard' && azguardClient) {
      const results = await azguardClient.execute(actions)
      if (results.length > 0 && results[0].status === 'success') {
        return results[0].txHash
      } else {
        const error = new Error(
          `Transaction failed: ${results[0]?.error || 'Unknown error'}`
        )
        showToast('error', error.message)
        throw error
      }
    } else {
      const error = new Error(
        'Transaction execution not supported for this wallet type'
      )
      showToast('error', error.message)
      throw error
    }
  },

  // WaaP wallet Actions
  setWaapState: (state) =>
    set({
      waapAddress: state.address as `0x${string}`,
      isWaapConnected: state.isConnected,
      waapChainId: state.chainId,
      waapError: state.error || null,
    }),

  switchWaapChain: async (chainId: number) => {
    try {
      if (chainId !== sepolia.id) {
        showToast('info', `Switching to Sepolia network`)
        // The actual chain switching is handled by the useMetaMask hook
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      set({ waapError: error })
      showToast('error', `Failed to switch network: ${error.message}`)
    }
  },

  reset: () => {
    localStorage.removeItem(AZTEC_WALLET_KEY)
    set(initialState)
  },
}))

// Export main store with all state and actions
export const useWalletStore = () =>
  walletStore(
    useShallow((state) => ({
      // UI State
      showWalletModal: state.showWalletModal,
      showAzguardPrompt: state.showAzguardPrompt,

      // Aztec State
      aztecLoginMethod: state.aztecLoginMethod,
      aztecAddress: state.aztecAddress,
      aztecAccount: state.aztecAccount,
      isAztecConnected: state.isAztecConnected,
      isAztecConnecting: state.isAztecConnecting,
      aztecError: state.aztecError,
      azguardClient: state.azguardClient,

      // WaaP wallet State
      waapAddress: state.waapAddress,
      isWaapConnected: state.isWaapConnected,
      waapChainId: state.waapChainId,
      waapError: state.waapError,

      // UI Actions
      setShowWalletModal: state.setShowWalletModal,
      setShowAzguardPrompt: state.setShowAzguardPrompt,

      // Aztec Actions
      setAztecLoginMethod: state.setAztecLoginMethod,
      setAztecState: state.setAztecState,
      disconnectAztecWallet: state.disconnectAztecWallet,
      executeAztecTransaction: state.executeAztecTransaction,

      // WaaP wallet Actions
      setWaapState: state.setWaapState,
      switchWaapChain: state.switchWaapChain,

      // Reset
      reset: state.reset,
    }))
  )
