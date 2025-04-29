import { useState, useCallback, useEffect } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { ADDRESS } from '@/config'
import { useAccount as useAztecAccount } from '@nemi-fi/wallet-sdk/react'
import { sdk} from '@/aztec'
import {
  L1TokenPortalManager,
  L1TokenManager,
  EthAddress,
  AztecAddress,
  createLogger,
  Fr,
  SponsoredFeePaymentMethod,
  readFieldCompressedString,
} from '@aztec/aztec.js'
// import { TokenContract } from '@aztec/noir-contracts.js/Token'
import { TokenBridgeContract } from '@aztec/noir-contracts.js/TokenBridge'
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC'

import { useAztecWallet } from './useAztecWallet'
import { TokenContract } from '../constants/aztec/artifacts/Token'
import { useL2Contracts, useL1ContractAddresses, useContractStore } from '../stores/contractStore'

import {
  BatchCall,
  type IntentAction,
  Contract,
} from '@nemi-fi/wallet-sdk/eip1193'
import { L1ContractAddresses } from '@aztec/ethereum'

class L2SponseredFPC extends Contract.fromAztec(SponsoredFPCContract) { }
class L2Token extends Contract.fromAztec(TokenContract) { }
class L2TokenBridge extends Contract.fromAztec(TokenBridgeContract) { }

const logger = createLogger('aztec:token-bridge:webapp')

