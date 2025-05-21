import { ADDRESS } from '@/config'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useContractStore } from '@/stores/contractStore'
import { useWalletStore } from '@/stores/walletStore'
import { truncateDecimals, wait } from '@/utils'
import { logError, logInfo } from '@/utils/datadog'
import { logger } from '@/utils/logger'
import {
  AztecAddress,
  EthAddress,
  L1TokenPortalManager,
  Fr,
  computeSecretHash,
  generateClaimSecret,
} from '@aztec/aztec.js'
import { TestERC20Abi, TokenPortalAbi } from '@aztec/l1-artifacts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { formatEther, formatUnits, getContract } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import PortalSBTJson from '../constants/PortalSBT.json'
import { useToast, useToastMutation, useToastQuery } from './useToast'
import { extractEvent } from '@aztec/ethereum'

// Fix the bytecode format
const PortalSBTAbi = PortalSBTJson.abi

export function useL1NativeBalance() {
  const { metaMaskAddress: l1Address } = useWalletStore()
  const publicClient = usePublicClient()
  // const { data: nativeBalance } = useBalance({
  //   address: l1Address,
  // })

  const queryKey = ['l1NativeBalance', l1Address]
  const queryFn = async () => {
    if (!l1Address) return null

    const balance = await publicClient.getBalance({
      address: l1Address,
    })

    const balanceFormatEther = formatEther(balance)
    const formattedBalance = truncateDecimals(balanceFormatEther)
    return formattedBalance
  }

  return useQuery({
    queryKey,
    queryFn,
    enabled: !!l1Address,
    meta: {
      persist: true, // Mark this query for persistence
    },
  })
}

// -----------------------------------

export function useL1TokenBalance() {
  const { metaMaskAddress: l1Address } = useWalletStore()
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

  return useQuery({
    queryKey,
    queryFn,
    enabled: !!l1Address,
    meta: {
      persist: true, // Mark this query for persistence
    },
  })
}

// -----------------------------------

