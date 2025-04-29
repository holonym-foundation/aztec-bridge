import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'

export function useMetaMask() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  const connectWallet = async () => {
    try {
      await connect({ connector: injected() })
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

  return {
    address,
    isConnected,
    connect: connectWallet,
    disconnect,
  }
} 