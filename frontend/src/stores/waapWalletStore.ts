import { l1ChainId, silkConfig } from '@/config/l1.config'
import { initSilk, SILK_METHOD } from '@silk-wallet/silk-wallet-sdk'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { WalletType, WaapLoginMethod, LOGIN_METHODS } from '@/types/wallet'

// Add type declarations
declare global {
  interface Window {
    silk: any
  }
}

// EIP-6963 types
interface EIP6963ProviderInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}

interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo
  provider: any
}

// EIP-6963 provider discovery
let discoveredProviders: EIP6963ProviderDetail[] = []

// Listen for EIP-6963 provider announcements
if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', (event: any) => {
    discoveredProviders.push(event.detail)
    // console.log('🔍 EIP-6963: Wallet announced:', {
    //   name: event.detail.info.name,
    //   rdns: event.detail.info.rdns,
    //   uuid: event.detail.info.uuid,
    //   icon: event.detail.info.icon,
    //   provider: event.detail.provider
    // })
    // console.log('📊 Total discovered providers:', discoveredProviders.length)
  })

  // Request providers to announce themselves (with delay to handle conflicts)
  setTimeout(() => {
    window.dispatchEvent(new Event('eip6963:requestProvider'))
  }, 1000)
  
  // Also send immediately in case some wallets are ready
  window.dispatchEvent(new Event('eip6963:requestProvider'))
  
  // Log initial state
  // console.log('🔍 Initial window.ethereum state:', {
  //   exists: !!window.ethereum,
  //   isArray: Array.isArray(window.ethereum),
  //   isMetaMask: window.ethereum?.isMetaMask,
  //   isRabby: window.ethereum?.isRabby,
  //   isBraveWallet: window.ethereum?.isBraveWallet,
  //   isCoinbaseWallet: window.ethereum?.isCoinbaseWallet,
  //   selectedAddress: window.ethereum?.selectedAddress,
  //   providers: window.ethereum?.providers
  // })
  
  // // Log the error we're seeing
  // console.log('⚠️ Multiple wallet conflict detected! This is why we need EIP-6963!')
  // console.log('🔍 Current window.ethereum is likely controlled by:', 
  //   window.ethereum?.isRabby ? 'Rabby' : 
  //   window.ethereum?.isMetaMask ? 'MetaMask' : 
  //   window.ethereum?.isBraveWallet ? 'Brave Wallet' : 
  //   'Unknown wallet'
  // )
}

// Helper function to detect wallet by provider properties
const detectWalletByProvider = (provider: any): string => {
  if (!provider) return 'Injected Wallet'

  // Check for MetaMask (most common)
  if (provider.isMetaMask && !provider.isBraveWallet && !provider.isRabby) {
    return 'MetaMask'
  }

  // Check for Coinbase Wallet
  if (provider.isCoinbaseWallet) {
    return 'Coinbase Wallet'
  }

  // Check for Rabby (can override MetaMask)
  if (provider.isRabby) {
    return 'Rabby'
  }

  // Check for Brave Wallet (can override MetaMask)
  if (provider.isBraveWallet) {
    return 'Brave Wallet'
  }

  // Check for Trust Wallet
  if (provider.isTrust) {
    return 'Trust Wallet'
  }

  // Check for Opera Wallet
  if (provider.isOpera) {
    return 'Opera Wallet'
  }

  // Check for Rainbow Wallet
  if (provider.isRainbow) {
    return 'Rainbow Wallet'
  }

  // Check for Phantom (if it has Ethereum support)
  if (provider.isPhantom) {
    return 'Phantom'
  }

  // Check for other common wallets
  if (provider.isFrame) {
    return 'Frame'
  }

  if (provider.isTally) {
    return 'Tally'
  }

  if (provider.isTokenPocket) {
    return 'TokenPocket'
  }

  // Check for wallet name in provider info
  if (provider.providerInfo?.name) {
    return provider.providerInfo.name
  }

  return 'Injected Wallet'
}

// Helper function to get provider via EIP-6963
const getEIP6963Provider = (address: string): string | null => {
  if (!address || discoveredProviders.length === 0) {
    console.log('⚠️ EIP-6963: No address or no providers found')
    return null
  }

  // Log all discovered providers
  // discoveredProviders.forEach(({ info, provider }, index) => {
  //   console.log(`🔍 EIP-6963 Provider ${index + 1}:`, {
  //     name: info.name,
  //     rdns: info.rdns,
  //     selectedAddress: provider.selectedAddress,
  //     isConnected: provider.isConnected,
  //     matches: provider.selectedAddress === address
  //   })
  // })

  // Find provider that has the connected address
  for (const { info, provider } of discoveredProviders) {
    if (provider.selectedAddress === address) {
      return info.name
    }
  }

  // If no exact match, return the first available provider
  if (discoveredProviders.length > 0) {
    return discoveredProviders[0].info.name
  }

  return null
}

