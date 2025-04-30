import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount, useBalance, usePublicClient, useWalletClient } from 'wagmi'
import { ADDRESS } from '@/config'
import { TestERC20Abi } from '@aztec/l1-artifacts'
import { useAztecWallet } from './useAztecWallet'
import { TokenContract } from '../constants/aztec/artifacts/Token'
import { AztecAddress, EthAddress, L1TokenPortalManager } from '@aztec/aztec.js'
import { truncateDecimals, wait } from '@/utils'
import { useContractStore } from '@/stores/contractStore'
import { logger } from '@/utils/logger'
import { useToast, useToastQuery, useToastMutation } from './useToast'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import PortalSBTJson from '../constants/PortalSBT.json'
import { toast } from 'react-toastify'
import { formatEther, formatUnits } from 'viem'

// Fix the bytecode format
const PortalSBTAbi = PortalSBTJson.abi

export const useL1NativeBalance = () => {
  const { address: l1Address } = useAccount()
  // const { data: nativeBalance } = useBalance({
  //   address: l1Address,
  // })

  const publicClient = usePublicClient()

  const queryKey = ['l1NativeBalance', l1Address]
  const queryFn = async () => {
    if (!l1Address) return null

    const balance = await publicClient.getBalance({
      address: l1Address,
    })

    const balanceFormetEther = formatEther(balance)
    const formattedBalance = truncateDecimals(balanceFormetEther)
    return formattedBalance
  }

  return useQuery({
    queryKey,
    queryFn,
    enabled: !!l1Address,
  })
}
// -----------------------------------

export function useL1TokenBalance() {
  const { address: l1Address } = useAccount()
  const publicClient = usePublicClient()

  const queryKey = ['l1TokenBalance', l1Address]
  const queryFn = async () => {
    if (!l1Address) return null
    const balance = await publicClient.readContract({
      address: ADDRESS[11155111].L1.TOKEN_CONTRACT as `0x${string}`,
      abi: TestERC20Abi,
      functionName: 'balanceOf',
      args: [l1Address],
    })

    // TODO: this should come from token
    const balanceFormat = formatUnits(balance as bigint, 6)
    return balanceFormat
  }

  return useToastQuery({
    queryKey,
    queryFn,
    enabled: !!l1Address,
    // toastMessages: {
    //   pending: 'Fetching L1 token balance...',
    //   success: 'L1 token balance loaded',
    //   error: 'Failed to load L1 token balance'
    // }
  })
}

// -----------------------------------

