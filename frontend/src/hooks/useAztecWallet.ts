import { useState, useEffect } from 'react'
import { sdk, connectWallet } from '../aztec'
import { useAccount as useAztecAccount } from '@nemi-fi/wallet-sdk/react'
import { useContractStore } from '../stores/contractStore'
import { AztecWalletType } from '@/types/wallet'
import { AzguardClient } from '@azguardwallet/client'
import { useWalletStore } from '@/stores/walletStore'
// import {
//   TokenContract,
//   TokenContractArtifact,
// } from '../constants/aztec/artifacts/Token'

declare global {
  interface Window {
    azguard?: any
  }
}

export function useAztecWallet() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [azguardClient, setAzguardClient] = useState<AzguardClient | null>(null)
  const account = useAztecAccount(sdk)
  const address = account?.address.toString()
  const isConnected = !!address

  const { setL2Contracts, resetContracts } = useContractStore()
  const { aztecWalletType, setAztecWalletType } = useWalletStore()

  // Setup contracts when account is available
  useEffect(() => {
    if (account) {
      setL2Contracts(account)
    } else {
      resetContracts()
    }
  }, [account, setL2Contracts, resetContracts])

  const connect = async (type: AztecWalletType) => {
    setIsConnecting(true)
    setError(null)
    setAztecWalletType(type)

    try {
      if (type === 'obsidion') {
        const connectedAccount = await connectWallet('obsidion')
        return connectedAccount
      } else if (type === 'azguard') {
        const connectedAccount = await connectWallet('azguard')
        return connectedAccount

        // // Check if Azguard extension is installed
        // if (!AzguardClient.isAzguardInstalled()) {
        //   throw new Error('Azguard wallet extension not found')
        // }

        // // Create Azguard client
        // const azguardWallet = await AzguardClient.create()

        // if (!azguardWallet.connected) {
        //   // if (true) {
        //   // Connect to Azguard wallet
        //   console.log('Connecting to Azguard wallet')
        //   await azguardWallet.connect(
        //     {
        //       name: 'Bridge to Aztec ',
        //     },
        //     [
        //       {
        //         chains: ['aztec:11155111'], // aztec testnet
        //         methods: [
        //           'send_transaction',
        //           'add_private_authwit',
        //           'simulate_views',
        //           'call',
        //           'register_contract',
        //         ],
        //       },
        //     ]
        //   )
        // }

        // const account = azguardWallet.accounts[0]
        // const address = account.substring(account.lastIndexOf(':') + 1)

        // setAzguardClient(azguardWallet)
        // console.log('Getting balances using azguard')

        // const [resultRegisterContract, redultSimulateViews] =
        //   await azguardWallet.execute([
        //     {
        //       kind: 'register_contract',
        //       chain: 'aztec:11155111',
        //       address:
        //         '0x2ab7cf582347c8a2834e0faf98339372118275997e14c5a77054bb345362e878',
        //       artifact: TokenContractArtifact,
        //     },
        //     {
        //       kind: 'simulate_views',
        //       account: account,
        //       calls: [
        //         {
        //           kind: 'call',
        //           contract:
        //             '0x2ab7cf582347c8a2834e0faf98339372118275997e14c5a77054bb345362e878',
        //           method: 'balance_of_public',
        //           args: [address],
        //         },
        //         {
        //           kind: 'call',
        //           contract:
        //             '0x2ab7cf582347c8a2834e0faf98339372118275997e14c5a77054bb345362e878',
        //           method: 'balance_of_private',
        //           args: [address],
        //         },
        //       ],
        //     },
        //   ])

        // console.log('resultRegisterContract ', resultRegisterContract)
        // console.log('redultSimulateViews ', redultSimulateViews)

        // // // ensure successful status
        // // if (result.status !== 'ok') {
        // //   console.log('result ', result)
        // //   throw new Error('Simulation failed')
        // // }

        // // console.log('result ', result)
        // // if (result?.result) {
        // //   // simulation results are in the same order as the calls above
        // //   const [publicBalance, privateBalance] = (result.result as any)
        // //     ?.decoded

        // //   console.log('Public balance', publicBalance)
        // //   console.log('Private balance', privateBalance)

        // //   console.log('Balances fetched using azguard')
        // // }

        // return azguardWallet
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      console.error(`Failed to connect to ${type} wallet:`, error)
      throw error
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    try {
      await sdk.disconnect()
      setAzguardClient(null)
      resetContracts()
      setAztecWalletType(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      console.error(
        `Failed to disconnect from ${aztecWalletType} wallet:`,
        error
      )
    }
  }

  const executeTransaction = async (actions: any[]) => {
    if (aztecWalletType === 'azguard' && azguardClient) {
      const results = await azguardClient.execute(actions)
      if (results.length > 0 && results[0].status === 'success') {
        return results[0].txHash
      } else {
        throw new Error(
          `Transaction failed: ${results[0]?.error || 'Unknown error'}`
        )
      }
    } else {
      throw new Error(
        'Transaction execution not supported for this wallet type'
      )
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
    aztecWalletType,
    azguardClient,
    executeTransaction,
  }
}
