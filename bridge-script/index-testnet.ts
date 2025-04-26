import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'
import {
  AztecAddress,
  EthAddress,
  Fr,
  L1TokenManager,
  L1TokenPortalManager,
  createLogger,
  createPXEClient,
  waitForPXE,
} from '@aztec/aztec.js'
import { createL1Clients, deployL1Contract } from '@aztec/ethereum'
import { deriveSigningKey } from '@aztec/stdlib/keys'
import {
  FeeAssetHandlerAbi,
  FeeAssetHandlerBytecode,
  TestERC20Abi,
  TestERC20Bytecode,
  TokenPortalAbi,
  TokenPortalBytecode,
} from '@aztec/l1-artifacts'
import { TokenContract } from '@aztec/noir-contracts.js/Token'
import { TokenBridgeContract } from '@aztec/noir-contracts.js/TokenBridge'
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing'

import PortalSBTJson from './constants/PortalSBT.json'
import 'dotenv/config'

// Fix the bytecode format
const PortalSBTAbi = PortalSBTJson.abi
const PortalSBTBytecode = PortalSBTJson.bytecode.object

import { getContract, PublicClient, WalletClient } from 'viem'

import {
  type ContractInstanceWithAddress,
  type PXE,
  getContractInstanceFromDeployParams,
} from '@aztec/aztec.js'
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC'
import { getSchnorrAccount } from '@aztec/accounts/schnorr'
import { sepolia } from 'viem/chains'

const SPONSORED_FPC_SALT = new Fr(0)

export async function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
  return await getContractInstanceFromDeployParams(
    SponsoredFPCContract.artifact,
    {
      salt: SPONSORED_FPC_SALT,
    }
  )
}

export async function getSponsoredFPCAddress() {
  return (await getSponsoredFPCInstance()).address
}

export async function getDeployedSponsoredFPCAddress(pxe: PXE) {
  const fpc = await getSponsoredFPCAddress()
  const contracts = await pxe.getContracts()
  if (!contracts.find((c) => c.equals(fpc))) {
    throw new Error('SponsoredFPC not deployed.')
  }
  return fpc
}

const L1_URL = process.env.L1_URL

if (!L1_URL) {
  throw new Error('L1_URL is not set')
}

const L1_CHAIN_ID = process.env.L1_CHAIN_ID || 11155111

const MNEMONIC = process.env.MNEMONIC

if (!MNEMONIC) {
  throw new Error('MNEMONIC is not set')
}

const { walletClient, publicClient } = createL1Clients(
  L1_URL.split(','),
  MNEMONIC,
  // @ts-ignore
  sepolia
)
const ownerEthAddress = walletClient.account.address

const MINT_AMOUNT = BigInt(1e15)

const setupSandbox = async () => {
  const { PXE_URL = 'http://localhost:8081' } = process.env
  // eslint-disable-next-line @typescript-eslint/await-thenable
  const pxe = await createPXEClient(PXE_URL)
  await waitForPXE(pxe)
  return pxe
}

export const deployPortalSBT = async (): Promise<EthAddress> => {
  return await deployL1Contract(
    walletClient,
    publicClient,
    PortalSBTAbi,
    PortalSBTBytecode,
    []
  ).then(({ address }) => address)
}

async function deployTestERC20(): Promise<EthAddress> {
  const constructorArgs = ['Test USDC', 'USDC', walletClient.account.address]

  return await deployL1Contract(
    walletClient,
    publicClient,
    TestERC20Abi,
    TestERC20Bytecode,
    constructorArgs
  ).then(({ address }) => address)
}

async function deployFeeAssetHandler(
  l1TokenContract: EthAddress
): Promise<EthAddress> {
  const constructorArgs = [
    walletClient.account.address,
    l1TokenContract.toString(),
    MINT_AMOUNT,
  ]
  return await deployL1Contract(
    walletClient,
    publicClient,
    FeeAssetHandlerAbi,
    FeeAssetHandlerBytecode,
    constructorArgs
  ).then(({ address }) => address)
}

async function deployTokenPortal(): Promise<EthAddress> {
  return await deployL1Contract(
    walletClient,
    publicClient,
    TokenPortalAbi,
    TokenPortalBytecode,
    []
  ).then(({ address }) => address)
}

async function addMinter(
  l1TokenContract: EthAddress,
  l1TokenHandler: EthAddress
) {
  const contract = getContract({
    address: l1TokenContract.toString(),
    abi: TestERC20Abi,
    // @ts-ignore
    client: walletClient,
  })
  // @ts-ignore
  await contract.write.addMinter([l1TokenHandler.toString()])
}