export function useL1Faucet() {
  const { address: l1Address } = useAccount()
  const queryClient = useQueryClient()
  const {
    data: nativeBalance,
    isLoading: nativeBalanceLoading,
    refetch: refetchNativeBalance,
  } = useL1NativeBalance()
  const {
    data: tokenBalance,
    isLoading: tokenBalanceLoading,
    refetch: refetchTokenBalance,
  } = useL1TokenBalance()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const notify = useToast()

  const mintNativeAmount = 0.01
  const mintTokenAmount = 0

  // Helper function to check if user has gas
  const hasGas = !!nativeBalance && Number(nativeBalance) > mintNativeAmount

  // Check balances - only if balance data is loaded
  const balancesLoaded = !nativeBalanceLoading && !tokenBalanceLoading
  const needsGas =
    balancesLoaded &&
    (!nativeBalance || Number(nativeBalance) <= mintNativeAmount)
  const needsTokens =
    balancesLoaded && tokenBalance && Number(tokenBalance) <= mintTokenAmount

  // User is eligible for faucet if they need gas OR tokens
  // Check if user has gas but still needs tokens - they should be eligible for tokens only
  const isEligibleForFaucet = balancesLoaded && (needsGas || needsTokens)
  const needsTokensOnly = balancesLoaded && !needsGas && needsTokens

  // Main faucet function - handles both gas and tokens
  const requestFaucet = async () => {
    if (!l1Address) throw new Error('Wallet not connected')

    console.log('Starting faucet request with state:', {
      nativeBalance,
      tokenBalance,
      hasGas,
      needsGas,
      needsTokens,
      isEligibleForFaucet,
      needsTokensOnly,
    })

    let result: any = { gasProvided: false, tokensMinted: false }

    // Step 1: If needed, get ETH for gas
    if (needsGas) {
      try {
        notify('info', 'Getting ETH...')
        // Request gas from faucet
        const response = await fetch('/api/faucet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address: l1Address }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(
            errorData.error || 'Failed to request ETH from faucet'
          )
        }

        const gasResult = await response.json()
        result.gasProvided = true
        result.gasHash = gasResult.txHash
        console.log('Gas provided successfully:', gasResult)
        result = { ...result, ...gasResult }

        // Wait for the gas transaction to be processed
        // console.log('Waiting for gas transaction to be confirmed...')
        await wait(30000) // 30 seconds

        // Refresh balances to reflect new gas balance
        await refetchNativeBalance()

        // await queryClient.invalidateQueries({
        //   queryKey: ['l1NativeBalance', l1Address],
        // })

        // Create an Aztecscan URL for the transaction
        const etherscanUrl = `https://sepolia.etherscan.io/tx/${gasResult.txHash}`
        console.log('View transaction on Ethereum:', etherscanUrl)

        // Using the toast library directly for more control
        notify('info', `ETH received! Click to view on Ethereum`, {
          onClick: () => {
            window.open(etherscanUrl, '_blank')
          },
          autoClose: 10000, // 10 seconds
          closeOnClick: false,
          style: { cursor: 'pointer' },
        })

        // await wait(30000) // 30 seconds
      } catch (error) {
        console.log('Error requesting gas:', error)
        throw error
      }
    }

    // Step 2: If needed, mint tokens
    if (needsTokens || (needsGas && result.gasProvided)) {
      // Even if user didn't need tokens initially, if we provided gas, check if they need tokens now
      console.log('Checking if tokens need to be minted...')

      const currentNativeBalance =
        result?.balances?.recipient?.after || nativeBalance

      // const hasEnoughGas = Number(currentNativeBalance) >= mintNativeAmount
      const hasEnoughGas = true

      if (hasEnoughGas) {
        console.log('User has gas. Requesting tokens from API...')
        try {
          notify('info', 'Getting tokens...')
          await wait(30000) // 30 seconds

          // Call our mint-tokens API endpoint
          const response = await fetch('/api/mint-tokens', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ address: l1Address }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to mint tokens via API')
          }

          const mintResult = await response.json()
          result.tokensMinted = true
          result.tokenHash = mintResult.txHash
          console.log('Tokens minted successfully via API:', mintResult)
          // await wait(30000) // 30 seconds

          await refetchTokenBalance()

          // await queryClient.invalidateQueries({
          //   queryKey: ['l1TokenBalance', l1Address],
          // })

          // Wait for the query to complete
          // await wait(30000) // 30 seconds
        } catch (error) {
          console.error('Token minting via API failed:', error)
          throw error

        }
      } else {
        console.log('User still does not have enough gas for receiving tokens')
        throw new Error('Not enough ETH for gas to receive tokens')
      }
    }

    return result
  }

  return {
    ...useToastMutation({
      mutationFn: requestFaucet,
      onSuccess: (data) => {
        console.log('Faucet operations completed:', data)

        // Wait a short delay to allow the transaction to be processed
        setTimeout(() => {
          // Invalidate both native and token balances to refresh them
          queryClient.invalidateQueries({
            queryKey: ['l1NativeBalance', l1Address],
          })
          queryClient.invalidateQueries({
            queryKey: ['l1TokenBalance', l1Address],
          })
        }, 10000) // 10 seconds
      },
      toastMessages: {
        pending: 'Processing faucet and token ...',
        success: 'Faucet completed successfully!',
        error: 'Faucet request failed',
      },
    }),
    needsGas,
    needsTokens,
    needsTokensOnly,
    isEligibleForFaucet,
    hasGas,
    nativeBalanceLoading,
    tokenBalanceLoading,
    balancesLoaded,
  }
}

