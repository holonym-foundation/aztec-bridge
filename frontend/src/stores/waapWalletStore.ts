import { l1ChainId, silkConfig } from '@/config/l1.config'
import { initSilk, SILK_METHOD } from '@silk-wallet/silk-wallet-sdk'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { WalletType, WaapLoginMethod, LOGIN_METHODS } from '@/types/wallet'
import {
  discoveredProviders,
  detectWalletByProvider,
  getEIP6963Provider,
  getEIP6963WalletIcon,
  getFallbackWalletIcon,
  getWalletProviderName,
  handleWaapError,
} from '@/stores/waapWalletHelpers'

// Add type declarations
declare global {
  interface Window {
    silk: any
  }
}



interface WaapWalletState {
  address: string
  chainId: number | null
  isConnected: boolean
  error: Error | null
  loginMethod: WaapLoginMethod | null
  walletProvider: string | null
  walletIcon: string | null
  isInitialized: boolean

  // WaaP Wallet Actions
  initializeWaapWallet: () => void
  login: () => Promise<void>
  logout: () => Promise<void>
  switchChain: (chainId: number) => Promise<void>
  getChainId: () => Promise<number>
  signMessage: (message: string) => Promise<string>
  getAccount: () => Promise<string | null>
  getLoginMethod: () => Promise<WaapLoginMethod | null>
  getWalletProvider: () => string | null
  getWalletIcon: () => string | null
  getAllAvailableWallets: () => string[]
  refreshWalletInfo: () => Promise<void>

  // Reset the store
  reset: () => void
}

const initialState = {
  address: '',
  chainId: null,
  isConnected: false,
  error: null,
  loginMethod: null,
  walletProvider: null,
  walletIcon: null,
  isInitialized: false,
}


export const requestWaapWallet = async (
  method: SILK_METHOD,
  params?: any[]
) => {
  return window.silk.request({ method, params })
}

