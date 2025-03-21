import { useState } from 'react'
import {
  setupSandbox,
  deployTestERC20,
  deployTokenPortal,
  deployBridge,
  bridgeTokens,
  withdrawTokens,
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
  createPXEClient,
  waitForPXE,
  AccountWalletWithSecretKey,
  Fr,
  L1TokenManager,
} from '@aztec/aztec.js'
import { TokenContract } from '@aztec/noir-contracts.js/Token'
import { TokenBridgeContract } from '@aztec/noir-contracts.js/TokenBridge'
import { useWallet } from './useWallet'
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'
import { TokenPortalAbi } from '@aztec/l1-artifacts/TokenPortalAbi'
import { CleanHandsSBTContract } from '../constants/contract-interfaces/CleanHandsSBT'

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
const ownerEthAddress = walletClient.account.address

const publicClient = createPublicClient({
  chain: foundry,
  transport: http('http://127.0.0.1:8545'),
})

const setupSandbox = async () => {
  const { PXE_URL = 'http://localhost:8080' } = process.env
  const pxe = await createPXEClient(PXE_URL)
  await waitForPXE(pxe)
  return pxe
}

interface BridgeState {
  loading: boolean
  status: string
  pxe: PXE | null
  l1TokenContract: string | null
  l2TokenContract: TokenContract | null
  l1PortalContractAddress: string | null
  l1Portal: any | null
  bridgeContract: TokenBridgeContract | null
  walletClient: WalletClient | null
  publicClient: PublicClient | null
  l2Wallets: any
  l1ContractAddresses: any
  aztecCleanHandsContract: any
}