// -----------------------------------
export function useL1MintTokens() {
  const { address: l1Address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const queryClient = useQueryClient()
  const { data: nativeBalance } = useL1NativeBalance()
  const { data: tokenBalance } = useL1TokenBalance()

  // Check if user has enough gas for minting
  const hasGas = !!nativeBalance && Number(nativeBalance) > 0.01

  // Check if user already has tokens
  const hasTokens = !!tokenBalance && Number(tokenBalance) > 0

  // User is eligible to mint tokens if they have gas but no tokens
  const isEligibleForTokens = hasGas && !hasTokens

  const mutationFn = async () => {
    if (!walletClient || !l1Address) throw new Error('Wallet not connected')

    // Check eligibility
    if (!hasGas) {
      throw new Error(
        'Not enough ETH for gas. Please get ETH from the faucet first.'
      )
    }

    // if (hasTokens) {
    //   throw new Error('You already have tokens')
    // }

    const mintAmount = BigInt(1000000000000000000)

    console.log('Minting tokens for address:', l1Address)

    // Simulate the transaction
    const { request } = await publicClient.simulateContract({
      address: ADDRESS[11155111].L1.TOKEN_CONTRACT as `0x${string}`,
      abi: TestERC20Abi,
      functionName: 'mint',
      args: [l1Address, mintAmount],
      account: l1Address as `0x${string}`,
    })

    // Send the transaction
    const hash = await walletClient.writeContract(request)
    console.log('Mint transaction sent, hash:', hash)

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('Mint transaction confirmed, receipt:', receipt)
    return receipt
  }

  return {
    ...useToastMutation({
      mutationFn,
      onSuccess: () => {
        console.log('Refetching balances after successful mint')
        // Invalidate both balances to refresh them
        queryClient.invalidateQueries({
          queryKey: ['l1TokenBalance', l1Address],
        })
        queryClient.invalidateQueries({
          queryKey: ['l1NativeBalance', l1Address],
        })
      },
      toastMessages: {
        pending: 'Minting tokens...',
        success: 'Tokens successfully minted!',
        error: 'Failed to mint tokens',
      },
    }),
    hasGas,
    hasTokens,
    isEligibleForTokens,
  }
}

// -----------------------------------

export function useL1BridgeToL2(onBridgeSuccess?: (data: any) => void) {
  const { address: l1Address , isConnected: isMetaMaskConnected} = useAccount()
  const { account: aztecAccount, address: aztecAddress } = useAztecWallet()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const queryClient = useQueryClient()
  const toastIdRef = useRef<string | number | null>(null)

  const notify = useToast()

  const { l1ContractAddresses, l2BridgeContract } = useContractStore()

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, walletClient, l1ContractAddresses, isMetaMaskConnected])

  const mutationFn = async (amount: bigint) => {
    // For tracking toast progress
    let progressInterval: NodeJS.Timeout | null = null

    try {
      if (!l1Address || !aztecAddress || !aztecAccount?.aztecNode) {
        throw new Error('Required accounts not connected')
      }

      if (!l2BridgeContract) {
        throw new Error('L2 bridge contract not initialized. Please wait for contract initialization to complete.')
      }

      if (!publicClient) {
        throw new Error('Public client not connected')
      }

      if (!walletClient) {
        throw new Error('Wallet client not connected')
      }

      // Check if contract store is properly initialized
      if (!l1ContractAddresses?.outboxAddress) {
        throw new Error('L1 contract addresses not initialized. Please wait for contract initialization to complete.')
      }

      console.log('Initiating bridge tokens to L2...')
      const manager = getL1PortalManager()
      if (!manager) {
        throw new Error('Failed to create L1 portal manager')
      }

      // First toast notification for initiating the bridge
      notify('info', 'Initiating bridge L1 transaction...')

      const claim = await manager.bridgeTokensPublic(
        AztecAddress.fromString(aztecAddress as string),
        amount,
        false // mint
      )

      // console.log('Bridge claim created:', {
      //   claimSecret: claim.claimSecret.toString(),
      //   messageLeafIndex: claim.messageLeafIndex.toString()
      // })

      console.log('Waiting 2 minutes before proceeding...')

      // Create a toast with progress bar for the 2-minute wait
      toastIdRef.current = toast('Waiting for transaction to be confirmed...', {
        progress: 0,
        closeButton: false,
        autoClose: false,
      })

      // Show progress during the wait
      const totalWaitTime = 120000 // 2 minutes in ms
      const stepTime = 1000 // Update every second
      let elapsedTime = 0

      while (elapsedTime < totalWaitTime) {
        await wait(stepTime)
        elapsedTime += stepTime
        const progress = elapsedTime / totalWaitTime

        // Update progress
        if (toastIdRef.current !== null) {
          toast.update(toastIdRef.current, {
            progress: progress,
            render: `Waiting for transaction to be confirmed... ${Math.round(
              progress * 100
            )}%`,
          })
        }
      }

      // Complete the waiting toast
      if (toastIdRef.current !== null) {
        toast.done(toastIdRef.current as number | string)
        toast.dismiss(toastIdRef.current as number | string)
        toastIdRef.current = null
      }

      console.log('Starting claim_public transaction...')

      // Create a new toast for the claim_public process
      toastIdRef.current = toast('Processing L2 claim transaction...', {
        progress: 0,
        closeButton: false,
        autoClose: false,
      })

      // notify('info', 'Claiming tokens on Aztec...')

      // Type assertion to ensure l2BridgeContract is not null
      if (!l2BridgeContract) {
        throw new Error('L2 bridge contract is null')
      }

      // Start the claim transaction
      const sendResult = l2BridgeContract.methods
        .claim_public(
          AztecAddress.fromString(aztecAddress as string),
          amount,
          claim.claimSecret,
          claim.messageLeafIndex
        )
        .send()

      // Update toast to 25% to indicate transaction is sent
      if (toastIdRef.current !== null) {
        toast.update(toastIdRef.current, {
          progress: 0.25,
          render: 'Aztec transaction sent, waiting for confirmation...',
        })
      }

      // Create a progress simulation for the waiting period
      let simulatedProgress = 0.25
      progressInterval = setInterval(() => {
        // Increment progress smoothly from 25% to 90%
        if (simulatedProgress < 0.9) {
          simulatedProgress += 0.01

          if (toastIdRef.current !== null) {
            toast.update(toastIdRef.current, {
              progress: simulatedProgress,
              render: `Aztec transaction in progress... ${Math.round(
                simulatedProgress * 100
              )}%`,
            })
          }
        }
      }, 2000) // Update every half second

      // Wait for transaction confirmation
      const claimReceipt = await sendResult.wait({ timeout: 200000 })

      // Update toast to 100% to indicate transaction is completed
      if (toastIdRef.current !== null) {
        toast.update(toastIdRef.current, {
          progress: 1,
          render: 'Bridge completed successfully!',
        })

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
          if (toastIdRef.current !== null) {
            toast.done(toastIdRef.current as number | string)
            toast.dismiss(toastIdRef.current as number | string)
            toastIdRef.current = null
          }
        }, 3000)
      }

      const txHash = claimReceipt.txHash.toString()
      console.log('txHash ', txHash)

      return txHash
    } catch (error) {
      console.error('Bridge operation failed:', error)

      // Clean up any pending toast on error
      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current as number | string)
        toastIdRef.current = null
      }

      // Handle specific bridge errors
      if (error instanceof Error && error.message.includes('0xe450d38c')) {
        throw new Error(
          'Bridge deposit failed. Please wait for previous transactions to complete and try again.'
        )
      }

      throw error
    } finally {
      // Always clear the interval if it exists
      if (progressInterval) {
        clearInterval(progressInterval)
      }
    }
  }

  return useToastMutation({
    mutationFn,
    onSuccess: (txHash) => {
      console.log('Refetching balances after successful mint')
      queryClient.invalidateQueries({ queryKey: [l1Address] })
      queryClient.invalidateQueries({ queryKey: [aztecAddress] })

      // Create an Aztecscan URL for the transaction
      const aztecscanUrl = `https://aztecscan.xyz/tx-effects/${txHash}`
      console.log('View transaction on Aztecscan:', aztecscanUrl)

      // Show a notification with the transaction link info
      // Using the toast library directly for more control
      toast.info(`Bridge complete! Click to view on Aztecscan`, {
        onClick: () => {
          window.open(aztecscanUrl, '_blank')
        },
        autoClose: 10000, // 10 seconds
        closeOnClick: false,
        style: { cursor: 'pointer' },
      })

      if (onBridgeSuccess) {
        onBridgeSuccess(txHash)
      }
    },
    toastMessages: {
      pending: 'Bridging tokens to Aztec...',
      success: 'Tokens successfully bridged to L2!',
      error: 'Failed to bridge tokens',
    },
  })
}