export function useBridge() {
  // L1 (MetaMask)
  const { address: l1Address, isConnected: isL1Connected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  // L2 (Obsidian/Aztec)
  const {
    account: aztecAccount,
    address: aztecAddress,
    isConnected: isL2Connected,
  } = useAztecWallet()

  // Get contracts from store
  const { 
    l2TokenContract, 
    l2BridgeContract,
    l1ContractAddresses
  } = useContractStore()

  // State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [l1Balance, setL1Balance] = useState<string>()
  const [l2Balance, setL2Balance] = useState<string>()

  // L1TokenPortalManager instance
  const getL1PortalManager = useCallback(() => {
    logger.info('Getting L1 portal manager...')
    if (
      !publicClient ||
      !walletClient ||
      !l1ContractAddresses?.outboxAddress.toString()
    ) {
      logger.warn('Missing required dependencies for L1 portal manager')
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
    logger.info('Created L1 portal manager instance')
    return manager
  }, [publicClient, walletClient, l1ContractAddresses])

  // L1TokenManager instance
  const getL1TokenManager = useCallback(() => {
    logger.info('Getting L1 token manager...')
    if (!publicClient || !walletClient) {
      logger.warn('Missing required dependencies for L1 token manager')
      return null
    }
    const manager = new L1TokenManager(
      EthAddress.fromString(ADDRESS[11155111].L1.TOKEN_CONTRACT),
      EthAddress.fromString(ADDRESS[11155111].L1.FEE_ASSET_HANDLER_CONTRACT),
      // @ts-ignore
      publicClient,
      walletClient,
      logger
    )
    logger.info('Created L1 token manager instance')
    return manager
  }, [publicClient, walletClient])

  // Get L1 balance
  const getL1Balance = useCallback(async () => {
    if (!l1Address) {
      logger.warn('No L1 address available for balance check')
      return
    }
    try {
      logger.info('Fetching L1 balance...')
      setLoading(true)
      const manager = getL1TokenManager()
      if (!manager) throw new Error('L1TokenManager not ready')
      const balance = await manager.getL1TokenBalance(l1Address)
      logger.info('Retrieved L1 balance', { balance: balance.toString() })
      setL1Balance(balance.toString())
      setLoading(false)
      return balance
    } catch (e) {
      logger.error('Failed to fetch L1 balance', { error: e })
      setError('Failed to fetch L1 balance')
      setLoading(false)
    }
  }, [getL1TokenManager, l1Address])

  // Get L2 balance
  const getL2Balance = useCallback(async () => {
    if (!aztecAddress || !l2TokenContract) {
      logger.warn('Missing required dependencies for L2 balance check')
      return
    }
    try {
      logger.info('Fetching L2 balance...')
      setLoading(true)
      const balance = await l2TokenContract.methods
        .balance_of_public(AztecAddress.fromString(aztecAddress))
        .simulate()

      logger.info('Retrieved L2 balance', { balance: balance.toString() })
      setL2Balance(balance.toString())
      setLoading(false)
      return balance
    } catch (e) {
      logger.error('Failed to fetch L2 balance', { error: e })
      setError('Failed to fetch L2 balance')
      setLoading(false)
    }
  }, [aztecAddress, l2TokenContract])

  // getL1Balance
  useEffect(() => {
    if (
      !l1Address ||
      !isL1Connected ||
      !l1ContractAddresses ||
      !getL1TokenManager
    ) {
      logger.warn('Missing dependencies for L1 balance effect')
      return
    }
    getL1Balance()
  }, [
    l1Address,
    getL1Balance,
    isL1Connected,
    l1ContractAddresses,
    getL1TokenManager,
  ])

  // getL2Balance
  useEffect(() => {
    if (!aztecAddress || !l2TokenContract || !isL2Connected || !getL2Balance) {
      logger.warn('Missing dependencies for L2 balance effect')
      return
    }
    getL2Balance()
  }, [aztecAddress, l2TokenContract, getL2Balance, isL2Connected])

  const mintL1Tokens = async () => {
    if (!walletClient || !l1ContractAddresses || !l1Address) {
      logger.warn('Missing dependencies for L1 token minting')
      return
    }
    try {
      logger.info('Starting L1 token minting process...')
      setLoading(true)
      setError(null)
      const l1TokenManager = getL1TokenManager()
      if (!l1TokenManager) throw new Error('L1TokenManager not ready')
      const mintAmount = await l1TokenManager.getMintAmount()
      logger.info('Retrieved mint amount', { mintAmount: mintAmount.toString() })

      logger.info('Initiating mint transaction...')
      const minting = await l1TokenManager.mint(l1Address)
      logger.info('Mint transaction sent')

      logger.info('Waiting for transaction confirmation...')
      await new Promise((resolve) => setTimeout(resolve, 5000))

      const newL1Balance = await getL1Balance()
      logger.info('Minting completed', {
        newBalance: newL1Balance?.toString(),
        address: l1Address,
      })

      setLoading(false)
    } catch (e: any) {
      logger.error('Failed to mint L1 tokens', { error: e })
      setError(e.message || 'Failed to mint L1 tokens')
      setLoading(false)
    }
  }

  // Bridge tokens to L2
  const bridgeTokensToL2 = useCallback(
    async (amount: bigint) => {
      if (!l1Address || !aztecAccount) {
        console.log('Missing required accounts for bridging')
        setError('L1 or L2 account not ready')
        return
      }
      console.log('Starting bridge to L2 process...', { amount: amount.toString() })
      setLoading(true)
      setError(null)
      try {
        const manager = getL1PortalManager()
        if (!manager) {
          console.log('L1TokenPortalManager not ready')
          setLoading(false)
          return
        }
        if (!aztecAddress) {
          console.log('L2 address not ready')
          setLoading(false)
          return
        }

        if (!l2TokenContract) {
          console.log('L2 token contract not ready')
          setLoading(false)
          return
        }
        if (!l2BridgeContract) {
          console.log('L2 bridge contract not ready')
          setLoading(false)
          return
        }

        console.log('Initiating bridge tokens to L2...')
        const claim = await manager.bridgeTokensPublic(
          AztecAddress.fromString(aztecAddress),
          amount,
          false // mint
        )

        const claimSecret = claim.claimSecret
        const messageLeafIndex = claim.messageLeafIndex
        console.log({
          claimSecret: claimSecret.toString(),
          messageLeafIndex: messageLeafIndex.toString(),
        })

        console.log('Preparing L2 transactions...')

        console.log('Waiting 2 minutes before proceeding...')
        await new Promise(resolve => setTimeout(resolve, 120000)) // 2 minute wait

        console.log('claim_public  transaction...')
        const claimReceipt = await l2BridgeContract.methods
          .claim_public(
            AztecAddress.fromString(aztecAddress),
            amount,
            claim.claimSecret,
            claim.messageLeafIndex
          )
          .send()
          .wait({timeout: 200000})

        console.log('claim_public  transaction completed', { claimReceipt })
        console.log('claimReceipt.txHash.toString() ', claimReceipt.txHash.toString());

        logger.info('Updating balances...')
        await getL1Balance()
        await getL2Balance()

        setLoading(false)
        return claim
      } catch (e: any) {
        logger.error('Failed to bridge tokens to L2', { error: e })
        setError(e.message || 'Failed to bridge tokens to L2')
        setLoading(false)
      }
    },
    [
      l1Address,
      aztecAccount,
      getL1PortalManager,
      aztecAddress,
      l2TokenContract,
      l2BridgeContract,
      getL1Balance,
      getL2Balance,
    ]
  )

  // Withdraw tokens to L1 (full flow)
  const withdrawTokensToL1 = useCallback(
    async (amount: bigint) => {
      if (!aztecAccount || !l2TokenContract || !l2BridgeContract || !l1Address) {
        logger.warn('Missing required dependencies for withdrawal')
        return
      }
      logger.info('Starting withdrawal to L1 process...', { amount: amount.toString() })
      setLoading(true)
      setError(null)

      const isPrivate = true
      const withAuthWitness = true  
      try {
        logger.info('Generating nonce for withdrawal...')
        const nonce = Fr.random()

        logger.info('Setting up authorization...')
        let authwitRequests: IntentAction[] | undefined = undefined
        if (withAuthWitness) {
          authwitRequests = [
            {
              caller: l2BridgeContract.address,
              action: await l2TokenContract.methods.burn_public(
                AztecAddress.fromString(aztecAccount.address.toString()),
                amount,
                nonce
              )
                .request(),
            },
          ]
        }
        console.log("authwitRequests: ", authwitRequests)

        logger.info('Authorization completed')

        logger.info('Getting L1 portal manager...')
        const manager = getL1PortalManager()
        if (!manager) throw new Error('L1TokenPortalManager not ready')

        logger.info('Getting L2 to L1 message...')
        const l2ToL1Message = await manager.getL2ToL1MessageLeaf(
          amount,
          EthAddress.fromString(l1Address),
          l2BridgeContract.address,
          EthAddress.ZERO
        )
        logger.info('Retrieved L2 to L1 message', { message: l2ToL1Message })

        logger.info('Initiating exit to L1...')
        const l2TxReceipt = await l2BridgeContract.methods
          .exit_to_l1_public(
            EthAddress.fromString(l1Address),
            amount,
            EthAddress.ZERO,
            nonce,
            { authWitnesses: authwitRequests }
          )
          .send()
          .wait({
            timeout: 200000,
          })
        logger.info('Exit to L1 transaction completed', { txReceipt: l2TxReceipt })

        console.log("l2TxReceipt.txHash.toString() ", l2TxReceipt.txHash.toString());

        logger.info('Getting L2 to L1 message membership witness...')
        const [l2ToL1MessageIndex, siblingPath] =
          await aztecAccount?.aztecNode.getL2ToL1MessageMembershipWitness(
            Number(l2TxReceipt.blockNumber!),
            l2ToL1Message
          )
        logger.info('Retrieved membership witness', {
          messageIndex: l2ToL1MessageIndex,
          siblingPath: siblingPath.toString()
        })

        logger.info('Initiating withdrawal on L1...')
        await manager.withdrawFunds(
          amount,
          EthAddress.fromString(l1Address),
          BigInt(l2TxReceipt.blockNumber!),
          l2ToL1MessageIndex,
          siblingPath
        )
        logger.info('Withdrawal completed successfully')
        setLoading(false)
      } catch (e: any) {
        logger.error('Failed to withdraw tokens to L1', { error: e })
        setError(e.message || 'Failed to withdraw tokens to L1')
        setLoading(false)
      }
    },
    [
      aztecAccount,
      l2TokenContract,
      l2BridgeContract,
      l1Address,
      getL1PortalManager,
    ]
  )

  // Get L2 to L1 membership witness (PXE)
  const getL2ToL1MessageMembershipWitness = useCallback(
    async (blockNumber: bigint, l2ToL1Message: any) => {
      logger.info('Getting L2 to L1 message membership witness...', {
        blockNumber: blockNumber.toString(),
        message: l2ToL1Message.toString()
      })
      return await aztecAccount?.aztecNode.getL2ToL1MessageMembershipWitness(
        Number(blockNumber),
        l2ToL1Message
      )
    },
    [aztecAccount]
  )

  return {
    loading,
    error,
    l1Balance,
    l2Balance,
    getL1Balance,
    getL2Balance,
    bridgeTokensToL2,
    withdrawTokensToL1,
    getL2ToL1MessageMembershipWitness,
    mintL1Tokens,
  }
}