export const useBridge = () => {
  const { wallet } = useWallet()
  const [state, setState] = useState<BridgeState>({
    loading: false,
    status: '',
    pxe: null,
    l1TokenContract: null,
    l2TokenContract: null,
    l1PortalContractAddress: null,
    l1Portal: null,
    bridgeContract: null,
    walletClient: null,
    publicClient: null,
    l2Wallets: null,
    l1ContractAddresses: null,
    aztecCleanHandsContract: null,
  })

  const updateState = (updates: Partial<BridgeState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }

  const setup = async () => {
    try {
      // Setup

      updateState({ loading: true, status: 'Setting up sandbox...' })

      const pxe = await setupSandbox()
      const wallets = await getInitialTestAccountsWallets(pxe)
      const ownerWallet = wallets[0]
      const ownerAztecAddress = wallets[0].getAddress()
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

  // ----------------- Clean Hands -----------------
  
  const deployCleanHandsSBT = async () => {
    try {
      updateState({ loading: true, status: 'Deploying Clean Hands SBT contract...' })
      if (!state.pxe || !wallet)
        throw new Error('PXE or wallet not initialized')

      const ownerWallet = state.l2Wallets?.[0]

      const contract = await CleanHandsSBTContract.deploy(ownerWallet, ownerWallet.getAddress())
        .send()
        .deployed();

      updateState({
        aztecCleanHandsContract: contract,
        status: 'Clean Hands SBT contract deployed successfully',
        loading: false,
      })
    } catch (error) {
      logger.error('Failed to deploy Clean Hands SBT contract:', error)
      updateState({ status: 'Failed to deploy Clean Hands SBT contract', loading: false })
    }
  }

  const mintCleanHandsSBT = async () => {
    try {
      // Mint a Clean Hands SBT to the SBT contract owner

      updateState({ loading: true, status: 'Minting Clean Hands SBT...' })
      if (!state.pxe || !state.aztecCleanHandsContract || !wallet)
        throw new Error('PXE or wallet not initialized')

      const ownerWallet = state.l2Wallets?.[0]

      const contract = state.aztecCleanHandsContract;
      const expiry = Math.floor((new Date().getTime() + 1000 * 60 * 60 * 24 * 365) / 1000);
      await contract.methods.mint(
        ownerWallet.getAddress(),
        123456789,
        987654321, // In production, action nullifier is poseidon(userSecret, actionId)
        expiry,
      ).send().wait();

      updateState({
        aztecCleanHandsContract: contract,
        status: `Minted SBT to ${ownerWallet.getAddress()}`,
        loading: false,
      })
    } catch (error) {
      logger.error('Failed to mint Clean Hands SBT:', error)
      updateState({ status: 'Failed to mint Clean Hands SBT contract', loading: false })
    }
  }
  
  // ----------------- END: Clean Hands -----------------

  const deployL2Token = async () => {
    try {
      // Deploy L2 token contract

      updateState({ loading: true, status: 'Deploying L2 token contract...' })
      if (!state.pxe || !wallet)
        throw new Error('PXE or wallet not initialized')

      const ownerWallet = state.l2Wallets?.[0]
      const ownerAztecAddress = state.l2Wallets?.[0].getAddress()

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
      updateState({
        l1TokenContract: l1Token.toString(),
        status: 'L1 token deployed successfully',
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
      if (!state.pxe || !state.l2TokenContract || !state.l1PortalContractAddress || !state.aztecCleanHandsContract || !wallet) {
        throw new Error('Required contracts or wallet not initialized')
      }

      console.log('state ', state)

      const ownerWallet = state.l2Wallets?.[0]

      const bridge = await deployBridge(
        ownerWallet,
        state.l2TokenContract.address,
        EthAddress.fromString(state.l1PortalContractAddress),
        state.aztecCleanHandsContract.address
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

  const bridgeTokensToL2 = async () => {
    try {
      updateState({ loading: true, status: 'Bridging tokens...' })
      if (
        !state.pxe ||
        !state.l1PortalContractAddress ||
        !state.l1TokenContract ||
        !state.publicClient ||
        !state.walletClient ||
        !wallet ||
        !state.l2TokenContract ||
        !state.bridgeContract
      ) {
        throw new Error('Required contracts or clients not initialized')
      }

      const ownerAztecAddress = state.l2Wallets?.[0].getAddress()
      const amount = BigInt(100)

      // Initialize L1 portal contract
      await state.l1Portal.write.initialize(
        [
          state.l1ContractAddresses.registryAddress.toString(),
          state.l1TokenContract,
          state.bridgeContract.address.toString(),
        ],
        {}
      )
      logger.info('L1 portal contract initialized')

      const l1PortalManager = new L1TokenPortalManager(
        EthAddress.fromString(state.l1PortalContractAddress),
        EthAddress.fromString(state.l1TokenContract),
        state.l1ContractAddresses.outboxAddress,
        state.publicClient as any, // Type assertion needed due to viem version mismatch
        state.walletClient as any, // Type assertion needed due to viem version mismatch
        logger
      )

      const claim = await l1PortalManager.bridgeTokensPublic(
        ownerAztecAddress,
        amount,
        true
      )

      // do 2 unrleated actions because
      // https://github.com/AztecProtocol/aztec-packages/blob/7e9e2681e314145237f95f79ffdc95ad25a0e319/yarn-project/end-to-end/src/shared/cross_chain_test_harness.ts#L354-L355
      await state.l2TokenContract.methods
        .mint_to_public(ownerAztecAddress, 0n)
        .send()
        .wait()
      await state.l2TokenContract.methods
        .mint_to_public(ownerAztecAddress, 0n)
        .send()
        .wait()

      await state.bridgeContract.methods
        .claim_public(
          ownerAztecAddress,
          amount,
          claim.claimSecret,
          claim.messageLeafIndex
        )
        .send()
        .wait()

      const balance = await state.l2TokenContract.methods
        .balance_of_public(ownerAztecAddress)
        .simulate()
      logger.info(`Public L2 balance of ${ownerAztecAddress} is ${balance}`)

      updateState({ status: 'Tokens bridged successfully', loading: false })
    } catch (error) {
      logger.error('Failed to bridge tokens:', error)
      updateState({ status: 'Failed to bridge tokens', loading: false })
    }
  }

  const withdrawTokensToL1 = async () => {
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
        !wallet
      ) {
        throw new Error('Required contracts or clients not initialized')
      }

      const ownerWallet = state.l2Wallets?.[0]
      const ownerAztecAddress = state.l2Wallets?.[0].getAddress()
      const ownerEthAddress = state.walletClient?.account.address;

      const withdrawAmount = BigInt(9)
      const nonce = Fr.random();

    // Give approval to bridge to burn owner's funds:
      const authwit = await ownerWallet.setPublicAuthWit(
        {
          caller: state.bridgeContract.address,
          action: state.l2TokenContract.methods.burn_public(ownerAztecAddress, withdrawAmount, nonce),
        },
        true,
      );
      await authwit.send().wait();

      const l1PortalManager = new L1TokenPortalManager(
        EthAddress.fromString(state.l1PortalContractAddress),
        EthAddress.fromString(state.l1TokenContract),
        state.l1ContractAddresses.outboxAddress,
        state.publicClient as any, // Type assertion needed due to viem version mismatch
        state.walletClient as any, // Type assertion needed due to viem version mismatch
        logger
      )

      const l2ToL1Message = l1PortalManager.getL2ToL1MessageLeaf(withdrawAmount, EthAddress.fromString(ownerEthAddress), state.bridgeContract.address, EthAddress.ZERO);
      const l2TxReceipt = await state.bridgeContract.methods.exit_to_l1_public(EthAddress.fromString(ownerEthAddress), withdrawAmount, EthAddress.ZERO, nonce).send().wait();

      const newL2Balance = await state.l2TokenContract.methods.balance_of_public(ownerAztecAddress).simulate();
      logger.info(`New L2 balance of ${ownerAztecAddress} is ${newL2Balance}`);

      const [l2ToL1MessageIndex, siblingPath] = await state.pxe.getL2ToL1MembershipWitness(await state.pxe.getBlockNumber(), l2ToL1Message)
      await l1PortalManager.withdrawFunds(
          withdrawAmount,
          EthAddress.fromString(ownerEthAddress),
          BigInt(l2TxReceipt.blockNumber!),
          l2ToL1MessageIndex,
          siblingPath
      );

        const l1TokenManager = new L1TokenManager(
        EthAddress.fromString(state.l1TokenContract),
        state.publicClient as any,
        state.walletClient as any,
        logger
      )

      const newL1Balance = await l1TokenManager.getL1TokenBalance(ownerEthAddress);
      logger.info(`New L1 balance of ${ownerEthAddress} is ${newL1Balance}`);
      updateState({ status: 'Tokens withdrawn successfully', loading: false })
    } catch (error) {
      logger.error('Failed to withdraw tokens:', error)
      updateState({ status: 'Failed to withdraw tokens', loading: false })
    }
  }

  return {
    ...state,
    setup,
    deployL2Token,
    deployL1Token,
    deployPortal,
    deployBridgeContract,
    deployCleanHandsSBT,
    mintCleanHandsSBT,
    bridgeTokensToL2,
    withdrawTokensToL1,
  }
}