// -----------------------------------

/**
 * Hook to check if an address has a soulbound token on L1
 */
export function useL1HasSoulboundToken() {
  const { address: l1Address } = useAccount()
  const publicClient = usePublicClient()

  const queryKey = ['l1HasSoulboundToken', l1Address]
  const queryFn = async () => {
    if (!l1Address) return false

    try {
      const hasSBT = await publicClient.readContract({
        address: ADDRESS[11155111].L1.PORTAL_SBT_CONTRACT as `0x${string}`,
        abi: PortalSBTAbi,
        functionName: 'hasSoulboundToken',
        args: [l1Address],
      })

      return hasSBT
    } catch (error) {
      console.error('Error checking L1 SBT status:', error)
      return false
    }
  }

  return useToastQuery({
    queryKey,
    queryFn,
    enabled: !!l1Address,
    staleTime: 60 * 1000, // 1 minute
  })
}

// -----------------------------------

/**
 * Hook to mint a soulbound token on L1
 */
export function useL1MintSoulboundToken(onSuccess: (data: any) => void) {
  const { address: l1Address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const queryClient = useQueryClient()

  const notify = useToast()

  const mutationFn = async () => {
    if (!walletClient || !l1Address) {
      throw new Error('Wallet not connected')
    }

    try {
      // Simulate the mint transaction
      const { request } = await publicClient.simulateContract({
        address: ADDRESS[11155111].L1.PORTAL_SBT_CONTRACT as `0x${string}`,
        abi: PortalSBTAbi,
        functionName: 'mint',
        args: [],
        account: l1Address as `0x${string}`,
      })

      // Send the transaction
      const hash = await walletClient.writeContract(request)

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      const txHash = receipt.transactionHash.toString()

      const etherscanUrl = `https://sepolia.etherscan.io/tx/${txHash}`
      notify(
        'info',
        `SBT minted successfully on Ethereum! Click to view on Ethereum`,
        {
          onClick: () => {
            window.open(etherscanUrl, '_blank')
          },
          autoClose: 10000, // 10 seconds
          closeOnClick: false,
          style: { cursor: 'pointer' },
        }
      )

      logger.info('SBT minted successfully on L1', { receipt })
      return receipt
    } catch (error) {
      logger.error('Failed to mint SBT on L1', { error })
      throw error
    }
  }

  return useToastMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['l1HasSoulboundToken', l1Address],
      })
      onSuccess(data)
    },
    toastMessages: {
      pending: 'Minting SBT on Ethereum...',
      success: 'SBT minted successfully on Ethereum!',
      error: 'Failed to mint SBT on Ethereum',
    },
  })
}