// Export the store directly for use with getState
export const waapWalletStore = create<WaapWalletState>((set, get) => ({
  ...initialState,

  initializeWaapWallet: () => {
    const { isInitialized } = get()

    if (isInitialized) {
      // console.log('⚠️ WaaP wallet already initialized, skipping...')
      return
    }

    try {
      initSilk(silkConfig)

      const { getAccount, switchChain } = get()

      // Try to get initial account, but don't fail if it's not available
      getAccount().catch((err) => {
        console.log(
          '⚠️ Initial account check failed (this is normal if wallet is not connected):',
          err
        )
        // Don't throw here - this is expected when wallet is not connected
      })

      // Switch to mainnet
      // switchChain(1)

      // Set up event listeners
      window.silk.on('accountsChanged', async (accounts: string[]) => {
        const isConnected = accounts.length > 0
        set({ address: accounts[0], isConnected })

        // If wallet is connected, retrieve the login method
        if (isConnected) {
          const { getLoginMethod } = get()
          if (getLoginMethod) {
            await getLoginMethod()
          }
        }
      })

      window.silk.on('chainChanged', (chainId: string) => {
        const chainIdNumber = parseInt(chainId, 16)
        set({ chainId: chainIdNumber })
      })

      // Mark as initialized
      set({ isInitialized: true })
    } catch (err) {
      handleWaapError(err, 'Failed to initialize Ethereum wallet', set)
    }
  },

  login: async () => {
    try {
      const result = (await window.silk.login()) as WaapLoginMethod
      console.log('🚀MMM - ~ waapWalletStore.ts:317 ~ result:', result)

      // Check if login method is 'injected' but no wallet extension is available
      if (result === LOGIN_METHODS.INJECTED && !window.ethereum) {
        throw new Error(
          'No Ethereum wallet extension detected. Please install MetaMask or another Ethereum wallet.'
        )
      }

      // For injected wallets, force account selection if multiple wallets are available
      if (result === LOGIN_METHODS.INJECTED && window.ethereum) {
        // Check if we have multiple wallets via EIP-6963
        const hasMultipleWallets = discoveredProviders.length > 1

        // Also check for multiple wallets via window.ethereum.providers
        const hasMultipleProviders =
          Array.isArray(window.ethereum.providers) &&
          window.ethereum.providers.length > 1

        if (hasMultipleWallets || hasMultipleProviders) {
          try {
            // Force account selection popup
            await window.ethereum.request({
              method: 'wallet_requestPermissions',
              params: [{ eth_accounts: {} }],
            })
          } catch (permissionError) {
            // Some wallets might not support wallet_requestPermissions
            // This is expected and we should continue normally
          }
        }
      }

      const { getAccount, switchChain, getChainId } = get()
      const address = await getAccount()
      await switchChain(l1ChainId)
      const chainId = await getChainId()

      // Determine wallet provider based on login method
      const detectedProvider = get().getWalletProvider()
      const walletProvider = getWalletProviderName(result, detectedProvider)

      // Get wallet icon from EIP-6963 if available
      const walletIcon = getEIP6963WalletIcon(address || '')

      const state = {
        address: address || '',
        chainId,
        isConnected: !!address,
        error: null,
        loginMethod: result,
        walletProvider: walletProvider,
        walletIcon: walletIcon,
      }

      set(state)
    } catch (err: any) {
      // Provide more specific error messages based on the error type
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      if (errorMessage.includes('No Ethereum wallet extension detected')) {
        handleWaapError(
          err,
          'No Ethereum wallet extension found. Please install MetaMask or another Ethereum wallet to continue.',
          set
        )
      } else if (
        errorMessage.includes('rejected') ||
        errorMessage.includes('denied')
      ) {
        handleWaapError(
          err,
          'Ethereum wallet connection was rejected by user.',
          set
        )
      } else if (errorMessage.includes('install')) {
        handleWaapError(
          err,
          'Please install an Ethereum wallet extension to continue.',
          set
        )
      } else {
        handleWaapError(err, 'Failed to connect Ethereum wallet', set)
      }
    }
  },

  logout: async () => {
    try {
      await window.silk.logout()
      set(initialState)
    } catch (err) {
      handleWaapError(err, 'Failed to disconnect Ethereum wallet', set)
    }
  },

  switchChain: async (chainId: number) => {
    const chainIdHex = `0x${chainId.toString(16)}`
    
    try {
      await requestWaapWallet(SILK_METHOD.wallet_switchEthereumChain, [
        { chainId: chainIdHex },
      ])
      set({ chainId })
    } catch (err: any) {
      // Handle specific chain switching errors
      if (err?.code === 4902 || err?.code === -32603 || 
          (err?.message && err.message.includes('Unrecognized chain ID'))) {
        // Chain not added to wallet, try to add it
        try {
          await requestWaapWallet(SILK_METHOD.wallet_addEthereumChain, [
            {
              chainId: chainIdHex,
              chainName: chainId === 11155111 ? 'Sepolia' : `Chain ${chainId}`,
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: chainId === 11155111 ? [process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || 'https://sepolia.infura.io/'] : [],
              blockExplorerUrls: chainId === 11155111 ? ['https://sepolia.etherscan.io'] : [],
            },
          ])
          set({ chainId })
        } catch (addErr) {
          handleWaapError(addErr, 'Failed to add and switch to chain', set)
        }
      } else if (err?.code === 4001) {
        // User rejected the request
        console.log('User rejected chain switch request')
        // Don't throw error for user rejection, just log it
      } else {
        handleWaapError(err, 'Failed to switch chain', set)
      }
    }
  },

  getChainId: async () => {
    try {
      const chainId = await requestWaapWallet(SILK_METHOD.eth_chainId)
      const chainIdNumber = parseInt(chainId as string, 16)
      set({ chainId: chainIdNumber })
      return chainIdNumber
    } catch (err) {
      return handleWaapError(err, 'Failed to get chain ID', set)
    }
  },

  getAccount: async () => {
    try {
      const accounts = await requestWaapWallet(SILK_METHOD.eth_requestAccounts)
      const address = (accounts as string[])[0]

      if (!address) {
        set({ address: '', isConnected: false })
        return null
      }

      set({ address, isConnected: !!address })
      return address
    } catch (err: any) {
      console.error('❌ getAccount: Error getting account:', err)

      // Handle specific error cases gracefully
      if (err?.code === -32001) {
        console.log(
          '⚠️ getAccount: Wallet is already processing a connection request'
        )
        set({ address: '', isConnected: false, error: null })
        return null
      }

      if (err?.code === 4001) {
        console.log('⚠️ getAccount: User rejected the connection request')
        set({ address: '', isConnected: false, error: null })
        return null
      }

      // For other errors, still set disconnected state but don't throw
      console.log('⚠️ getAccount: Setting disconnected state due to error')
      set({ address: '', isConnected: false, error: null })
      return null
    }
  },

  signMessage: async (message: string) => {
    try {
      const { address } = get()
      if (!address) {
        throw new Error('No wallet connected')
      }

      const signature = await requestWaapWallet(SILK_METHOD.personal_sign, [
        message,
        address,
      ])
      return signature as string
    } catch (err) {
      return handleWaapError(
        err,
        'Failed to sign message with Ethereum wallet',
        set
      )
    }
  },

  getLoginMethod: async () => {
    try {
      if (typeof window !== 'undefined' && window.silk) {
        const loginMethod =
          (await window.silk.getLoginMethod()) as WaapLoginMethod

        // Update state with login method
        set((state) => ({
          ...state,
          loginMethod,
        }))

        return loginMethod
      }
      return null
    } catch (err) {
      return null
    }
  },

  getWalletProvider: () => {
    try {
      if (typeof window === 'undefined') return null

      // Get the current connected address to identify which wallet is active
      const { address } = get()
      if (!address) return null

      // Try EIP-6963 discovery first (most reliable)
      const eip6963Provider = getEIP6963Provider(address)
      if (eip6963Provider) {
        set({ walletProvider: eip6963Provider })
        return eip6963Provider
      }

      // Fallback to window.ethereum detection
      if (window.ethereum) {
        const walletName = detectWalletByProvider(window.ethereum)
        set({ walletProvider: walletName })
        return walletName
      }
      return null
    } catch (err) {
      console.error('Error detecting wallet provider:', err)
      return null
    }
  },

  getWalletIcon: () => {
    try {
      if (typeof window === 'undefined') return null

      // Get the current connected address to identify which wallet is active
      const { address } = get()
      if (!address) return null

      // Try EIP-6963 discovery first (most reliable)
      const eip6963Icon = getEIP6963WalletIcon(address)
      if (eip6963Icon) {
        set({ walletIcon: eip6963Icon })
        return eip6963Icon
      }

      // Fallback to default icons based on wallet provider
      const { walletProvider, loginMethod } = get()
      const walletIcon = getFallbackWalletIcon(loginMethod, walletProvider)

      set({ walletIcon })
      return walletIcon
    } catch (err) {
      console.error('Error getting wallet icon:', err)
      const fallbackIcon = '/assets/wallets/wally-dark.svg'
      set({ walletIcon: fallbackIcon })
      return fallbackIcon
    }
  },

  getAllAvailableWallets: () => {
    try {
      if (typeof window === 'undefined') {
        return []
      }

      const availableWallets: string[] = []

      // First, try EIP-6963 discovery (most reliable)
      if (discoveredProviders.length > 0) {
        for (const { info } of discoveredProviders) {
          if (!availableWallets.includes(info.name)) {
            availableWallets.push(info.name)
          }
        }
        return availableWallets
      }

      // Fallback to window.ethereum detection
      if (window.ethereum) {
        const walletName = detectWalletByProvider(window.ethereum)
        availableWallets.push(walletName)
      }

      return availableWallets
    } catch (err) {
      console.error('Error getting all available wallets:', err)
      return []
    }
  },

  refreshWalletInfo: async () => {
    try {
      const { getLoginMethod, getWalletProvider, getWalletIcon } = get()
      
      // Get login method
      await getLoginMethod()
      
      // Get wallet provider (this will update state)
      getWalletProvider()
      
      // Get wallet icon (this will update state)
      getWalletIcon()
      
      console.log('✅ Wallet info refreshed successfully')
    } catch (err) {
      console.error('❌ Error refreshing wallet info:', err)
    }
  },

  reset: () => set(initialState),
}))

// Export the hook for use in components
export const useWaapWalletStore = () =>
  waapWalletStore(
    useShallow((state) => ({
      // WaaP Wallet State
      address: state.address,
      chainId: state.chainId,
      isConnected: state.isConnected,
      error: state.error,
      loginMethod: state.loginMethod,
      walletProvider: state.walletProvider,
      walletIcon: state.walletIcon,

      // Actions
      initializeWaapWallet: state.initializeWaapWallet,
      login: state.login,
      logout: state.logout,
      switchChain: state.switchChain,
      getChainId: state.getChainId,
      signMessage: state.signMessage,
      getAccount: state.getAccount,
      getLoginMethod: state.getLoginMethod,
      getWalletProvider: state.getWalletProvider,
      getWalletIcon: state.getWalletIcon,
      getAllAvailableWallets: state.getAllAvailableWallets,
      refreshWalletInfo: state.refreshWalletInfo,
      reset: state.reset,
    }))
  )
