import { useState, useCallback, useEffect } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { ADDRESS } from '@/config'
import { useAccount as useAztecAccount } from '@nemi-fi/wallet-sdk/react'
import { sdk, pxe } from '@/aztec'
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

import {
  BatchCall,
  type IntentAction,
  Contract,
} from '@nemi-fi/wallet-sdk/eip1193'
import { L1ContractAddresses } from '@aztec/ethereum'

class L2SponseredFPC extends Contract.fromAztec(SponsoredFPCContract) {}
class L2Token extends Contract.fromAztec(TokenContract) {}
class L2TokenBridge extends Contract.fromAztec(TokenBridgeContract) {}

export function useBridgeV3() {
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

  // State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [l1ContractAddresses, setL1ContractAddresses] =
    useState<L1ContractAddresses | null>(null)

  const [l1Balance, setL1Balance] = useState<string>('0')
  const [l2Balance, setL2Balance] = useState<string>('0')
  const [l2TokenContract, setL2TokenContract] = useState<L2Token | null>(null)
  const [l2BridgeContract, setL2BridgeContract] =
    useState<L2TokenBridge | null>(null)
  // console.log('l2TokenContract ', l2TokenContract)
  // console.log('l2BridgeContract ', l2BridgeContract)
  // const [paymentMethod, setPaymentMethod] =
  //   useState<SponsoredFeePaymentMethod | null>(null)

  // Logger
  const logger = createLogger('aztec:token-bridge:webapp')



  // Setup L2 contract instances when aztecAccount is available
  useEffect(() => {
    async function setupContracts() {
      if (!aztecAccount || !L2Token || !L2TokenBridge) return
    
        const l1ContractAddresses =
          await aztecAccount.aztecNode.getL1ContractAddresses()
        setL1ContractAddresses(l1ContractAddresses)
  
        const token = await L2Token.at(
          AztecAddress.fromString(ADDRESS[1337].L2.TOKEN_CONTRACT),
          aztecAccount
        )
        setL2TokenContract(token)
  
        const bridge = await L2TokenBridge.at(
          AztecAddress.fromString(ADDRESS[1337].L2.TOKEN_BRIDGE_CONTRACT),
          aztecAccount
        )
        setL2BridgeContract(bridge)
  
        // const [nameResponse, symbolResponse, decimals] = await Promise.all([
        //   token.methods.public_get_name({}).simulate(),
        //   token.methods.public_get_symbol({}).simulate(),
        //   token.methods.public_get_decimals().simulate(),
        // ])
        // console.log("nameResponse ", nameResponse);
  
        // const name = readFieldCompressedString(nameResponse as any)
        // const symbol = readFieldCompressedString(symbolResponse as any)
  
        // console.log({
        //   name,
        //   // symbol,
        //   // decimals,
        // })
  
        // const sponsoredFPC = await L2SponseredFPC.at(
        //   AztecAddress.fromString(ADDRESS[1337].L2.SPONSORED_FEE_PAYMENT_CONTRACT),
        //   aztecAccount
        // )
  
        // const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address)
  
        // setPaymentMethod(paymentMethod)
        // console.log({
        //   Registry: l1ContractAddresses.registryAddress.toString(),
        //   Inbox: l1ContractAddresses.inboxAddress.toString(),
        //   Outbox: l1ContractAddresses.outboxAddress.toString(),
        //   Rollup: l1ContractAddresses.rollupAddress.toString(),
        // })
      
    }
    if (aztecAccount && L2Token && L2TokenBridge) {
      setupContracts()
    }
  }, [aztecAccount])
  
  useEffect(() => {
    const loadToken = async () => {
      if (
        aztecAccount &&
        l2TokenContract &&
        l2BridgeContract
      ) {

        console.log("fetching bridge contract info...")
        console.time("1")
        const config = await l2BridgeContract?.methods.get_config_public({}).simulate()
        console.log("config ", config);
        console.timeEnd("1")

        console.log("fetching token contract info...")
        console.time("2")
        const [nameResponse, symbolResponse, decimals] = await Promise.all([
          l2TokenContract.methods.public_get_name({}).simulate(),
          l2TokenContract.methods.public_get_symbol({}).simulate(),
          l2TokenContract.methods.public_get_decimals().simulate(),
        ])
        const name = readFieldCompressedString(nameResponse as any)
        const symbol = readFieldCompressedString(symbolResponse as any)
        
        
        
        console.log("name ", name);
        console.log("symbol ", symbol);
        console.log("decimals ", decimals);
        console.timeEnd("2")
      } 
    }

    loadToken()
  }, [l2TokenContract, l2BridgeContract])

  // L1TokenPortalManager instance
  const getL1PortalManager = useCallback(() => {
    if (
      !publicClient ||
      !walletClient ||
      !l1ContractAddresses?.outboxAddress.toString()
    )
      return null

    return new L1TokenPortalManager(
      EthAddress.fromString(ADDRESS[11155111].L1.PORTAL_CONTRACT),
      EthAddress.fromString(ADDRESS[11155111].L1.TOKEN_CONTRACT),
      EthAddress.fromString(ADDRESS[11155111].L1.FEE_ASSET_HANDLER_CONTRACT),
      EthAddress.fromString(l1ContractAddresses?.outboxAddress.toString()),
      // @ts-ignore
      publicClient,
      walletClient,
      logger
    )
  }, [publicClient, walletClient, l1ContractAddresses])

  // L1TokenManager instance
  const getL1TokenManager = useCallback(() => {
    if (!publicClient || !walletClient) return null
    return new L1TokenManager(
      EthAddress.fromString(ADDRESS[11155111].L1.TOKEN_CONTRACT),
      EthAddress.fromString(ADDRESS[11155111].L1.FEE_ASSET_HANDLER_CONTRACT),
      // @ts-ignore
      publicClient,
      walletClient,
      logger
    )
  }, [publicClient, walletClient])

  // Get L1 balance
  const getL1Balance = useCallback(async () => {
    if (!l1Address) return
    try {
      setLoading(true)
      const manager = getL1TokenManager()
      if (!manager) throw new Error('L1TokenManager not ready')
      const balance = await manager.getL1TokenBalance(l1Address)
      setL1Balance(balance.toString())
      setLoading(false)
      return balance
    } catch (e) {
      console.log('e ', e)
      setError('Failed to fetch L1 balance')
      setLoading(false)
    }
  }, [l1Address, getL1TokenManager])

  // Get L2 balance
  const getL2Balance = useCallback(async () => {
    if (!aztecAddress || !l2TokenContract) return
    try {
      setLoading(true)
      const balance = await l2TokenContract.methods
        .balance_of_public(AztecAddress.fromString(aztecAddress))
        .simulate()
 console.log("balance ", balance);

      setL2Balance(balance.toString())
      setLoading(false)
      return balance
    } catch (e) {
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
    )
      return
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
    if (!aztecAddress || !l2TokenContract || !isL2Connected || !getL2Balance)
      return
    getL2Balance()
  }, [aztecAddress, l2TokenContract, getL2Balance, isL2Connected])

  const mintL1Tokens = async () => {
    if (!walletClient || !l1ContractAddresses || !l1Address) return
    try {
      setLoading(true)
      setError(null)
      const l1TokenManager = getL1TokenManager()
      if (!l1TokenManager) throw new Error('L1TokenManager not ready')
      const mintAmount = await l1TokenManager.getMintAmount()
      const minting = await l1TokenManager.mint(l1Address)
      // wait for few seconds
      // const newL1Balance = await getL1Balance()
      // console.log(
      //   `after minting, L1 balance of ${l1Address} is ${newL1Balance}`
      // )
      setLoading(false)
    } catch (e: any) {
      setError(e.message || 'Failed to mint L1 tokens')
      setLoading(false)
    }
  }

  // Bridge tokens to L2
  const bridgeTokensToL2 = useCallback(
    async (amount: bigint) => {
      if (!l1Address || !aztecAccount) {
        setError('L1 or L2 account not ready')
        return
      }
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

      // const name = await l2TokenContract.methods.public_get_name({}).simulate()
      // console.log("name ", name);

        console.log("l2TokenContract ", l2TokenContract);
        console.log('l2BridgeContract ', l2BridgeContract)

        // setupContracts()
        // return

        // console.log('Bridge tokens to L2')
        // const claim = await manager.bridgeTokensPublic(
        //   AztecAddress.fromString(aztecAddress),
        //   amount,
        //   false // mint
        // )
        //  console.log("claim ", claim);

        const claim = {
          claimSecret: Fr.fromString(
            '0x25b8e3da10a424e8afbfa9e0da015dccbb695d3b38054b7116e161007772eeee'
          ),
          messageLeafIndex: BigInt('246848'),
        }
        const claimSecret = claim.claimSecret
        const messageLeafIndex = claim.messageLeafIndex
        // console.log({
        //   claimSecret: claimSecret.toString(),
        //   messageLeafIndex: messageLeafIndex.toString(),
        // })

        // console.log("l2TokenContract ", l2TokenContract);
        console.log('Do 2 unrleated actions because - mint_to_public')
        // Do 2 unrleated actions because
        // https://github.com/AztecProtocol/aztec-packages/blob/7e9e2681e314145237f95f79ffdc95ad25a0e319/yarn-project/end-to-end/src/shared/cross_chain_test_harness.ts#L354-L355

        // await l2TokenContract.methods
        //   .mint_to_public(AztecAddress.fromString(aztecAddress), BigInt(0))
        //   .send()
        //   .wait()
        // await l2TokenContract.methods
        //   .mint_to_public(AztecAddress.fromString(aztecAddress), BigInt(0))
        //   .send()
        //   .wait()

        // console.log('claiming tokens on l2 - claim_public');

        // await l2BridgeContract.methods
        //   .claim_public(
        //     AztecAddress.fromString(aztecAddress),
        //     amount,
        //     claim.claimSecret,
        //     claim.messageLeafIndex
        //     // Fr.fromString(claim.claimSecret),
        //     // BigInt(claim.messageLeafIndex)
        //   )
        //   .send()
        //   .wait()

        // const mintPrivateTx = await l2TokenContract.methods
        //   .mint_to_private(AztecAddress.fromString(aztecAddress), AztecAddress.fromString(aztecAddress), BigInt(0))
        //   .request()

        const mintPublicTx1 = await l2TokenContract.methods
          .mint_to_public(AztecAddress.fromString(aztecAddress), BigInt(0))
          .request()
        const mintPublicTx2 = await l2TokenContract.methods
          .mint_to_public(AztecAddress.fromString(aztecAddress), BigInt(0))
          .request()

        console.log('claiming tokens on l2 - claim_public')

        const claimPublic = await l2BridgeContract.methods
          .claim_public(
            AztecAddress.fromString(aztecAddress),
            amount,
            claim.claimSecret,
            claim.messageLeafIndex
          )
          .request()
          // .request()

        console.log('Batch Call')

        const batchedTx = new BatchCall(aztecAccount, [
          mintPublicTx1,
          mintPublicTx2,
          claimPublic,
        ])
        const batchedTxHash = await batchedTx.send().wait({
          timeout: 200000,
        })
        console.log('batchedTxHash: ', batchedTxHash)

        await getL1Balance()
        await getL2Balance()

        setLoading(false)
        return claim
      } catch (e: any) {
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
      getL2Balance
    ]
  )

  // Withdraw tokens to L1 (full flow)
  const withdrawTokensToL1 = useCallback(
    async (amount: bigint) => {
      if (!aztecAccount || !l2TokenContract || !l2BridgeContract || !l1Address)
        return
      setLoading(true)
      setError(null)
      try {
        // 1. Generate a random nonce
        const nonce = Fr.random()
        // 2. Approve bridge to burn funds
      // @ts-ignore
        if (typeof aztecAccount.setPublicAuthWit !== 'function')
          throw new Error('aztecAccount does not support setPublicAuthWit')
      // @ts-ignore
        const authwit = await aztecAccount.setPublicAuthWit(
          {
            caller: l2BridgeContract.address,
            action: l2TokenContract.methods.burn_public(
              AztecAddress.fromString(aztecAccount.address.toString()),
              amount,
              nonce
            ),
          },
          true
        )
        await authwit.send().wait()
        // 3. Get L1 portal manager
        const manager = getL1PortalManager()
        if (!manager) throw new Error('L1TokenPortalManager not ready')
        // 4. Get L2 to L1 message
        const l2ToL1Message = await manager.getL2ToL1MessageLeaf(
          amount,
          EthAddress.fromString(l1Address),
          l2BridgeContract.address,
          EthAddress.ZERO
        )
        // 5. Exit to L1
        const l2TxReceipt = await l2BridgeContract.methods
          .exit_to_l1_public(
            EthAddress.fromString(l1Address),
            amount,
            EthAddress.ZERO,
            nonce
          )
          .send()
          .wait()
        // 6. Wait for message to be available on L1
        const [l2ToL1MessageIndex, siblingPath] =
          await pxe.getL2ToL1MessageMembershipWitness(
            Number(l2TxReceipt.blockNumber!),
            l2ToL1Message
          )
        // 7. Call withdrawFunds on L1TokenPortalManager
        await manager.withdrawFunds(
          amount,
          EthAddress.fromString(l1Address),
          BigInt(l2TxReceipt.blockNumber!),
          l2ToL1MessageIndex,
          siblingPath
        )
        setLoading(false)
      } catch (e: any) {
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
