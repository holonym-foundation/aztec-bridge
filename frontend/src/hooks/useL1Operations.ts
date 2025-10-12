import { useBridgeStore } from '@/stores/bridgeStore'
import { useContractStore } from '@/stores/contractStore'
import { useWalletStore } from '@/stores/walletStore'
import { truncateDecimals, wait } from '@/utils'
import axios from 'axios'
import { logError, logInfo } from '@/utils/datadog'
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
import {
  formatEther,
  formatUnits,
  getContract,
  encodeFunctionData,
  createPublicClient,
  http,
} from 'viem'
import { sepolia } from 'viem/chains'
import PortalSBTJson from '../constants/PortalSBT.json'
import { useToast, useToastMutation, useToastQuery } from './useToast'
import { extractEvent } from '@aztec/ethereum'
import { requestHumanWallet } from '@/stores/humanWalletStore'
import { SILK_METHOD } from '@silk-wallet/silk-wallet-sdk'
import {
  I_UserTokenBalance,
  T_AlchemyTokenBalanceResponse,
  T_UserTokenType,
} from '@/types/token.balances.types'
import { NFT } from '@/types/nft.types'
import { axiosErrorMessage } from './helper'
import { networkConfig, silkUrl } from '@/config/l1.config'
import { ADDRESS } from '@/config'

// Fix the bytecode format
const PortalSBTAbi = PortalSBTJson.abi

// Create a public client for transaction receipt polling
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
})

