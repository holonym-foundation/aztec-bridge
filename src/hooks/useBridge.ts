import { useState } from 'react'
import {
  setupSandbox,
  deployTestERC20,
  deployTokenPortal,
  deployBridge,
  deployFeeAssetHandler,
  addMinter,
  setupFeeJuice,
  withdrawTokens,
  FEE_FUNDING_FOR_TESTER_ACCOUNT,
  MINT_AMOUNT,
  deployPortalSBT,
} from '@/utils/bridge'
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  PublicClient,
  WalletClient,
} from 'viem'
import { foundry } from 'viem/chains'
import { mnemonicToAccount } from 'viem/accounts'

import {
  L1TokenPortalManager,
  PXE,
  EthAddress,
  createLogger,
  Fr,
  L1TokenManager,
  FeeJuicePaymentMethod,
} from '@aztec/aztec.js'
import { TokenContract } from '@aztec/noir-contracts.js/Token'
import { TokenBridgeContract } from '@aztec/noir-contracts.js/TokenBridge'
import { FeeJuiceContract } from '@aztec/noir-contracts.js/FeeJuice'
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'
import { TokenPortalAbi } from '@aztec/l1-artifacts/TokenPortalAbi'
import { TestERC20Abi } from '@aztec/l1-artifacts/TestERC20Abi'

import PortalSBTJson from '../constants/PortalSBT.json'
import { deployL1Contract } from '@aztec/ethereum';

// Fix the bytecode format
const PortalSBTAbi = PortalSBTJson.abi
const PortalSBTBytecode = PortalSBTJson.bytecode.object

const logger = createLogger('useBridge')

// from here: https://github.com/AztecProtocol/aztec-packages/blob/ecbd59e58006533c8885a8b2fadbd9507489300c/yarn-project/end-to-end/src/fixtures/utils.ts#L534
export function getL1WalletClient(rpcUrl: string, index: number) {
  const hdAccount = mnemonicToAccount(MNEMONIC, { addressIndex: index })
  return createWalletClient({
    account: hdAccount,
    chain: foundry,
    transport: http(rpcUrl),
  })
}

export const MNEMONIC =
  'test test test test test test test test test test test junk'

const walletClient = getL1WalletClient(foundry.rpcUrls.default.http[0], 0)

const publicClient = createPublicClient({
  chain: foundry,
  transport: http('http://127.0.0.1:8545'),
})

interface BridgeState {
  loading: boolean
  status: string
  pxe: PXE | null
  l1WalletAddress: string | null
  l2WalletAddress: string | null
  l1TokenContract: string | null
  l2TokenContract: TokenContract | null
  l1PortalContractAddress: string | null
  l1Portal: ReturnType<typeof getContract> | null
  l1PortalSBTContract: ReturnType<typeof getContract> | null
  bridgeContract: TokenBridgeContract | null
  walletClient: WalletClient | null
  publicClient: PublicClient | null
  l2Wallets: Array<
    ReturnType<typeof getInitialTestAccountsWallets>[number]
  > | null
  l1ContractAddresses: Record<string, unknown> | null
  feeAssetHandler: string | null
  feeJuice: FeeJuiceContract | null
  feeJuicePaymentMethod: FeeJuicePaymentMethod | null
  setupProgress: number
  setupError: string | null
  setupComplete: boolean
  l1Balance: string
  l2Balance: string
}