// Helper function to get wallet icon via EIP-6963
const getEIP6963WalletIcon = (address: string): string | null => {
  if (!address || discoveredProviders.length === 0) {
    return null
  }

  // Find provider that has the connected address
  for (const { info, provider } of discoveredProviders) {
    if (provider.selectedAddress === address) {
      return info.icon
    }
  }

  // If no exact match, return the first available provider's icon
  if (discoveredProviders.length > 0) {
    return discoveredProviders[0].info.icon
  }

  return null
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

// Utility functions for common operations
const handleError = (err: unknown, message: string, set: any) => {
  // console.error(message, err)
  const error = err instanceof Error ? err : new Error(String(err))
  set({ error })
  throw error
}

// Utility function to determine wallet provider based on login method
export const getWalletProviderName = (loginMethod: WaapLoginMethod | null, injectedProvider: string | null): string => {
  if (!loginMethod) return 'Unknown'
  
  switch (loginMethod) {
    case LOGIN_METHODS.WAAP:
      return 'Wallet as a Protocol'
    case LOGIN_METHODS.WALLETCONNECT:
      return 'WalletConnect'
    case LOGIN_METHODS.INJECTED:
      return injectedProvider || 'Injected Wallet'
    default:
      return 'Unknown'
  }
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
        console.log('⚠️ Initial account check failed (this is normal if wallet is not connected):', err)
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
      handleError(err, 'Failed to initialize Ethereum wallet', set)
    }
  },

  login: async () => {
    try {
      const result = await window.silk.login() as WaapLoginMethod
      console.log('🚀MMM - ~ waapWalletStore.ts:317 ~ result:', result)
      
      // Check if login method is 'injected' but no wallet extension is available
      if (result === LOGIN_METHODS.INJECTED && !window.ethereum) {
        throw new Error('No Ethereum wallet extension detected. Please install MetaMask or another Ethereum wallet.')
      }
      
      // For injected wallets, force account selection if multiple wallets are available
      if (result === LOGIN_METHODS.INJECTED && window.ethereum) {
        // Check if we have multiple wallets via EIP-6963
        const hasMultipleWallets = discoveredProviders.length > 1
        
        // Also check for multiple wallets via window.ethereum.providers
        const hasMultipleProviders = Array.isArray(window.ethereum.providers) && window.ethereum.providers.length > 1
        
        if (hasMultipleWallets || hasMultipleProviders) {
          try {
            // Force account selection popup
            await window.ethereum.request({ 
              method: 'wallet_requestPermissions', 
              params: [{ eth_accounts: {} }] 
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
        handleError(err, 'No Ethereum wallet extension found. Please install MetaMask or another Ethereum wallet to continue.', set)
      } else if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
        handleError(err, 'Ethereum wallet connection was rejected by user.', set)
      } else if (errorMessage.includes('install')) {
        handleError(err, 'Please install an Ethereum wallet extension to continue.', set)
      } else {
        handleError(err, 'Failed to connect Ethereum wallet', set)
      }
    }
  },

  logout: async () => {
    try {
      await window.silk.logout()
      set(initialState)
    } catch (err) {
      handleError(err, 'Failed to disconnect Ethereum wallet', set)
    }
  },

  switchChain: async (chainId: number) => {
    try {
      const chainIdHex = `0x${chainId.toString(16)}`
      await requestWaapWallet(SILK_METHOD.wallet_switchEthereumChain, [
        { chainId: chainIdHex },
      ])
      set({ chainId })
    } catch (err) {
      handleError(err, 'Failed to switch chain', set)
    }
  },

  getChainId: async () => {
    try {
      const chainId = await requestWaapWallet(SILK_METHOD.eth_chainId)
      const chainIdNumber = parseInt(chainId as string, 16)
      set({ chainId: chainIdNumber })
      return chainIdNumber
    } catch (err) {
      return handleError(err, 'Failed to get chain ID', set)
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
        console.log('⚠️ getAccount: Wallet is already processing a connection request')
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
      return handleError(err, 'Failed to sign message with Ethereum wallet', set)
    }
  },

  getLoginMethod: async () => {
    try {
      if (typeof window !== 'undefined' && window.silk) {
        const loginMethod = await window.silk.getLoginMethod() as WaapLoginMethod
        
        // Determine wallet provider based on login method
        const detectedProvider = get().getWalletProvider()
        const walletProvider = getWalletProviderName(loginMethod, detectedProvider)
        
        // Update state with wallet provider
        set((state) => ({
          ...state,
          loginMethod,
          walletProvider,
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
        return eip6963Provider
      }

      // Fallback to window.ethereum detection
      if (window.ethereum) {
        const walletName = detectWalletByProvider(window.ethereum)
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
        return eip6963Icon
      }

      // Fallback to default icons based on wallet provider
      const { walletProvider, loginMethod } = get()
      if (loginMethod === LOGIN_METHODS.WALLETCONNECT) {
        return '/assets/wallets/wallet-connect-logo.svg'
      }
      
      if (loginMethod === LOGIN_METHODS.WAAP) {
        return '/assets/wallets/wally-dark.svg' // WaaP/Human wallet logo
      }
      
      if (walletProvider) {
        const providerLower = walletProvider.toLowerCase()
        if (providerLower.includes('metamask')) {
          return '/assets/wallets/metamask-logo.svg'
        } else if (providerLower.includes('rabby')) {
          return '/assets/wallets/rabby-wallet.svg' // Rabby wallet logo
        } else if (providerLower.includes('coinbase')) {
          return '/assets/wallets/metamask-logo.svg' // Fallback to MetaMask icon
        } else if (providerLower.includes('brave')) {
          return '/assets/wallets/metamask-logo.svg' // Fallback to MetaMask icon
        }
      }

      // Default fallback
      return '/assets/svg/silk-logo.svg'
    } catch (err) {
      console.error('Error getting wallet icon:', err)
      return '/assets/wallets/wally-dark.svg'
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
      reset: state.reset,
    }))
  )

