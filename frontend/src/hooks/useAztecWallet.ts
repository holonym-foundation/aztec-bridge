import { useState, useEffect } from 'react'
import { sdk, connectWallet } from '../aztec'
import { useAccount as useObsidianAccount } from '@nemi-fi/wallet-sdk/react'
import { useContractStore } from '../stores/contractStore'

export function useAztecWallet() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const account = useObsidianAccount(sdk)
  const address = account?.address.toString()
  const isConnected = !!address
  
  const { setL2Contracts, resetContracts } = useContractStore()

  // Setup contracts when account is available
  useEffect(() => {
    if (account) {
      setL2Contracts(account)
    } else {
      resetContracts()
    }
  }, [account, setL2Contracts, resetContracts])

  const connect = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      const connectedAccount = await connectWallet()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      console.error('Failed to connect to Obsidian wallet:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      sdk.disconnect()
      resetContracts()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      console.error('Failed to disconnect from Obsidian wallet:', error)
    }
  }

  return {
    address,
    account,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sdk,
  }
}
