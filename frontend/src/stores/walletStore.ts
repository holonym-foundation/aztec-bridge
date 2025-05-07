import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { AztecWalletType } from '@/types/wallet'

// Constants for localStorage keys
const AZTEC_WALLET_KEY = 'aztecWalletType'

interface WalletState {
  showWalletModal: boolean
  showAzguardPrompt: boolean
  showMetaMaskPrompt: boolean
  aztecWalletType: AztecWalletType | null
  setShowWalletModal: (show: boolean) => void
  setShowAzguardPrompt: (show: boolean) => void
  setShowMetaMaskPrompt: (show: boolean) => void
  setAztecWalletType: (type: AztecWalletType | null) => void
  handleWalletSelect: (type: AztecWalletType) => Promise<void>
  reset: () => void
}

// Helper function to get initial wallet type from localStorage
const getInitialWalletType = (): AztecWalletType | null => {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(AZTEC_WALLET_KEY)
  return stored ? (stored as AztecWalletType) : null
}

const initialState = {
  showWalletModal: false,
  showAzguardPrompt: false,
  showMetaMaskPrompt: false,
  aztecWalletType: getInitialWalletType(),
}

const walletStore = create<WalletState>((set) => ({
  ...initialState,
  setShowWalletModal: (show) => set({ showWalletModal: show }),
  setShowAzguardPrompt: (show) => set({ showAzguardPrompt: show }),
  setShowMetaMaskPrompt: (show) => set({ showMetaMaskPrompt: show }),
  setAztecWalletType: (type) => {
    if (type) {
      localStorage.setItem(AZTEC_WALLET_KEY, type)
    } else {
      localStorage.removeItem(AZTEC_WALLET_KEY)
    }
    set({ aztecWalletType: type })
  },
  handleWalletSelect: async (type: AztecWalletType) => {
    try {
      if (type === 'azguard' && !window.azguard) {
        set({ showAzguardPrompt: true, showWalletModal: false })
        return
      }
      // Note: The actual connection logic should be handled by the component
      // that uses this store, as it needs access to the wallet hooks
      localStorage.setItem(AZTEC_WALLET_KEY, type)
      set({ showWalletModal: false, aztecWalletType: type })
    } catch (error) {
      console.error('Failed to connect wallet:', error)
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
      showWalletModal: state.showWalletModal,
      showAzguardPrompt: state.showAzguardPrompt,
      showMetaMaskPrompt: state.showMetaMaskPrompt,
      aztecWalletType: state.aztecWalletType,
      setShowWalletModal: state.setShowWalletModal,
      setShowAzguardPrompt: state.setShowAzguardPrompt,
      setShowMetaMaskPrompt: state.setShowMetaMaskPrompt,
      setAztecWalletType: state.setAztecWalletType,
      handleWalletSelect: state.handleWalletSelect,
      reset: state.reset,
    }))
  ) 