export function useL1NativeBalance() {
  const { metaMaskAddress: l1Address } = useWalletStore()

  const queryKey = ['l1NativeBalance', l1Address]
  const queryFn = async () => {
    if (!l1Address) return null

    const chainIds = [11155111]
    console.log('calling alchemy')

    try {
      const url = `${silkUrl}/api/alchemy/tokens-balances`

      const response = await axios.post<T_AlchemyTokenBalanceResponse[]>(url, {
        address: l1Address,
        chains: chainIds,
      })

      const tokens = response?.data
    } catch (error) {
      console.log('error ', error)
    }

    // const balance = await requestHumanWallet(SILK_METHOD.eth_getBalance, [
    //   l1Address,
    //   'latest',
    // ])
    // console.log('balance ', balance)
    // // const balance = '0'
    // const balanceFormatEther = formatEther(BigInt(balance as string))
    // const formattedBalance = truncateDecimals(balanceFormatEther)
    return 0
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

  const queryKey = ['l1TokenBalance', l1Address]
  const queryFn = async () => {
    if (!l1Address) return null

    const data = encodeFunctionData({
      abi: TestERC20Abi,
      functionName: 'balanceOf',
      args: [l1Address],
    })

    const balance = await requestHumanWallet(SILK_METHOD.eth_call, [
      {
        to: ADDRESS[11155111].L1.TOKEN_CONTRACT,
        data,
      },
    ])

    // TODO: this should come from token
    const balanceFormat = formatUnits(BigInt(balance as string), 6)
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

/**
 * Hook to get token balances for an address across multiple chains
 */
export function useL1TokenBalances() {
  const { metaMaskAddress: l1Address } = useWalletStore()
  const notify = useToast()

  const queryKey = ['l1TokenBalances', l1Address]
  const queryFn = async () => {
    try {
      const response = await axios.post<T_AlchemyTokenBalanceResponse[]>(
        '/api/alchemy/tokens-balances',
        {
          address: l1Address,
          chains: [11155111], // Sepolia testnet
        }
      )

      const tokens = response?.data

      const tokenBalnces = tokens?.map(
        (token: T_AlchemyTokenBalanceResponse) => {
          let tokenType: T_UserTokenType

          if (!token.tokenAddress || token.tokenAddress === null) {
            tokenType = 'native'
          } else {
            tokenType = 'erc20'
          }

          const formattedBalance = formatUnits(
            BigInt(token.tokenBalance),
            token?.tokenMetadata?.decimals ?? 18
          )
          const balance_formatted = truncateDecimals(formattedBalance)

          const usdExchangeRate =
            token.tokenPrices?.find((price: any) => price.currency === 'usd')
              ?.value || '0'

          const usdValue = Number(balance_formatted) * Number(usdExchangeRate)
          const usdValueTruncated = truncateDecimals(usdValue, 2)

          return {
            address: token.tokenAddress,
            name: token.tokenMetadata.name,
            symbol: token.tokenMetadata.symbol,
            decimals: token.tokenMetadata.decimals,
            chain: networkConfig[token.chainId]?.name || '',
            network: networkConfig[token.chainId],
            logo: token.tokenMetadata.logo || undefined,
            type: tokenType,
            balance: token.tokenBalance,
            balance_formatted: balance_formatted,
            balance_usd_value: usdValueTruncated,
            exchange_rate: Number(usdExchangeRate),
          }
        }
      ) as I_UserTokenBalance[]

      return tokenBalnces
    } catch (error) {
      const errMsg = axiosErrorMessage(error)
      notify('error', errMsg)

      throw error
    }
  }

  return useToastQuery({
    queryKey,
    queryFn,
    enabled: !!l1Address,
    // Data stays fresh for 1 minute, then triggers a background refetch
    // This means: instant cached data for 1 minute, then auto-refresh
    // staleTime: 60 * 1000, // 1 minute
    meta: {
      persist: true,
    },
  })
}

/**
 * Hook to get NFTs for an address across multiple chains
 */
export function useL1NFTs() {
  const { metaMaskAddress: l1Address } = useWalletStore()

  const queryKey = ['l1NFTs', l1Address]
  const queryFn = async () => {
    try {
      const response = await axios.post<NFT[]>('/api/alchemy/nfts', {
        address: l1Address,
        chains: [11155111], // Sepolia testnet
      })

      return response.data
    } catch (error) {
      console.error('Error fetching NFTs:', error)
      throw error
    }
  }

  return useToastQuery({
    queryKey,
    queryFn,
    enabled: !!l1Address,
    // Data stays fresh for 1 minute, then triggers a background refetch
    // This means: instant cached data for 1 minute, then auto-refresh
    // staleTime: 60 * 1000, // 1 minute
    meta: {
      persist: true,
    },
  })
}

// -----------------------------------

export function useL1Faucet() {
  const { metaMaskAddress: l1Address } = useWalletStore()
  const queryClient = useQueryClient()

  // L1 (Ethereum) balances and operations
  const {
    data: l1TokenBalances = [],
    isLoading: l1BalanceLoading,
    refetch: refetchL1Balance,
  } = useL1TokenBalances()

  // native token
  const sepoliaNativeTokens = l1TokenBalances.find(
    (token) => token.type === 'native' && token.network?.chainId === 11155111
  )
  const l1NativeBalance = sepoliaNativeTokens?.balance_formatted

  const l1Balance = l1TokenBalances.find(
    (token) =>
      token.type === 'erc20' &&
      token.network?.chainId === 11155111 &&
      token.address === ADDRESS[11155111].L1.TOKEN_CONTRACT
  )?.balance_formatted

  const notify = useToast()

  const mintNativeAmount = 0.01
  const mintTokenAmount = 10

  // Helper function to check if user has gas
  const hasGas =
    !!l1NativeBalance && Number(l1NativeBalance || 0) > mintNativeAmount

  // Check balances - only if balance data is loaded
  const balancesLoaded = !l1BalanceLoading
  const needsGas =
    balancesLoaded &&
    (!l1NativeBalance || Number(l1NativeBalance || 0) <= mintNativeAmount)
  const needsTokens =
    balancesLoaded && Number(l1Balance || 0) <= mintTokenAmount

  // User is eligible for faucet if they need gas OR tokens
  // Check if user has gas but still needs tokens - they should be eligible for tokens only
  const isEligibleForFaucet = balancesLoaded && (needsGas || needsTokens)
  const needsTokensOnly = balancesLoaded && !needsGas && needsTokens

  // Main faucet function - handles both gas and tokens
  const requestFaucet = async () => {
    try {
      console.log('Requesting faucet funds...')

      // Log faucet request with enhanced data
      logInfo('Internal faucet request initiated', {
        l1Address: l1Address,
        address: l1Address, // keep original property
        needsGas,
        needsTokens,
        network: 'Ethereum',
        token: 'USDC',
        faucetProvider: 'Internal API',
        faucetType: 'internal',
      })

      if (!l1Address) throw new Error('Wallet not connected')

      console.log('Starting faucet request with state:', {
        l1NativeBalance,
        l1Balance,
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
          // notify('info', 'Getting ETH...')
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
          // await wait(30000) // 30 seconds

          // Refresh balances to reflect new gas balance
          await refetchL1Balance()

          // Create an Etherscan URL for the transaction
          const etherscanUrl = `https://sepolia.etherscan.io/tx/${gasResult.txHash}`
          console.log('View transaction on Ethereum:', etherscanUrl)

          // Using the toast library directly for more control
          notify('info', `ETH received! Click to view on Ethereum`, {
            onClick: () => {
              window.open(etherscanUrl, '_blank')
            },
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
          result?.balances?.recipient?.after || l1NativeBalance

        // const hasEnoughGas = Number(currentNativeBalance) >= mintNativeAmount
        const hasEnoughGas = true

        if (hasEnoughGas) {
          console.log('User has gas. Requesting tokens from API...')
          try {
            // notify('info', 'Getting tokens...')
            // await wait(30000) // 30 seconds

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

            await refetchL1Balance()

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
      logError('Internal faucet request failed', {
        l1Address: l1Address,
        address: l1Address, // keep original property
        needsGas,
        needsTokens,
        network: 'Ethereum',
        token: 'USDC',
        faucetProvider: 'Internal API',
        faucetType: 'internal',
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
        logInfo('Internal faucet request successful', {
          l1Address: l1Address,
          address: l1Address, // keep original property
          needsGas,
          needsTokens,
          network: 'Ethereum',
          token: 'USDC',
          faucetProvider: 'Internal API',
          faucetType: 'internal',
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
        pending: 'Processing faucet and token',
        success: 'Request for Faucet funds completed successfully',
        error: 'Faucet request failed',
      },
    }),
    needsGas,
    needsTokens,
    needsTokensOnly,
    isEligibleForFaucet,
    hasGas,
    l1BalanceLoading,
    balancesLoaded,
  }
}

// -----------------------------------
export function useL1MintTokens() {
  const { metaMaskAddress: l1Address } = useWalletStore()
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
    if (!l1Address) throw new Error('Wallet not connected')

    // Check eligibility
    if (!hasGas) {
      throw new Error(
        'Not enough ETH for gas. Please get ETH from the faucet first.'
      )
    }

    const mintAmount = BigInt(1000000000000000000)

    console.log('Minting tokens for address:', l1Address)

    // Prepare the transaction data
    const data = encodeFunctionData({
      abi: TestERC20Abi,
      functionName: 'mint',
      args: [l1Address, mintAmount],
    })

    // Send the transaction
    const txHash = await requestHumanWallet(SILK_METHOD.eth_sendTransaction, [
      {
        from: l1Address,
        to: ADDRESS[11155111].L1.TOKEN_CONTRACT,
        data,
      },
    ])
    console.log('Mint transaction sent, hash:', txHash)

    // Wait for confirmation
    const receipt = await requestHumanWallet(
      SILK_METHOD.eth_getTransactionReceipt,
      [txHash]
    )
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
    aztecAccount,
    aztecAddress,
  } = useWalletStore()

  const queryClient = useQueryClient()
  const { setProgressStep, setTransactionUrls, isPrivacyModeEnabled } =
    useBridgeStore()
  const notify = useToast()

  const { l1ContractAddresses, l2BridgeContract, l2TokenMetadata } = useContractStore()

  const mutationFn = async (amount: bigint): Promise<string | undefined> => {
    try {
      if (!l1Address || !aztecAddress || !aztecAccount?.aztecNode) {
        console.log({
          l1Address,
          aztecAddress,
          hasAztecNode: !!aztecAccount?.aztecNode,
        })
        throw new Error('Required accounts not connected')
      }

      if (!l2BridgeContract) {
        throw new Error(
          'L2 bridge contract not initialized. Please wait for contract initialization to complete.'
        )
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

      const l1TokenAddress = ADDRESS[11155111].L1.TOKEN_CONTRACT
      const l1PortalAddress = ADDRESS[11155111].L1.PORTAL_CONTRACT

      // Check allowance
      const allowanceData = encodeFunctionData({
        abi: TestERC20Abi,
        functionName: 'allowance',
        args: [l1Address as `0x${string}`, l1PortalAddress],
      })

      const allowance = await requestHumanWallet(SILK_METHOD.eth_call, [
        {
          to: l1TokenAddress,
          data: allowanceData,
        },
      ])

      // Approve tokens if necessary
      if (BigInt(allowance as string) < amount) {
        const approveData = encodeFunctionData({
          abi: TestERC20Abi,
          functionName: 'approve',
          args: [l1PortalAddress, amount],
        })

        const approveTxHash = await requestHumanWallet(
          SILK_METHOD.eth_sendTransaction,
          [
            {
              from: l1Address as `0x${string}`,
              to: l1TokenAddress,
              data: approveData,
            },
          ]
        )

        // OLD CODE: const approveReceipt = await requestHumanWallet(SILK_METHOD.eth_getTransactionReceipt, [approveTxHash])
        // ISSUE: eth_getTransactionReceipt returns null if transaction hasn't been mined yet
        // SOLUTION: Use viem's waitForTransactionReceipt which polls until transaction is confirmed
        // Wait for approve transaction to be mined using viem polling
        console.log('Waiting for approve transaction to be mined...')
        const approveReceipt = await publicClient.waitForTransactionReceipt({
          hash: approveTxHash,
        })
      }

      const [claimSecret, claimSecretHash] = await generateClaimSecret()
      // TODO: store these at this point in the local storage

      // Bridge tokens - use different function based on privacy mode
      const functionName = isPrivacyModeEnabled
        ? 'depositToAztecPrivate'
        : 'depositToAztecPublic'
      const args = isPrivacyModeEnabled
        ? ([amount, claimSecretHash.toString()] as const)
        : ([
            aztecAddress as `0x${string}`,
            amount,
            claimSecretHash.toString(),
          ] as const)

      const bridgeData = encodeFunctionData({
        abi: TokenPortalAbi,
        functionName,
        args,
      })

      const txHash = await requestHumanWallet(SILK_METHOD.eth_sendTransaction, [
        {
          from: l1Address as `0x${string}`,
          to: l1PortalAddress,
          data: bridgeData,
        },
      ])

      // OLD CODE: const txReceipt = await requestHumanWallet(SILK_METHOD.eth_getTransactionReceipt, [txHash])
      // ISSUE: eth_getTransactionReceipt returns null if transaction hasn't been mined yet
      // SOLUTION: Use viem's waitForTransactionReceipt which polls until transaction is confirmed
      // Wait for bridge transaction to be mined using viem polling
      console.log('Waiting for bridge transaction to be mined...')
      const txReceipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      })

      const l1TxHash = txReceipt?.transactionHash?.toString()
      const l1TxUrl = `https://sepolia.etherscan.io/tx/${l1TxHash}`

      setTransactionUrls(l1TxUrl, null)

      // Extract the event to get the message hash and leaf index - use different event based on privacy mode
      const eventName = isPrivacyModeEnabled
        ? 'DepositToAztecPrivate'
        : 'DepositToAztecPublic'

      // Create filter functions for cleaner code
      const privateEventFilter = (log: any) =>
        log.args.amount === amount &&
        log.args.secretHashForL2MessageConsumption ===
          claimSecretHash.toString()

      const publicEventFilter = (log: any) =>
        log.args.secretHash === claimSecretHash.toString() &&
        log.args.amount === amount &&
        log.args.to === aztecAddress

      const eventFilter = isPrivacyModeEnabled
        ? privateEventFilter
        : publicEventFilter

      const log = extractEvent(
        txReceipt.logs,
        l1PortalAddress,
        TokenPortalAbi,
        eventName,
        eventFilter
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
        isPrivacyModeEnabled: isPrivacyModeEnabled,
      }

      // Get existing claims or initialize empty array
      const existingClaims = localStorage.getItem('l1ToL2Claims')
      const claims = existingClaims ? JSON.parse(existingClaims) : []

      // Add new claim to array
      claims.push(claimData)
      localStorage.setItem('l1ToL2Claims', JSON.stringify(claims))

      // Step 2: Waiting for L1-to-L2 message to be available
      setProgressStep(1, 'completed')
      setProgressStep(2, 'active')
      console.log('Waiting for L1-to-L2 message to be available...')

      // Poll for L1-to-L2 message sync status every 2 minutes
      let messageSynced = false
      let attempts = 0
      const maxAttempts = 10 // Maximum 20 minutes of waiting
      const pollInterval = 120000 // 2 minutes in milliseconds

      while (!messageSynced && attempts < maxAttempts) {
        try {
          console.log(`Checking L1-to-L2 message sync status (attempt ${attempts + 1}/${maxAttempts})...`, {
            messageHash: messageHash.toString(),
            messageLeafIndex: messageLeafIndex.toString(),
          })

          // Import Fr from @aztec/aztec.js to create the message hash
          const { Fr } = await import('@aztec/aztec.js')
          
          // Create Fr from the message hash
          const messageHashFr = Fr.fromString(messageHash.toString())
          
          // Check if the L1-to-L2 message is synced
          messageSynced = await aztecAccount?.aztecNode.isL1ToL2MessageSynced(messageHashFr)
          
          if (messageSynced) {
            console.log('L1-to-L2 message is ready for claiming')
            break
          } else {
            console.log(`L1-to-L2 message not yet synced, waiting ${pollInterval / 1000} seconds before next check...`)
            attempts++
            
            if (attempts < maxAttempts) {
              await wait(pollInterval)
            }
          }
        } catch (error) {
          console.error(`Error checking L1-to-L2 message sync (attempt ${attempts + 1}):`, error)
          attempts++
          
          if (attempts < maxAttempts) {
            console.log(`Retrying in ${pollInterval / 1000} seconds...`)
            await wait(pollInterval)
          }
        }
      }

      if (!messageSynced) {
        const errorMessage = `L1-to-L2 message sync timeout after ${maxAttempts} attempts (${(maxAttempts * pollInterval) / 1000 / 60} minutes)`
        console.error(errorMessage)
        
        logError('L1-to-L2 message sync timeout', {
          messageHash: messageHash.toString(),
          messageLeafIndex: messageLeafIndex.toString(),
          attempts: maxAttempts,
          totalWaitTime: (maxAttempts * pollInterval) / 1000 / 60,
        })
        
        throw new Error(errorMessage)
      }

      // Wait for the final poll interval before claiming
      console.log('Waiting for the final poll interval before claiming...')
      await wait(pollInterval)

      // Step 3: Claiming tokens on Aztec Network
      setProgressStep(2, 'completed')
      setProgressStep(3, 'active')

      try {
        console.log('isPrivacyModeEnabled ', isPrivacyModeEnabled)
        const sendResult = isPrivacyModeEnabled
          ? l2BridgeContract.methods
              .claim_private(
                AztecAddress.fromString(aztecAddress),
                amount,
                claimSecret,
                messageLeafIndex
              )
              .send()
          : l2BridgeContract.methods
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

        // Add token to wallet after successful bridge
        try {
          console.log('Adding bridged token to wallet...')
          
          // Use the L2 token metadata from the hook
          
          if (l2TokenMetadata) {
            // Import the SDK to access watchAssets
            const { sdk } = await import('../aztec')
            
            await sdk.watchAssets([
              {
                type: "ARC20",
                options: {
                  chainId: "1337", // Aztec testnet chain ID
                  address: ADDRESS[1337].L2.TOKEN_CONTRACT,
                  name: l2TokenMetadata.name,
                  symbol: l2TokenMetadata.symbol,
                  decimals: l2TokenMetadata.decimals,
                  image: "", // You can add a token image URL here if available
                },
              },
            ])
            
            console.log('Token successfully added to wallet')
            logInfo('Token added to wallet after bridge', {
              tokenAddress: ADDRESS[1337].L2.TOKEN_CONTRACT,
              tokenName: l2TokenMetadata.name,
              tokenSymbol: l2TokenMetadata.symbol,
            })
          } else {
            console.warn('L2 token metadata not available for wallet addition')
          }
        } catch (error) {
          console.error('Failed to add token to wallet:', error)
          // Don't throw here as the bridge was successful
          logError('Failed to add token to wallet after bridge', {
            error: error instanceof Error ? error.message : 'Unknown error',
            tokenAddress: ADDRESS[1337].L2.TOKEN_CONTRACT,
          })
        }

        return l2TxHash
      } catch (error) {
        // If claim fails, keep the data in localStorage
        console.error('Claim failed:', error)
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
          'Bridge transaction failed (error: 0xfb8f41b2). Please reload the page '
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
      } else {
        // For any other errors, show a generic error message
        notify('error', `Bridge transaction failed: ${errorMessage}`)

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
  const notify = useToast()

  const queryKey = ['l1HasSoulboundToken', l1Address]
  const queryFn = async () => {
    if (!l1Address) return false

    try {
      const data = encodeFunctionData({
        abi: PortalSBTAbi,
        functionName: 'hasSoulboundToken',
        args: [l1Address],
      })

      const hasSBT = await requestHumanWallet(SILK_METHOD.eth_call, [
        {
          to: ADDRESS[11155111].L1.PORTAL_SBT_CONTRACT,
          data,
        },
      ])

      return Boolean(hasSBT)
    } catch (error) {
      console.error('Error checking L1 SBT status:', error)
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      notify('error', 'Failed to check SBT status on Ethereum: ' + errorMessage)
      return false
    }
  }

  return useToastQuery({
    queryKey,
    queryFn,
    enabled: !!l1Address,
    // staleTime: 60 * 1000, // 1 minute
    // toastMessages: {
    //   pending: 'Checking SBT status on Ethereum...',
    //   success: 'SBT status checked successfully on Ethereum!',
    //   error: 'Failed to check SBT status on Ethereum',
    // },
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

  const notify = useToast()

  const mutationFn = async () => {
    if (!l1Address) {
      throw new Error('Wallet not connected')
    }

    try {
      // Prepare the mint transaction
      const data = encodeFunctionData({
        abi: PortalSBTAbi,
        functionName: 'mint',
        args: [],
      })

      // Send the transaction
      const txHash = await requestHumanWallet(SILK_METHOD.eth_sendTransaction, [
        {
          from: l1Address,
          to: ADDRESS[11155111].L1.PORTAL_SBT_CONTRACT,
          data,
        },
      ])

      // Wait for confirmation
      const receipt = await requestHumanWallet(
        SILK_METHOD.eth_getTransactionReceipt,
        [txHash]
      )
      const txHashStr = receipt?.transactionHash?.toString()

      const etherscanUrl = `https://sepolia.etherscan.io/tx/${txHashStr}`
      notify(
        'info',
        `SBT minted successfully on Ethereum! Click to view on Ethereum`,
        {
          onClick: () => {
            window.open(etherscanUrl, '_blank')
          },
          closeOnClick: false,
          style: { cursor: 'pointer' },
        }
      )

      console.log('SBT minted successfully on L1', { receipt })
      return receipt
    } catch (error) {
      console.log('Failed to mint SBT on L1', { error })
      throw error
    }
  }

  return useToastMutation({
    mutationFn,
    onSuccess: (data) => {
      onSuccess(data)
    },
    onError: (error) => {
      console.log('🚀MMM - ~ mutationFn ~ error:', error)
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      notify('error', errorMessage)
    },
    // toastMessages: {
    //   pending: 'Minting SBT on Ethereum...',
    //   success: 'SBT minted successfully on Ethereum!',
    //   error: 'Failed to mint SBT on Ethereum',
    // },
  })
}