async function main() {
  const logger = createLogger('aztec:token-bridge')

  logger.info(`Owner Eth Address: ${ownerEthAddress}`)

  const pxe = await setupSandbox()

  const l1ContractAddresses = (await pxe.getNodeInfo()).l1ContractAddresses
  logger.info('L1 Contract Addresses:')
  logger.info(`Registry Address: ${l1ContractAddresses.registryAddress}`)
  logger.info(`Inbox Address: ${l1ContractAddresses.inboxAddress}`)
  logger.info(`Outbox Address: ${l1ContractAddresses.outboxAddress}`)
  logger.info(`Rollup Address: ${l1ContractAddresses.rollupAddress}`)
  console.log(' ')

  logger.info('Deploying Portal SBT Contract')
  const portalSBT = await deployPortalSBT()
  logger.info(`Portal SBT Contract deployed at ${portalSBT.toString()}`)

  logger.info('Deploy L1 token contract & mint tokens')
  const l1TokenContract = await deployTestERC20()
  // const l1TokenContract = EthAddress.fromString(
  //   '0xadf59f05333ed4f2eb244463398fd49ce03f7756'
  // )
  logger.info(`L1 Token Contract deployed at ${l1TokenContract.toString()}`)

  logger.info('Deploying Fee Asset Handler')
  const feeAssetHandler = await deployFeeAssetHandler(l1TokenContract)
  // const feeAssetHandler = EthAddress.fromString( '0x974d7480ba5e8d68b72d110d2029d33d9f267f6a')

  logger.info(`Fee Asset Handler deployed at ${feeAssetHandler.toString()}`)
  logger.info('Adding Minter')
  await addMinter(l1TokenContract, feeAssetHandler)

  const l1TokenManager = new L1TokenManager(
    l1TokenContract,
    feeAssetHandler,
    publicClient,
    walletClient,
    logger
  )

  logger.info('Deploying L1 Portal Contract')

  const l1PortalContractAddress = await deployTokenPortal()
  // logger.info('Deploying L1 Portal Contract')
  // const l1PortalContractAddress = await deployTokenPortal()
  // const l1PortalContractAddress = EthAddress.fromString(
  //   '0x5eda667c47816c4bc7ad5dc1608a89fab33e949b'
  // )
  logger.info(
    `L1 portal contract deployed at ${l1PortalContractAddress.toString()}`
  )

  const l1Portal = getContract({
    address: l1PortalContractAddress.toString(),
    abi: TokenPortalAbi,
    // @ts-ignore
    client: walletClient,
  })

  console.log(' ')

  logger.info('Generating random secret key and salt...')
  let secretKey = Fr.random()
  let salt = Fr.random()
  logger.info(`Secret key: ${secretKey}`)
  logger.info(`Salt: ${salt}`)
  let schnorrAccount = await getSchnorrAccount(
    pxe,
    secretKey,
    deriveSigningKey(secretKey),
    salt
  )
  logger.info(`Schnorr account deployed at: ${schnorrAccount.getAddress()}`)

  let ownerWallet = await schnorrAccount.getWallet()
  const ownerAztecAddress = ownerWallet.getAddress()
  logger.info(`Schnorr account deployed at: ${ownerAztecAddress}`)

  logger.info('Deploying sponsored FPC...')
  const sponseredFPC = await getSponsoredFPCInstance()
  await pxe.registerContract({
    instance: sponseredFPC,
    artifact: SponsoredFPCContract.artifact,
  })
  const sponseredFPCAddress = sponseredFPC.address
  // const sponseredFPCAddress = AztecAddress.fromString(
  //   '0x0b27e30667202907fc700d50e9bc816be42f8141fae8b9f2281873dbdb9fc2e5'
  // )

  const paymentMethod = new SponsoredFeePaymentMethod(sponseredFPCAddress)
  logger.info('Sponsored FPC deployed and registered')
  logger.info(`Sponsored FPC deployed at: ${sponseredFPCAddress}`)

  logger.info('Deploying Schnorr Account with payment method')
  let tx = await schnorrAccount
    .deploy({ fee: { paymentMethod } })
    .wait({ timeout: 120000 })
  logger.info(`Schnorr account deployed at: ${ownerWallet.getAddress()}`)

  logger.info('Deploying L2 Token Contract')

  const l2TokenContract = await TokenContract.deploy(
    ownerWallet,
    ownerAztecAddress,
    'Clean USDC',
    'USDC',
    18
  )
    .send({ fee: { paymentMethod } })
    .deployed({ timeout: 120000 })

  const l2TokenContractAddress = l2TokenContract.address
  // const l2TokenContractAddress = AztecAddress.fromString(
  //   '0x115050873cc35e42aa9c42f8481425468c51a4249cd2a379cff3c40a739bf566'
  // )
  // const l2TokenContract = await TokenContract.at(
  //   l2TokenContractAddress,
  //   ownerWallet
  // )

  logger.info(
    `Clean USDC L2 token contract deployed at ${l2TokenContractAddress}`
  )

  logger.info('Deploying L2 Token Bridge Contract')
  const l2BridgeContract = await TokenBridgeContract.deploy(
    ownerWallet,
    l2TokenContractAddress,
    l1PortalContractAddress
  )
    .send({ fee: { paymentMethod } })
    .deployed({ timeout: 120000 })

  // const l2BridgeContractAddress = AztecAddress.fromString(
  //   '0x2984fc75996002cb832742e4d0c1ab139f9991732d5fedfd91df8576c9e78470'
  // )
  // const l2BridgeContract = await TokenBridgeContract.at(
  //   l2BridgeContractAddress,
  //   ownerWallet
  // )
  logger.info(
    `L2 token bridge contract deployed at ${l2BridgeContract.address}`
  )
  logger.info('Setting Bridge as a minter')

  await l2TokenContract.methods
    .set_minter(l2BridgeContract.address, true)
    .send({ fee: { paymentMethod } })
    .wait({ timeout: 120000 })

  // Initialize L1 portal contract
  // @ts-ignore
  await l1Portal.write.initialize(
    [
      l1ContractAddresses.registryAddress.toString(),
      l1TokenContract.toString(),
      l2BridgeContract.address.toString(),
    ],
    {}
  )
  logger.info('L1 portal contract initialized')

  const l1PortalManager = new L1TokenPortalManager(
    l1PortalContractAddress,
    l1TokenContract,
    feeAssetHandler,
    l1ContractAddresses.outboxAddress,
    publicClient,
    walletClient,
    logger
  )
  logger.info('Bridge tokens publicly on L1')
  const claim = await l1PortalManager.bridgeTokensPublic(
    ownerAztecAddress,
    MINT_AMOUNT,
    true
  )

  logger.info('Minting tokens to L2')
  // Do 2 unrleated actions because
  // https://github.com/AztecProtocol/aztec-packages/blob/7e9e2681e314145237f95f79ffdc95ad25a0e319/yarn-project/end-to-end/src/shared/cross_chain_test_harness.ts#L354-L355
  await l2TokenContract.methods
    .mint_to_public(ownerAztecAddress, 0n)
    .send({ fee: { paymentMethod } })
    .wait({ timeout: 120000 })
  await l2TokenContract.methods
    .mint_to_public(ownerAztecAddress, 0n)
    .send({ fee: { paymentMethod } })
    .wait({ timeout: 120000 })

  logger.info('Claiming tokens publicly on L2')
  await l2BridgeContract.methods
    .claim_public(
      ownerAztecAddress,
      MINT_AMOUNT,
      claim.claimSecret,
      claim.messageLeafIndex
    )
    .send({ fee: { paymentMethod } })
    .wait({ timeout: 120000 })
  const balance = await l2TokenContract.methods
    .balance_of_public(ownerAztecAddress)
    .simulate()
  logger.info(`Public L2 balance of ${ownerAztecAddress} is ${balance}`)

  logger.info('Withdrawing funds from L2')
  const withdrawAmount = 9n
  const nonce = Fr.random()

  // Give approval to bridge to burn owner's funds:
  const authwit = await ownerWallet.setPublicAuthWit(
    {
      caller: l2BridgeContract.address,
      action: l2TokenContract.methods.burn_public(
        ownerAztecAddress,
        withdrawAmount,
        nonce
      ),
    },
    true
  )

  await authwit.send({ fee: { paymentMethod } }).wait({ timeout: 120000 })

  const l2ToL1Message = await l1PortalManager.getL2ToL1MessageLeaf(
    withdrawAmount,
    EthAddress.fromString(ownerEthAddress),
    l2BridgeContract.address,
    EthAddress.ZERO
  )
  const l2TxReceipt = await l2BridgeContract.methods
    .exit_to_l1_public(
      EthAddress.fromString(ownerEthAddress),
      withdrawAmount,
      EthAddress.ZERO,
      nonce
    )
    .send({ fee: { paymentMethod } })
    .wait({ timeout: 120000 })
  console.log('l2TxReceipt ', l2TxReceipt.txHash, l2TxReceipt.blockNumber)
  console.log('l2TxReceipt ', l2TxReceipt)

  const newL2Balance = await l2TokenContract.methods
    .balance_of_public(ownerAztecAddress)
    .simulate()
  logger.info(`New L2 balance of ${ownerAztecAddress} is ${newL2Balance}`)

  const [l2ToL1MessageIndex, siblingPath] =
    await pxe.getL2ToL1MembershipWitness(
      l2TxReceipt.blockNumber!,
      l2ToL1Message
    )
  await l1PortalManager.withdrawFunds(
    withdrawAmount,
    EthAddress.fromString(ownerEthAddress),
    BigInt(l2TxReceipt.blockNumber!),
    l2ToL1MessageIndex,
    siblingPath
  )
  const newL1Balance = await l1TokenManager.getL1TokenBalance(ownerEthAddress)
  logger.info(`New L1 balance of ${ownerEthAddress} is ${newL1Balance}`)
}

main()
