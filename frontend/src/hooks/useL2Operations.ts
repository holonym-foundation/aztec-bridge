import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { ADDRESS } from '@/config'
import { TestERC20Abi } from '@aztec/l1-artifacts'
import { useAztecWallet } from './useAztecWallet'
import { TokenContract } from '../constants/aztec/artifacts/Token'
import {
  AztecAddress,
  EthAddress,
  Fr,
  L1TokenPortalManager,
  readFieldCompressedString,
} from '@aztec/aztec.js'
import { useContractStore } from '@/stores/contractStore'
import { formatUnits, parseUnits } from 'viem'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast, useToastQuery, useToastMutation } from './useToast'
import { IntentAction } from '@nemi-fi/wallet-sdk'
import { logger } from '@/utils/logger'
import { wait } from '@/utils'
import { toast } from 'react-toastify'
import { datadogLogs } from '@datadog/browser-logs'
import { logInfo, logError } from '@/utils/datadog'

// Define types for balance queries
export interface L2TokenBalanceData {
  publicBalance: string
  privateBalance: string
}

export const useL2NativeBalance = () => {
  const { account: aztecAccount, address, isConnected } = useAztecWallet()

  const queryKey = ['l2NativeBalance', address]
  const queryFn = async () => {
    return 0
  }

  return useQuery({
    queryKey,
    queryFn,
    enabled: !!isConnected,
  })
}

// -----------------------------------

export const useL2TokenBalance = () => {
  const {
    account: aztecAccount,
    address: aztecAddress,
    isConnected,
  } = useAztecWallet()
  const { l2TokenContract, l2TokenMetadata } = useContractStore()

  // Create a stable query key that doesn't change with renders
  const queryKey = ['l2TokenBalance', aztecAddress]

  // Query function without tracking state
  const queryFn = async (): Promise<L2TokenBalanceData> => {
    try {
      if (!l2TokenContract) {
        throw new Error('L2 token contract not found')
      }
      if (!aztecAddress) {
        throw new Error('Aztec address not found')
      }
      if (!l2TokenMetadata) {
        throw new Error('L2 token metadata not found')
      }

      console.log('Fetching L2 balances...')

      const [privateBalance, publicBalance] = await Promise.all([
        l2TokenContract.methods
          .balance_of_private(AztecAddress.fromString(aztecAddress))
          .simulate(),
        l2TokenContract.methods
          .balance_of_public(AztecAddress.fromString(aztecAddress))
          .simulate(),
      ])

      const publicBalanceFormat = formatUnits(
        publicBalance as bigint,
        l2TokenMetadata.decimals
      )
      const privateBalanceFormat = formatUnits(
        privateBalance as bigint,
        l2TokenMetadata.decimals
      )

      console.log('publicBalanceFormat: ', publicBalanceFormat)
      console.log('privateBalanceFormat: ', privateBalanceFormat)

      return {
        publicBalance: publicBalanceFormat,
        privateBalance: privateBalanceFormat,
      }
    } catch (error) {
      console.log('Error fetching L2 token balance:', error)
      return {
        publicBalance: '0',
        privateBalance: '0',
      }
    }
  }

  // Use regular React Query instead of toast query
  return useQuery<L2TokenBalanceData, Error>({
    queryKey,
    queryFn,
    enabled: !!aztecAddress && !!l2TokenContract && !!l2TokenMetadata,
    meta: {
      persist: true, // Mark this query for persistence
    },
  })
}

export function useL1ContractAddresses() {
  const { account: aztecAccount, isConnected } = useAztecWallet()

  const queryKey = ['l1ContractAddresses']
  const queryFn = async () => {
    if (!aztecAccount?.aztecNode) return null
    return await aztecAccount.aztecNode.getL1ContractAddresses()
  }
  return useQuery({
    queryKey,
    queryFn,
    enabled: isConnected,
  })
}
// -----------------------------------

export function useL2TokenInfo() {
  const { account: aztecAccount, isConnected } = useAztecWallet()

  const queryKey = ['l2TokenInfo']
  const queryFn = async () => {}

  return useQuery({
    queryKey,
    queryFn,
    enabled: isConnected,
  })
}

// -----------------------------------