export const useBridge = () => {
  const [state, setState] = useState<BridgeState>({
    loading: false,
    status: '',
    pxe: null,
    l1WalletAddress: null,
    l2WalletAddress: null,
    l1TokenContract: null,
    l2TokenContract: null,
    l1PortalContractAddress: null,
    l1Portal: null,
    l1PortalSBTContract: null,
    bridgeContract: null,
    walletClient: null,
    publicClient: null,
    l2Wallets: null,
    l1ContractAddresses: null,
    feeAssetHandler: null,
    feeJuice: null,
    feeJuicePaymentMethod: null,
    setupProgress: 0,
    setupError: null,
    setupComplete: false,
    l1Balance: '0',
    l2Balance: '0',
  })

  const updateState = (updates: Partial<BridgeState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms))

  const setupEverything = async () => {
    try {

      // Initialize state to show we're starting the process
      updateState({
        loading: true,
        status: 'Starting complete setup...',
        setupProgress: 1,
        setupError: null,
      })

      try {
        // 1. Setup the sandbox
        updateState({ status: 'Setting up sandbox...' })
        const pxe = await setupSandbox()
        const wallets = await getInitialTestAccountsWallets(pxe)
        const l1ContractAddresses = (await pxe.getNodeInfo())
          .l1ContractAddresses

        // Update progress indicator only
        updateState({ setupProgress: 2 })

        // 2. Deploy L2 token
        updateState({ status: 'Deploying L2 token...' })
        const ownerWallet = wallets[0]
        const ownerAztecAddress = wallets[0].getAddress()

        const l2TokenContract = await TokenContract.deploy(
          ownerWallet,
          ownerAztecAddress,
          'L2 Token',
          'L2',
          18
        )
          .send()
          .deployed()

        // Update progress indicator only
        updateState({ setupProgress: 3 })

        // 3. Setup Fee Juice
        updateState({ status: 'Setting up Fee Juice...' })
        const { feeJuice, feeJuicePaymentMethod } = await setupFeeJuice(
          pxe,
          publicClient,
          walletClient,
          ownerWallet,
          ownerAztecAddress
        )

        // Update progress indicator only
        updateState({ setupProgress: 4 })

        // 4. Deploy L1 token
        updateState({ status: 'Deploying L1 token & fee asset handler...' })
        const l1Token = await deployTestERC20(walletClient, publicClient)

        // Deploy fee asset handler
        const feeAssetHandlerAddress = await deployFeeAssetHandler(
          walletClient,
          publicClient,
          l1Token
        )

        // Add fee asset handler as minter for the L1 token
        await addMinter(walletClient, l1Token, feeAssetHandlerAddress)

        // Update progress indicator only
        updateState({ setupProgress: 5 })

        // 5. Deploy Portal
        updateState({ status: 'Deploying portal...' })
        const l1PortalContractAddress = await deployTokenPortal(
          walletClient,
          publicClient
        )
 console.log("l1PortalContractAddress ", l1PortalContractAddress);


        const l1Portal = getContract({
          address: l1PortalContractAddress.toString(),
          abi: TokenPortalAbi,
          client: walletClient,
        })

        // Update progress indicator only
        updateState({ setupProgress: 6 })

        // 6. Deploy Bridge Contract
        updateState({ status: 'Deploying bridge contract...' })
        const bridge = await deployBridge(
          ownerWallet,
          l2TokenContract.address,
          EthAddress.fromString(l1PortalContractAddress.toString()),
          feeJuicePaymentMethod
        )

        // Update progress indicator only
        // updateState({ setupProgress: 7 })

        // Set bridge as minter
        await l2TokenContract.methods
          .set_minter(bridge.address, true)
          .send()
          .wait()

        // Initialize L1 portal contract
        await l1Portal.write.initialize(
          [
            l1ContractAddresses.registryAddress.toString(),
            l1Token.toString(),
            bridge.address.toString(),
          ],
          {}
        )
        // Mint L1 tokens

        const ownerEthAddress = walletClient.account?.address
        const l1TokenManager = new L1TokenManager(
          EthAddress.fromString(l1Token.toString()),
          EthAddress.fromString(feeAssetHandlerAddress.toString()),
          publicClient,
          walletClient,
          logger
        )

        const mintAmount = await l1TokenManager.getMintAmount()
        const minting = await l1TokenManager.mint(ownerEthAddress)


        updateState({ status: 'Deploying Portal SBT...', setupProgress: 7 })
        const l1PortalSBTContractAddress = await deployPortalSBT(
          walletClient,
          publicClient,
        )

        console.log("l1PortalSBTContractAddress ", l1PortalSBTContractAddress);


        const l1PortalSBTContract = getContract({
          address: l1PortalSBTContractAddress.toString(),
          abi: PortalSBTAbi,
          client: walletClient,
        })


        updateState({
          pxe,
          walletClient,
          publicClient,
          l1WalletAddress: ownerEthAddress,
          l2WalletAddress: ownerAztecAddress.toString(),
          l2Wallets: wallets,
          l1ContractAddresses,
          l2TokenContract,
          feeJuice,
          feeJuicePaymentMethod,
          l1TokenContract: l1Token.toString(),
          feeAssetHandler: feeAssetHandlerAddress.toString(),
          l1PortalContractAddress: l1PortalContractAddress.toString(),
          l1Portal,
          l1PortalSBTContract,
          bridgeContract: bridge,
          status: 'Contracts setup complete! Ready to bridge tokens.',
          loading: false,
          setupProgress: 8,
          setupComplete: true,
          l1Balance: mintAmount.toString(),
          l2Balance: '0',
        })
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        logger.error(`Setup failed: ${errorMessage}`, error)
        updateState({
          status: `Setup failed: ${errorMessage}`,
          loading: false,
          setupError: errorMessage,
        })
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error('Failed during setup:', error)
      updateState({
        status: 'Setup failed',
        loading: false,
        setupError: errorMessage,
      })
    }
  }

  const setup = async () => {
    try {
      // Setup
      updateState({ loading: true, status: 'Setting up sandbox...' })

      const pxe = await setupSandbox()
      const wallets = await getInitialTestAccountsWallets(pxe)
      const l1ContractAddresses = (await pxe.getNodeInfo()).l1ContractAddresses

      updateState({
        pxe: pxe,
        walletClient: walletClient,
        publicClient: publicClient,
        status: 'Sandbox setup complete',
        loading: false,
        l2Wallets: wallets,
        l1ContractAddresses,
      })
    } catch (error) {
      logger.error('Failed to setup sandbox:', error)
      updateState({ status: 'Failed to setup sandbox', loading: false })
    }
  }

  const deployL2Token = async () => {
    try {
      // Deploy L2 token contract
      updateState({ loading: true, status: 'Deploying L2 token contract...' })
      if (!state.pxe || !state.l2Wallets)
        throw new Error('PXE or wallets not initialized')

      const ownerWallet = state.l2Wallets[0]
      const ownerAztecAddress = state.l2Wallets[0].getAddress()

      const l2TokenContract = await TokenContract.deploy(
        ownerWallet,
        ownerAztecAddress,
        'L2 Token',
        'L2',
        18
      )
        .send()
        .deployed()

      updateState({
        l2TokenContract,
        status: 'L2 token deployed successfully',
        loading: false,
      })
    } catch (error) {
      logger.error('Failed to deploy L2 token:', error)
      updateState({ status: 'Failed to deploy L2 token', loading: false })
    }
  }

  const setupFeeJuiceForL2 = async () => {
    try {
      updateState({ loading: true, status: 'Setting up fee juice for L2...' })
      if (
        !state.pxe ||
        !state.publicClient ||
        !state.walletClient ||
        !state.l2Wallets
      )
        throw new Error('Required components not initialized')

      const ownerWallet = state.l2Wallets[0]
      const ownerAztecAddress = state.l2Wallets[0].getAddress()

      const { feeJuice, feeJuicePaymentMethod } = await setupFeeJuice(
        state.pxe,
        state.publicClient,
        state.walletClient,
        ownerWallet,
        ownerAztecAddress
      )

      updateState({
        feeJuice,
        feeJuicePaymentMethod,
        status: 'Fee juice setup complete',
        loading: false,
      })
    } catch (error) {
      logger.error('Failed to setup fee juice:', error)
      updateState({ status: 'Failed to setup fee juice', loading: false })
    }
  }

  const deployL1Token = async () => {
    try {
      // Deploy L1 token contract & mint tokens
      updateState({
        loading: true,
        status: 'Deploy L1 token contract & mint tokens',
      })
      if (!state.walletClient || !state.publicClient)
        throw new Error('Clients not initialized')

      const l1Token = await deployTestERC20(
        state.walletClient,
        state.publicClient
      )

      // Deploy fee asset handler
      const feeAssetHandlerAddress = await deployFeeAssetHandler(
        state.walletClient,
        state.publicClient,
        l1Token
      )

      // Add fee asset handler as minter for the L1 token
      await addMinter(state.walletClient, l1Token, feeAssetHandlerAddress)

      updateState({
        l1TokenContract: l1Token.toString(),
        feeAssetHandler: feeAssetHandlerAddress.toString(),
        status: 'L1 token and fee asset handler deployed successfully',
        loading: false,
      })
    } catch (error) {
      logger.error('Failed to deploy L1 token:', error)
      updateState({ status: 'Failed to deploy L1 token', loading: false })
    }
  }

  const deployPortal = async () => {
    try {
      // Deploy L1 portal contract
      updateState({
        loading: true,
        status: 'Deploying token portal contract...',
      })
      if (!state.walletClient || !state.publicClient)
        throw new Error('Clients not initialized')

      const l1PortalContractAddress = await deployTokenPortal(
        state.walletClient,
        state.publicClient
      )

      const l1Portal = getContract({
        address: l1PortalContractAddress.toString(),
        abi: TokenPortalAbi,
        client: state.walletClient,
      })

      updateState({
        l1PortalContractAddress: l1PortalContractAddress.toString(),
        status: 'Portal deployed successfully',
        loading: false,
        l1Portal,
      })
    } catch (error) {
      logger.error('Failed to deploy portal:', error)
      updateState({ status: 'Failed to deploy portal', loading: false })
    }
  }

  const deployBridgeContract = async () => {
    try {
      updateState({ loading: true, status: 'Deploying bridge contract...' })
      if (
        !state.pxe ||
        !state.l2TokenContract ||
        !state.l1PortalContractAddress ||
        !state.l2Wallets
      ) {
        throw new Error('Required contracts or wallets not initialized')
      }

      const ownerWallet = state.l2Wallets[0]

      const bridge = await deployBridge(
        ownerWallet,
        state.l2TokenContract.address,
        EthAddress.fromString(state.l1PortalContractAddress),
        state.feeJuicePaymentMethod || undefined
      )

      updateState({
        bridgeContract: bridge,
        status: 'Bridge deployed successfully',
        loading: false,
      })

      // set bridge as minter
      await state.l2TokenContract.methods
        .set_minter(bridge.address, true)
        .send()
        .wait()
      updateState({ status: 'Minter set successfully', loading: false })
    } catch (error) {
      logger.error('Failed to deploy bridge:', error)
      updateState({ status: 'Failed to deploy bridge', loading: false })
    }
  }

  const bridgeTokensToL2 = async (customAmount?: bigint) => {
    try {
      updateState({ loading: true, status: 'Bridging tokens...' })
      if (
        !state.pxe ||
        !state.l1PortalContractAddress ||
        !state.l1TokenContract ||
        !state.publicClient ||
        !state.walletClient ||
        !state.l2TokenContract ||
        !state.bridgeContract ||
        !state.l1ContractAddresses ||
        !state.l2Wallets ||
        !state.feeAssetHandler ||
        !state.l1Portal
      ) {
        throw new Error('Required contracts or clients not initialized')
      }

      const ownerAztecAddress = state.l2Wallets[0].getAddress()

      // // Initialize L1 portal contract
      // await state.l1Portal.write.initialize(
      //   [
      //     state.l1ContractAddresses.registryAddress.toString(),
      //     state.l1TokenContract,
      //     state.bridgeContract.address.toString(),
      //   ],
      //   {}
      // )
      // logger.info('L1 portal contract initialized')

      const l1PortalManager = new L1TokenPortalManager(
        EthAddress.fromString(state.l1PortalContractAddress),
        EthAddress.fromString(state.l1TokenContract),
        EthAddress.fromString(state.feeAssetHandler),
        state.l1ContractAddresses.outboxAddress,
        state.publicClient,
        state.walletClient,
        logger
      )

      // const l1Balance = await getL1TokenBalance();
      // logger.info(`L1 balance is ${l1Balance}`);

      // // await getL1TokenBalance();
      // logger.info('Minting tokens...')
      // const mintAmount = await l1TokenManager.getMintAmount();
      // const minting = await l1TokenManager.mint(ownerEthAddress);
      // const newL1Balance = await getL1TokenBalance(ownerEthAddress);
      // logger.info(`after minting, L1 balance of ${ownerEthAddress} is ${newL1Balance}`);

      // Use customAmount if provided, otherwise default to MINT_AMOUNT
      const amountToBridge = customAmount || MINT_AMOUNT
      logger.info(`amountToBridge ${amountToBridge}`)

      const claim = await l1PortalManager.bridgeTokensPublic(
        ownerAztecAddress,
        amountToBridge,
        false
      )

      // Do 2 unrelated actions because of this requirement:
      // https://github.com/AztecProtocol/aztec-packages/blob/7e9e2681e314145237f95f79ffdc95ad25a0e319/yarn-project/end-to-end/src/shared/cross_chain_test_harness.ts#L354-L355
      await state.l2TokenContract.methods
        .mint_to_public(ownerAztecAddress, BigInt(0))
        .send()
        .wait()
      await state.l2TokenContract.methods
        .mint_to_public(ownerAztecAddress, BigInt(0))
        .send()
        .wait()

      await state.bridgeContract.methods
        .claim_public(
          ownerAztecAddress,
          amountToBridge,
          claim.claimSecret,
          claim.messageLeafIndex
        )
        .send()
        .wait()

      const balance = await state.l2TokenContract.methods
        .balance_of_public(ownerAztecAddress)
        .simulate()
      logger.info(`Public L2 balance of ${ownerAztecAddress} is ${balance}`)

      const l1BalanceAfterBridge = await getL1TokenBalance()
      logger.info(`L1 balance after bridge is ${l1BalanceAfterBridge}`)

      updateState({
        status: 'Tokens bridged successfully',
        loading: false,
        l2Balance: balance.toString(),
      })
    } catch (error) {
      logger.error('Failed to bridge tokens:', error)
      updateState({ status: 'Failed to bridge tokens', loading: false })
    }
  }

  const withdrawTokensToL1 = async (customAmount?: bigint) => {
    try {
      updateState({ loading: true, status: 'Withdrawing tokens...' })
      if (
        !state.pxe ||
        !state.l1PortalContractAddress ||
        !state.l1TokenContract ||
        !state.publicClient ||
        !state.walletClient ||
        !state.bridgeContract ||
        !state.l2TokenContract ||
        !state.l2Wallets ||
        !state.l1ContractAddresses ||
        !state.feeAssetHandler
      ) {
        throw new Error('Required contracts or clients not initialized')
      }

      const ownerWallet = state.l2Wallets[0]
      const ownerAztecAddress = state.l2Wallets[0].getAddress()
      const ownerEthAddress = state.walletClient.account?.address
      if (!ownerEthAddress)
        throw new Error('Wallet client has no account address')

      const withdrawAmount = customAmount || BigInt(9)
      const nonce = Fr.random()

      // Give approval to bridge to burn owner's funds:
      const authwit = await ownerWallet.setPublicAuthWit(
        {
          caller: state.bridgeContract.address,
          action: state.l2TokenContract.methods.burn_public(
            ownerAztecAddress,
            withdrawAmount,
            nonce
          ),
        },
        true
      )
      await authwit.send().wait()

      const l1PortalManager = new L1TokenPortalManager(
        EthAddress.fromString(state.l1PortalContractAddress),
        EthAddress.fromString(state.l1TokenContract),
        EthAddress.fromString(state.feeAssetHandler),
        state.l1ContractAddresses.outboxAddress,
        state.publicClient,
        state.walletClient,
        logger
      )

      const l2ToL1Message = l1PortalManager.getL2ToL1MessageLeaf(
        withdrawAmount,
        EthAddress.fromString(ownerEthAddress),
        state.bridgeContract.address,
        EthAddress.ZERO
      )
      const l2TxReceipt = await state.bridgeContract.methods
        .exit_to_l1_public(
          EthAddress.fromString(ownerEthAddress),
          withdrawAmount,
          EthAddress.ZERO,
          nonce
        )
        .send()
        .wait()

      const newL2Balance = await state.l2TokenContract.methods
        .balance_of_public(ownerAztecAddress)
        .simulate()
      logger.info(`New L2 balance of ${ownerAztecAddress} is ${newL2Balance}`)

      const [l2ToL1MessageIndex, siblingPath] =
        await state.pxe.getL2ToL1MembershipWitness(
          await state.pxe.getBlockNumber(),
          l2ToL1Message
        )
      await l1PortalManager.withdrawFunds(
        withdrawAmount,
        EthAddress.fromString(ownerEthAddress),
        BigInt(l2TxReceipt.blockNumber!),
        l2ToL1MessageIndex,
        siblingPath
      )

      const l1TokenManager = new L1TokenManager(
        EthAddress.fromString(state.l1TokenContract),
        EthAddress.fromString(state.feeAssetHandler),
        state.publicClient,
        state.walletClient,
        logger
      )

      const newL1Balance =
        await l1TokenManager.getL1TokenBalance(ownerEthAddress)
      logger.info(`New L1 balance of ${ownerEthAddress} is ${newL1Balance}`)
      updateState({
        status: 'Tokens withdrawn successfully',
        loading: false,
        l1Balance: newL1Balance.toString(),
        l2Balance: newL2Balance.toString(),
      })
    } catch (error) {
      logger.error('Failed to withdraw tokens:', error)
      updateState({ status: 'Failed to withdraw tokens', loading: false })
    }
  }

  const getL1TokenBalance = async () => {
    if (!state.walletClient)
      throw new Error('getL1TokenBalance: Wallet client not initialized')
    if (!state.l1TokenContract)
      throw new Error('getL1TokenBalance: L1 token contract not initialized')
    if (!state.feeAssetHandler)
      throw new Error('getL1TokenBalance: Fee asset handler not initialized')
    if (!state.publicClient)
      throw new Error('getL1TokenBalance: Public client not initialized')
    if (!state.walletClient)
      throw new Error('getL1TokenBalance: Wallet client not initialized')

    const ownerEthAddress = state.walletClient.account?.address
    if (!ownerEthAddress)
      throw new Error('getL1TokenBalance: Wallet client has no account address')

    const l1TokenManager = new L1TokenManager(
      EthAddress.fromString(state.l1TokenContract),
      EthAddress.fromString(state.feeAssetHandler),
      state.publicClient,
      state.walletClient,
      logger
    )

    const l1Balance = await l1TokenManager.getL1TokenBalance(ownerEthAddress)
    updateState({ l1Balance: l1Balance.toString() })
    return l1Balance
  }

  const mintL1Tokens = async () => {
    if (!state.walletClient)
      throw new Error('mintL1Tokens: Wallet client not initialized')
    if (!state.l1TokenContract)
      throw new Error('mintL1Tokens: L1 token contract not initialized')
    if (!state.feeAssetHandler)
      throw new Error('mintL1Tokens: Fee asset handler not initialized')
    if (!state.publicClient)
      throw new Error('mintL1Tokens: Public client not initialized')
    if (!state.walletClient)
      throw new Error('mintL1Tokens: Wallet client not initialized')

    const ownerEthAddress = state.walletClient.account?.address
    if (!ownerEthAddress)
      throw new Error('mintL1Tokens: Wallet client has no account address')

    const l1TokenManager = new L1TokenManager(
      EthAddress.fromString(state.l1TokenContract),
      EthAddress.fromString(state.feeAssetHandler),
      state.publicClient,
      state.walletClient,
      logger
    )

    const mintAmount = await l1TokenManager.getMintAmount()
    const minting = await l1TokenManager.mint(ownerEthAddress)
    const newL1Balance = await getL1TokenBalance()
    logger.info(
      `after minting, L1 balance of ${ownerEthAddress} is ${newL1Balance}`
    )
  }

  /**
   * Check if a user has an SBT
   * @param address The address to check (defaults to the current wallet address)
   */
  const hasSBT = async (address?: string) => {
    if (!state.l1PortalSBTContract?.address)
      throw new Error('hasSBT: SBT contract not initialized')
    if (!state.publicClient)
      throw new Error('hasSBT: Public client not initialized')
    
    try {
      updateState({ loading: true, status: 'Checking SBT status...' })
      
      // If no address provided, use the current wallet address
      const addressToCheck = address || state.l1WalletAddress
      if (!addressToCheck)
        throw new Error('hasSBT: No address provided and wallet client has no account address')
      
      // Format both addresses as hex strings
      const formattedUserAddress = addressToCheck.toLowerCase() as `0x${string}`
      console.log("state.l1PortalSBTContract ", state.l1PortalSBTContract);

      // const formattedContractAddress = state.l1PortalSBTContract.address.toLowerCase() as `0x${string}`
      
      // // Create a contract instance with read capabilities
      // const contract = getContract({
      //   address: formattedContractAddress,
      //   abi: PortalSBTAbi,
      //   client: state.publicClient,
      // })
      
      // Call the hasSoulboundToken function
      const hasToken = await state.l1PortalSBTContract.read.hasSoulboundToken([formattedUserAddress])
      
      logger.info(`SBT status for ${addressToCheck}: ${hasToken}`)
      updateState({ 
        status: `SBT status checked: ${hasToken ? 'Has SBT' : 'No SBT'}`, 
        loading: false 
      })
      
      return hasToken
    } catch (error) {
      logger.error('Failed to check SBT status:', error)
      updateState({ 
        status: 'Failed to check SBT status', 
        loading: false 
      })
      return false
    }
  }

  /**
   * Mint an SBT for the caller
   */
  const mintSBT = async () => {
    if (!state.l1PortalSBTContract?.address)
      throw new Error('mintSBT: SBT contract not initialized')
    if (!state.walletClient)
      throw new Error('mintSBT: Wallet client not initialized')

    try {
      updateState({ loading: true, status: 'Minting SBT...' })
      

      // Call the mint function
      const tx = await state.l1PortalSBTContract.write.mint()
      if (!tx) throw new Error('Failed to mint SBT: Transaction failed')
      
      logger.info(`SBT minted successfully: ${tx}`)
      updateState({ 
        status: 'SBT minted successfully', 
        loading: false 
      })
      
      return true
    } catch (error) {
      logger.error('Failed to mint SBT:', error)
      updateState({ 
        status: 'Failed to mint SBT', 
        loading: false 
      })
      return false
    }
  }

  return {
    ...state,
    setup,
    deployL2Token,
    deployL1Token,
    deployPortal,
    deployBridgeContract,
    setupFeeJuiceForL2,
    bridgeTokensToL2,
    withdrawTokensToL1,
    setupEverything,
    getL1TokenBalance,
    mintL1Tokens,
    mintSBT,
    hasSBT,
  }
}
