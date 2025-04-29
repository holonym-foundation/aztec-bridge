import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { sepolia } from 'wagmi/chains'
import { useEffect } from 'react'

export function useMetaMask() {
  const { address, isConnected,chainId ,...rest } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  // Check if we need to switch networks
  useEffect(() => {
    if (isConnected && chainId && chainId !== sepolia.id) {
      console.log(`Current network: ${chainId}, switching to Sepolia`)
      switchChain({ chainId: sepolia.id })
    }
  }, [isConnected, chainId, switchChain])

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
    chainId,
  }
} 