import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { WalletType } from '@/types/wallet'

interface WalletState {
  showWalletModal: boolean
  showAzguardPrompt: boolean
  showMetaMaskPrompt: boolean
  setShowWalletModal: (show: boolean) => void
  setShowAzguardPrompt: (show: boolean) => void
  setShowMetaMaskPrompt: (show: boolean) => void
  handleWalletSelect: (type: WalletType) => Promise<void>
  reset: () => void
}

const initialState = {
  showWalletModal: false,
  showAzguardPrompt: false,
  showMetaMaskPrompt: false,
}

const walletStore = create<WalletState>((set) => ({
  ...initialState,
  setShowWalletModal: (show) => set({ showWalletModal: show }),
  setShowAzguardPrompt: (show) => set({ showAzguardPrompt: show }),
  setShowMetaMaskPrompt: (show) => set({ showMetaMaskPrompt: show }),
  handleWalletSelect: async (type: WalletType) => {
    try {
      if (type === 'azguard' && !window.azguard) {
        set({ showAzguardPrompt: true, showWalletModal: false })
        return
      }
      // Note: The actual connection logic should be handled by the component
      // that uses this store, as it needs access to the wallet hooks
      set({ showWalletModal: false })
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  },
  reset: () => set(initialState),
}))

// Export main store with all state and actions
export const useWalletStore = () =>
  walletStore(
    useShallow((state) => ({
      showWalletModal: state.showWalletModal,
      showAzguardPrompt: state.showAzguardPrompt,
      showMetaMaskPrompt: state.showMetaMaskPrompt,
      setShowWalletModal: state.setShowWalletModal,
      setShowAzguardPrompt: state.setShowAzguardPrompt,
      setShowMetaMaskPrompt: state.setShowMetaMaskPrompt,
      handleWalletSelect: state.handleWalletSelect,
      reset: state.reset,
    }))
  ) 