export function useL1Faucet() {
  const { metaMaskAddress: l1Address } = useWalletStore()
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
    try {
      console.log('Requesting faucet funds...')

      // Log faucet request with enhanced data
      logInfo('Faucet request initiated', {
        l1Address: l1Address,
        address: l1Address, // keep original property
        needsGas,
        needsTokens,
        network: 'Ethereum',
        token: 'USDC',
      })

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

          // Create an Etherscan URL for the transaction
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
              throw new Error(
                errorData.error || 'Failed to mint tokens via API'
              )
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
          console.log(
            'User still does not have enough gas for receiving tokens'
          )
          throw new Error('Not enough ETH for gas to receive tokens')
        }
      }

      return { success: true }
    } catch (error) {
      console.error('Faucet request failed:', error)

      // Log faucet failure with enhanced data
      logError('Faucet request failed', {
        l1Address: l1Address,
        address: l1Address, // keep original property
        needsGas,
        needsTokens,
        network: 'Ethereum',
        token: 'USDC',
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  return {
    ...useToastMutation({
      mutationFn: requestFaucet,
      onSuccess: (data) => {
        console.log('Faucet operations completed:', data)

        // Log faucet success with enhanced data
        logInfo('Faucet request successful', {
          l1Address: l1Address,
          address: l1Address, // keep original property
          needsGas,
          needsTokens,
          network: 'Ethereum',
          token: 'USDC',
          success: data?.success,
        })

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
  const { metaMaskAddress: l1Address } = useWalletStore()
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
  const {
    metaMaskAddress: l1Address,
    isMetaMaskConnected,
    aztecAddress,
  } = useWalletStore()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const queryClient = useQueryClient()
  const { setProgressStep, setTransactionUrls } = useBridgeStore()
  const notify = useToast()

  const { l1ContractAddresses, l2BridgeContract } = useContractStore()

  const mutationFn = async (amount: bigint): Promise<string | undefined> => {
    try {
      if (!l1Address || !aztecAddress) {
        console.log({
          l1Address,
          aztecAddress,
        })
        throw new Error('Required accounts not connected')
      }

      if (!l2BridgeContract) {
        throw new Error(
          'L2 bridge contract not initialized. Please wait for contract initialization to complete.'
        )
      }

      if (!publicClient) {
        throw new Error('Public client not connected')
      }

      if (!walletClient) {
        throw new Error('Wallet client not connected')
      }

      if (!l1ContractAddresses?.outboxAddress) {
        throw new Error(
          'L1 contract addresses not initialized. Please wait for contract initialization to complete.'
        )
      }

      setProgressStep(1, 'active')
      console.log('Initiating bridge tokens to L2...')
      logInfo('Bridge from L1 to L2 initiated', {
        direction: 'L1_TO_L2',
        fromNetwork: 'Ethereum',
        toNetwork: 'Aztec',
        fromToken: 'USDC',
        toToken: 'USDC',
        amount: amount.toString(),
        l1Address: l1Address,
        l2Address: aztecAddress,
      })

      const l1TokenAddress = ADDRESS[11155111].L1
        .TOKEN_CONTRACT as `0x${string}`
      const l1PortalAddress = ADDRESS[11155111].L1
        .PORTAL_CONTRACT as `0x${string}`

      // const l2TokenAddress = ADDRESS[11155111].L2.TOKEN_CONTRACT
      // const l2PortalAddress = ADDRESS[11155111].L2.PORTAL_CONTRACT

      // Get token contract instance
      const tokenContract = getContract({
        address: l1TokenAddress,
        abi: TestERC20Abi,
        client: walletClient,
      })

      // Get portal contract instance
      const portalContract = getContract({
        address: l1PortalAddress,
        abi: TokenPortalAbi,
        client: walletClient,
      })

      // Check allowance
      const userAddress = walletClient.account.address
      const allowance = await tokenContract.read.allowance([
        userAddress,
        l1PortalAddress,
      ])

      // Approve tokens if necessary
      if (allowance < amount) {
        const approveTxHash = await tokenContract.write.approve([
          l1PortalAddress,
          amount,
        ])
        const approveReceipt = await publicClient.waitForTransactionReceipt({
          hash: approveTxHash,
        })
        console.log('🚀MMM - ~ approveReceipt:', approveReceipt.transactionHash)
      }

      const [claimSecret, claimSecretHash] = await generateClaimSecret()

      // // Generate claim secret using Ethereum wallet signature
      // const message = `Bridge to Aztec: ${amount.toString()} tokens to ${aztecAddress}`
      // const signature = await walletClient.signMessage({ message })
      // console.log('signature ', signature)

      // // Use the signature as the claim secret and compute its hash
      // const claimSecret = Fr.fromString(signature)
      // console.log('claimSecret ', claimSecret)
      // const claimSecretHash = await computeSecretHash(claimSecret)
      // console.log('claimSecretHash ', claimSecretHash)

      // TODO: better to store the secret and hash right here before passing it to function

      // Bridge tokens
      const { request } = await portalContract.simulate.depositToAztecPublic([
        aztecAddress as `0x${string}`,
        amount,
        claimSecretHash.toString(),
      ])

      const txHash = await walletClient.writeContract(request)
      const txReceipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      })

      const l1TxHash = txReceipt.transactionHash.toString()
      const l1TxUrl = `https://sepolia.etherscan.io/tx/${l1TxHash}`

      setTransactionUrls(l1TxUrl, null)

      // Extract the event to get the message hash and leaf index
      const log = extractEvent(
        txReceipt.logs,
        portalContract.address,
        portalContract.abi,
        'DepositToAztecPublic',
        (log) =>
          log.args.secretHash === claimSecretHash.toString() &&
          log.args.amount === amount &&
          log.args.to === aztecAddress
      )

      const messageHash = log.args.key
      const messageLeafIndex = log.args.index
      const claimAmount = amount

      // Store claim data in localStorage
      const claimData = {
        id: Date.now().toString(), // Unique identifier for this attempt
        claimAmount: claimAmount.toString(),
        claimSecret: claimSecret.toString(),
        claimSecretHash: claimSecretHash.toString(),
        messageHash: messageHash,
        messageLeafIndex: messageLeafIndex.toString(),
        timestamp: Date.now(),
        l1Address,
        l2Address: aztecAddress,
        success: false, // Initial state
        l1TxHash: l1TxHash,
        l1TxUrl: l1TxUrl,
      }

      // Get existing claims or initialize empty array
      const existingClaims = localStorage.getItem('l1ToL2Claims')
      const claims = existingClaims ? JSON.parse(existingClaims) : []

      // Add new claim to array
      claims.push(claimData)
      localStorage.setItem('l1ToL2Claims', JSON.stringify(claims))

      // Step 2: Waiting for Ethereum confirmation
      setProgressStep(1, 'completed')
      setProgressStep(2, 'active')
      console.log('Waiting for Ethereum confirmation...')
      await wait(120000) // 2 minutes

      // Step 3: Claiming tokens on Aztec Network
      setProgressStep(2, 'completed')
      setProgressStep(3, 'active')

      try {
        const sendResult = l2BridgeContract.methods
          .claim_public(
            AztecAddress.fromString(aztecAddress),
            amount,
            claimSecret,
            messageLeafIndex
          )
          .send()

        const claimReceipt = await sendResult.wait({ timeout: 200000 })
        console.log('l2 claimReceipt ', claimReceipt)

        const l2TxHash = claimReceipt.txHash.toString()
        const l2TxUrl = `https://aztecscan.xyz/tx-effects/${l2TxHash}`

        setTransactionUrls(l1TxUrl, l2TxUrl)

        // Update claim data with success and L2 transaction info
        const updatedClaimData = {
          ...claimData,
          success: true,
          l2TxHash: l2TxHash,
          l2TxUrl: l2TxUrl,
          completedAt: Date.now(),
        }

        // Update the specific claim in the array
        const updatedClaims = claims.map((c: any) =>
          c.id === claimData.id ? updatedClaimData : c
        )
        localStorage.setItem('l1ToL2Claims', JSON.stringify(updatedClaims))

        // Step 4: Bridge Complete
        setProgressStep(3, 'completed')
        setProgressStep(4, 'active')

        logInfo('Bridge from L1 to L2 completed', {
          direction: 'L1_TO_L2',
          fromNetwork: 'Ethereum',
          toNetwork: 'Aztec',
          fromToken: 'USDC',
          toToken: 'USDC',
          amount: amount?.toString(),
          l1Address: l1Address,
          l2Address: aztecAddress?.toString(),
          txHash: l2TxHash,
          aztecscanUrl: l2TxUrl,
        })

        await wait(3000)
        setProgressStep(4, 'completed')

        return l2TxHash
      } catch (error) {
        // If claim_public fails, keep the data in localStorage
        console.error('Claim public failed:', error)
        throw error
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      if (
        errorMessage.includes(
          '"path":["revertReason","functionErrorStack",0,"functionSelector"]'
        ) ||
        (errorMessage.includes('invalid_type') &&
          errorMessage.includes('functionSelector'))
      ) {
        notify(
          'error',
          'The Aztec Testnet is congested right now. Unfortunately your transaction was dropped.',
          {
            autoClose: false,
          }
        )

        logError('Bridge from L1 to L2 failed due to network congestion', {
          direction: 'L1_TO_L2',
          fromNetwork: 'Ethereum',
          toNetwork: 'Aztec',
          fromToken: 'USDC',
          toToken: 'USDC',
          amount: amount.toString(),
          l1Address: l1Address,
          l2Address: aztecAddress?.toString(),
          error: 'Network congestion caused transaction to be dropped',
          errorType: 'congestion',
        })

        throw new Error(
          'The Aztec Testnet is congested right now. Unfortunately your transaction was dropped.'
        )
      } else if (errorMessage.includes('0xfb8f41b2')) {
        notify(
          'error',
          'Bridge transaction failed (error: 0xfb8f41b2). Please reload the page ',
          {
            autoClose: 5000,
          }
        )

        logError('Bridge from L1 to L2 failed with contract error', {
          direction: 'L1_TO_L2',
          fromNetwork: 'Ethereum',
          toNetwork: 'Aztec',
          fromToken: 'USDC',
          toToken: 'USDC',
          amount: amount.toString(),
          l1Address: l1Address,
          l2Address: aztecAddress?.toString(),
          error:
            'Contract reverted with signature 0xfb8f41b2. Recommend reload.',
          errorSignature: '0xfb8f41b2',
        })
        // throw new Error(
        //   'Bridge transaction failed (error: 0xfb8f41b2). Please reload the page and try with a 25% smaller amount.'
        // )
      } else {
        // For any other errors, show a generic error message
        notify('error', errorMessage, {
          autoClose: 5000,
        })

        logError('Bridge from L1 to L2 failed', {
          direction: 'L1_TO_L2',
          fromNetwork: 'Ethereum',
          toNetwork: 'Aztec',
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
  }

  return useMutation({
    mutationFn,
    onSuccess: (txHash) => {
      console.log('Refetching balances after successful mint')
      queryClient.invalidateQueries({ queryKey: [l1Address] })
      queryClient.invalidateQueries({ queryKey: [aztecAddress] })

      if (onBridgeSuccess) {
        onBridgeSuccess(txHash)
      }
    },
  })
}

// -----------------------------------

/**
 * Hook to check if an address has a soulbound token on L1
 */
export function useL1HasSoulboundToken() {
  const { metaMaskAddress: l1Address } = useWalletStore()
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
    meta: {
      persist: true, // Mark this query for persistence
    },
  })
}

// -----------------------------------

/**
 * Hook to mint a soulbound token on L1
 */
export function useL1MintSoulboundToken(onSuccess: (data: any) => void) {
  const { metaMaskAddress: l1Address } = useWalletStore()
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