export function useL2WithdrawTokensToL1(onBridgeSuccess?: (data: any) => void) {
  const { address: l1Address } = useAccount()
  const { account: aztecAccount, address: aztecAddress } = useAztecWallet()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const queryClient = useQueryClient()
  const toastIdRef = useRef<string | number | null>(null)
  const notify = useToast()

  const { l1ContractAddresses, l2TokenContract, l2BridgeContract } =
    useContractStore()

  const getL1PortalManager = useCallback(() => {
    if (
      !publicClient ||
      !walletClient ||
      !l1ContractAddresses?.outboxAddress.toString()
    ) {
      console.log('Missing required dependencies for L1 portal manager')
      return null
    }

    const manager = new L1TokenPortalManager(
      EthAddress.fromString(ADDRESS[11155111].L1.PORTAL_CONTRACT),
      EthAddress.fromString(ADDRESS[11155111].L1.TOKEN_CONTRACT),
      EthAddress.fromString(ADDRESS[11155111].L1.FEE_ASSET_HANDLER_CONTRACT),
      EthAddress.fromString(l1ContractAddresses?.outboxAddress.toString()),
      // @ts-ignore
      publicClient,
      walletClient,
      logger
    )

    return manager
  }, [publicClient, walletClient, l1ContractAddresses])

  const mutationFn = async (amount: bigint) => {
    // For tracking toast progress
    let progressInterval: NodeJS.Timeout | null = null

    try {
      if (!l1Address || !aztecAddress || !aztecAccount?.aztecNode) {
        throw new Error('Required accounts not connected')
      }

      if (!l2BridgeContract) {
        throw new Error('L2 bridge contract not connected')
      }
      if (!l2TokenContract) {
        throw new Error('L2 token contract not connected')
      }

      // Log withdrawal initiation with enhanced data
      logInfo('Withdrawal from L2 to L1 initiated', {
        direction: 'L2_TO_L1',
        fromNetwork: 'Aztec',
        toNetwork: 'Ethereum',
        fromToken: 'USDC',
        toToken: 'USDC',
        amount: amount.toString(),
        l1Address: l1Address,
        l2Address: aztecAddress,
      })

      // Create initial toast notification
      toastIdRef.current = toast('Preparing withdrawal process...', {
        progress: 0.1,
        closeButton: false,
        autoClose: false,
      })

      const manager = getL1PortalManager()
      if (!manager) {
        throw new Error('Failed to create L1 portal manager')
      }

      console.log('Generating nonce for withdrawal...')
      const isPrivate = true
      const withAuthWitness = true
      const nonce = Fr.random()

      // Update toast progress
      if (toastIdRef.current !== null) {
        toast.update(toastIdRef.current, {
          progress: 0.2,
          render: 'Setting up authorization for withdrawal...',
        })
      }

      console.log('Setting up authorization...')
      // let authwitRequests: IntentAction[] | undefined = undefined
      // if (withAuthWitness) {
      //   authwitRequests = [
      //     {
      //       caller: l2BridgeContract.address,
      //       action: await l2TokenContract.methods
      //         .burn_public(
      //           AztecAddress.fromString(aztecAccount.address.toString()),
      //           amount,
      //           nonce
      //         )
      //         .request(),
      //     },
      //   ]
      // }
      // console.log('authwitRequests: ', authwitRequests)

      // Give approval to bridge to burn owner's funds:
      const authwit = await aztecAccount.setPublicAuthWit(
        {
          caller: l2BridgeContract.address,
          action: await l2TokenContract.methods
            .burn_public(
              AztecAddress.fromString(aztecAccount.address.toString()),
              amount,
              nonce
            )
            .request(),
        },
        true
      )

      // Create a progress simulation for the waiting period
      let simulatedProgressAuth = 0.25
      progressInterval = setInterval(() => {
        // Increment progress smoothly from 25% to 90%
        if (simulatedProgressAuth < 0.9) {
          simulatedProgressAuth += 0.01

          if (toastIdRef.current !== null) {
            toast.update(toastIdRef.current, {
              progress: simulatedProgressAuth,
              render: `Setting up authorization for withdrawal... ${Math.round(
                simulatedProgressAuth * 100
              )}%`,
            })
          }
        }
      }, 2000) // Update every half second

      await authwit.send().wait({ timeout: 120000 })

      // Update toast progress
      if (toastIdRef.current !== null) {
        toast.update(toastIdRef.current, {
          progress: 0.4,
          render: 'Preparing withdrawal message...',
        })
      }

      console.log('Getting L2 to L1 message...')
      const l2ToL1Message = await manager.getL2ToL1MessageLeaf(
        amount,
        EthAddress.fromString(l1Address),
        l2BridgeContract.address,
        EthAddress.ZERO
      )
      console.log('Retrieved L2 to L1 message: ', l2ToL1Message.toString())

      // notify('info', `L2 to L1 message retrieved: ${l2ToL1Message.toString()}`)

      // Update toast progress
      if (toastIdRef.current !== null) {
        toast.update(toastIdRef.current, {
          progress: 0.5,
          render: 'Initiating exit transaction on Aztec...',
        })
      }

      // Create a progress simulation for the transaction wait
      let simulatedProgress = 0.5
      progressInterval = setInterval(() => {
        // Increment progress smoothly from 50% to 70%
        if (simulatedProgress < 0.7) {
          simulatedProgress += 0.005

          if (toastIdRef.current !== null) {
            toast.update(toastIdRef.current, {
              progress: simulatedProgress,
              render: `Processing Aztec transaction... ${Math.round(
                simulatedProgress * 100
              )}%`,
            })
          }
        }
      }, 1000)

      console.log('Initiating exit to L1...')
      notify('info', `Initiating exit to L1...`)

      const l2TxReceipt = await l2BridgeContract.methods
        .exit_to_l1_public(
          EthAddress.fromString(l1Address),
          amount,
          EthAddress.ZERO,
          nonce
          // { authWitnesses: authwitRequests }
        )
        .send()
        .wait({
          timeout: 200000,
        })

      // Clear the interval and update progress
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }

      // Update progress to show completion of Aztec transaction
      if (toastIdRef.current !== null) {
        toast.update(toastIdRef.current, {
          progress: 0.7,
          render:
            'Aztec transaction confirmed! Preparing Ethereum withdrawal...',
        })
      }

      console.log('Exit to L1 transaction completed', {
        txReceipt: l2TxReceipt,
      })

      // Update toast progress
      if (toastIdRef.current !== null) {
        toast.update(toastIdRef.current, {
          progress: 0.8,
          render: 'Getting proof for Ethereum withdrawal...',
        })
      }

      console.log('Getting L2 to L1 message membership witness...')
      const [l2ToL1MessageIndex, siblingPath] =
        await aztecAccount?.aztecNode.getL2ToL1MessageMembershipWitness(
          Number(l2TxReceipt.blockNumber!),
          l2ToL1Message
        )
      console.log('Retrieved membership witness', {
        messageIndex: l2ToL1MessageIndex,
        siblingPath: siblingPath.toString(),
      })

      // Update toast progress
      if (toastIdRef.current !== null) {
        toast.update(toastIdRef.current, {
          progress: 0.9,
          render: 'Waiting for L1 confirmation (40 minutes)...',
        })
        // Close this toast after a short delay
        setTimeout(() => {
          toast.dismiss(toastIdRef.current as number | string)
          toastIdRef.current = null
        }, 2000)
      }

      // Create a new toast for the 40-minute wait
      const waitToastId = toast('Waiting for L1 confirmation...', {
        progress: 0,
        autoClose: false,
        closeButton: false,
      })

      // Start the 40-minute wait progress
      const waitTime = 40 * 60 * 1000 // 40 minutes in milliseconds
      const startTime = Date.now()
      const endTime = startTime + waitTime

      // Update progress every 30 seconds
      progressInterval = setInterval(() => {
        const currentTime = Date.now()
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / waitTime, 0.99) // Progress from 0% to 99%

        const minutesRemaining = Math.ceil(
          (endTime - currentTime) / (60 * 1000)
        )
        toast.update(waitToastId, {
          progress,
          render: `Waiting for L1 confirmation (${minutesRemaining} minutes remaining)...`,
        })
      }, 30000) // Update every 30 seconds

      // Wait for the full 40 minutes
      await new Promise((resolve) => setTimeout(resolve, waitTime))
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }

      // Show completion message
      toast.update(waitToastId, {
        progress: 1,
        render: '✅ L1 confirmation complete!',
        autoClose: 10000, // 10 seconds
      })

      // Create a new toast for the next steps
      const nextStepsToastId = toast('Proceeding with withdrawal...', {
        progress: 0,
        autoClose: false,
        closeButton: false,
      })

      await wait(5000)
      console.log('Initiating withdrawal on L1...')

      // Update toast progress
      toast.update(nextStepsToastId, {
        progress: 0.2,
        render: 'Initiating withdrawal on L1...',
      })

      // we need to wait for 20 to 40 minutes for the transaction to be confirmed on L1
      await manager.withdrawFunds(
        amount,
        EthAddress.fromString(l1Address),
        BigInt(l2TxReceipt.blockNumber!),
        l2ToL1MessageIndex,
        siblingPath
      )

      // Update toast to show completion
      toast.update(nextStepsToastId, {
        progress: 1,
        render: '✅ Withdrawal complete!',
        autoClose: 10000, // 10 seconds
      })

      // Clean up all toasts
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current)
      }
      if (waitToastId) {
        toast.dismiss(waitToastId)
      }
      toast.dismiss(nextStepsToastId)

      console.log('Withdrawal completed successfully')

      const txHash = l2TxReceipt.txHash.toString()
      console.log('txHash ', txHash)

      // Create an Aztecscan URL for the transaction
      const aztecscanUrl = `https://aztecscan.xyz/tx-effects/${txHash}`
      console.log('View transaction on Aztecscan:', aztecscanUrl)

      // Show a notification with the transaction link info
      setTimeout(() => {
        toast.info(`View withdrawal transaction on Aztecscan`, {
          onClick: () => {
            window.open(aztecscanUrl, '_blank')
          },
          autoClose: 10000,
          closeOnClick: false,
          style: { cursor: 'pointer' },
        })
      }, 1000)

      // Log successful withdrawal with enhanced data
      logInfo('Withdrawal from L2 to L1 completed', {
        direction: 'L2_TO_L1',
        fromNetwork: 'Aztec',
        toNetwork: 'Ethereum',
        fromToken: 'USDC',
        toToken: 'USDC',
        amount: amount.toString(),
        l1Address: l1Address,
        l2Address: aztecAddress?.toString(),
        txHash: txHash,
        aztecscanUrl,
      })

      console.log(
        'All done. Completing withdrawal with transaction hash:',
        txHash
      )
      // toast.dismiss(toastIdRef.current as string | number)

      return txHash
    } catch (error) {
      // Clean up any intervals
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }

      // Clean up any pending toast on error
      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current as number | string)
        toastIdRef.current = null
      }

      // Log withdrawal failure with enhanced data
      logError('Withdrawal from L2 to L1 failed', {
        direction: 'L2_TO_L1',
        fromNetwork: 'Aztec',
        toNetwork: 'Ethereum',
        fromToken: 'USDC',
        toToken: 'USDC',
        amount: amount.toString(),
        l1Address: l1Address,
        l2Address: aztecAddress?.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  return useToastMutation({
    mutationFn,
    onSuccess: (txHash) => {
      // Refresh balances
      queryClient.invalidateQueries({ queryKey: ['l1TokenBalance', l1Address] })
      queryClient.invalidateQueries({
        queryKey: ['l2TokenBalance', aztecAddress],
      })

      // Log successful withdrawal completion with enhanced data
      logInfo('Withdrawal from L2 to L1 callback', {
        direction: 'L2_TO_L1',
        fromNetwork: 'Aztec',
        toNetwork: 'Ethereum',
        fromToken: 'USDC',
        toToken: 'USDC',
        l1Address: l1Address,
        l2Address: aztecAddress?.toString(),
        txHash: typeof txHash === 'string' ? txHash : 'completed',
      })

      if (onBridgeSuccess) {
        onBridgeSuccess(txHash)
      }
    },
    toastMessages: {
      pending: 'Withdrawing tokens to L1...',
      success: 'Tokens successfully withdrawn to L1!',
      error: 'Failed to withdraw tokens',
    },
  })
}

// -----------------------------------

/**
 * Hook to check if an address has a soulbound token on L2
 */
export function useL2HasSoulboundToken() {
  const { address: aztecAddress } = useAztecWallet()

  const queryKey = ['l2HasSoulboundToken', aztecAddress]
  const queryFn = async () => {
    // For now, just return a promise with value true
    return Promise.resolve(true)
  }

  return useQuery({
    queryKey,
    queryFn,
    enabled: !!aztecAddress,
    staleTime: 60 * 1000, // 1 minute
    meta: {
      persist: true, // Mark this query for persistence
    },
  })
}

// -----------------------------------

/**
 * Hook to mint a soulbound token on L2
 */
export function useL2MintSoulboundToken(onSuccess: (data: any) => void) {
  const { address: aztecAddress } = useAztecWallet()
  const queryClient = useQueryClient()

  const mutationFn = async () => {
    if (!aztecAddress) {
      throw new Error('Aztec wallet not connected')
    }

    // For now, just return a promise with success
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return { success: true }
  }

  return useToastMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['l2HasSoulboundToken', aztecAddress],
      })
      onSuccess(data)
    },
    toastMessages: {
      pending: 'Minting Soulbound Token on Aztec...',
      success: 'Soulbound Token minted successfully on Aztec!',
      error: 'Failed to mint Soulbound Token on Aztec',
    },
  })
}
