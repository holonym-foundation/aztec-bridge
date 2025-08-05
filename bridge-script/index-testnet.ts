/**
 * Aztec Token Bridge Deployment Script
 *
 * Environment Variables:
 * - USE_SEPOLIA: Set to 'true' to use Sepolia testnet, or 'false'/'unset' for local sandbox
 * - L1_URL: L1 RPC URL (defaults to http://localhost:8545 for local)
 * - PXE_URL: Aztec PXE URL (defaults to http://localhost:8081 for local)
 * - MNEMONIC: Wallet mnemonic (defaults to test mnemonic for local)
 *
 * Examples:
 * Local sandbox: npm run start
 * Sepolia testnet: USE_SEPOLIA=true L1_URL=https://sepolia.infura.io/v3/YOUR_KEY MNEMONIC="your mnemonic" npm run start
 */

import { getInitialTestAccountsWallets } from '@aztec/accounts/testing'
import {
  AztecAddress,
  EthAddress,
  Fr,
  L1TokenManager,
  L1TokenPortalManager,
  Logger,
  createLogger,
  createPXEClient,
  readFieldCompressedString,
  waitForPXE,
} from '@aztec/aztec.js'
import {
  createExtendedL1Client,
  deployL1Contract,
  ExtendedViemWalletClient,
} from '@aztec/ethereum'
import {
  FeeAssetHandlerAbi,
  FeeAssetHandlerBytecode,
  // TestERC20Abi,
  // TestERC20Bytecode,
  TokenPortalAbi,
  TokenPortalBytecode,
} from '@aztec/l1-artifacts'
import { TokenContract } from '@aztec/noir-contracts.js/Token'
// import { TokenContract } from '@defi-wonderland/aztec-standards/artifacts/Token.js'
import { TokenBridgeContract } from '@aztec/noir-contracts.js/TokenBridge'

import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing'
import 'dotenv/config'
// @ts-ignore
import PortalSBTJson from './constants/PortalSBT.json'
// @ts-ignore
import TestERC20Json from './constants/TestERC20.json'
// import { TokenContract } from './constants/aztec/artifacts/Token.ts'

// Fix the bytecode format
const PortalSBTAbi = PortalSBTJson.abi
const PortalSBTBytecode = PortalSBTJson.bytecode.object

const TestERC20Abi = TestERC20Json.abi
const TestERC20Bytecode = TestERC20Json.bytecode.object as `0x${string}`

import { Chain, getContract, PublicClient, WalletClient } from 'viem'

import {
  type ContractInstanceWithAddress,
  type PXE,
  getContractInstanceFromDeployParams,
} from '@aztec/aztec.js'
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC'
import { getSchnorrAccount } from '@aztec/accounts/schnorr'
import { sepolia, localhost } from 'viem/chains'
import { deriveSigningKey } from '@aztec/stdlib/keys'
import { setupPXE } from './utils/setup_pxe.js'
import { deploySchnorrAccount } from './utils/deploy_account.js'
import { getSponsoredFPCInstance } from './utils/sponsored_fpc.js'
import { TOKEN_CONFIGS, TokenConfig } from './constants/tokens.js'
import {
  saveTokenToFile,
  generateSimpleTypescriptFile,
  loadExistingDeployments,
  ensureDeploymentEnvironment,
  DeployedContracts,
} from './utils/save_contracts.js'

// const L1_URL = process.env.L1_URL || 'http://localhost:8545'
const USE_SEPOLIA = process.env.USE_SEPOLIA === 'true'

// For Sepolia, require real mnemonic. For local, default to test mnemonic
let MNEMONIC: string
let L1_URL: string
let selectedChain: Chain
let l1Client: ExtendedViemWalletClient
if (USE_SEPOLIA) {
  if (!process.env.MNEMONIC) {
    throw new Error(
      'MNEMONIC is required when using Sepolia testnet. Please set the MNEMONIC environment variable.'
    )
  }
  MNEMONIC = process.env.MNEMONIC

  if (!process.env.L1_URL) {
    throw new Error(
      'L1_URL is required when using Sepolia testnet. Please set the L1_URL environment variable.'
    )
  }
  L1_URL = process.env.L1_URL
  selectedChain = sepolia
  l1Client = createExtendedL1Client(L1_URL.split(','), MNEMONIC, selectedChain)
} else {
  MNEMONIC = 'test test test test test test test test test test test junk'
  L1_URL = 'http://localhost:8545'
  selectedChain = localhost
  l1Client = createExtendedL1Client(L1_URL.split(','), MNEMONIC)
}

const ownerEthAddress = l1Client.account.address

const MINT_AMOUNT = BigInt(1e15)

const setupSandbox = async () => {
  // Default PXE URL: use 8081 for Sepolia (sandbox compatibility), 8080 for local
  const defaultPxeUrl = USE_SEPOLIA
    ? 'http://localhost:8081'
    : 'http://localhost:8080'
  const { PXE_URL = defaultPxeUrl } = process.env
  // eslint-disable-next-line @typescript-eslint/await-thenable
  const pxe = await createPXEClient(PXE_URL)
  await waitForPXE(pxe)
  return pxe
}

export const deployPortalSBT = async (): Promise<EthAddress> => {
  return await deployL1Contract(
    l1Client,
    PortalSBTAbi,
    PortalSBTBytecode as `0x${string}`,
    []
  ).then(({ address }) => address)
}

async function deployTestERC20(
  name: string,
  symbol: string,
  decimals: number
): Promise<EthAddress> {
  const constructorArgs = [name, symbol, decimals, l1Client.account.address]

  return await deployL1Contract(
    l1Client,
    TestERC20Abi,
    TestERC20Bytecode,
    constructorArgs
  ).then(({ address }) => address)
}

async function deployFeeAssetHandler(
  l1TokenContract: EthAddress
): Promise<EthAddress> {
  const constructorArgs = [
    l1Client.account.address,
    l1TokenContract.toString(),
    MINT_AMOUNT,
  ]
  return await deployL1Contract(
    l1Client,
    FeeAssetHandlerAbi,
    FeeAssetHandlerBytecode,
    constructorArgs
  ).then(({ address }) => address)
}

async function deployTokenPortal(): Promise<EthAddress> {
  return await deployL1Contract(
    l1Client,
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
    client: l1Client,
  })
  const tx = await contract.write.addMinter([l1TokenHandler.toString()])
  await l1Client.waitForTransactionReceipt({ hash: tx, timeout: 120000 })
}

// *************************************
// Generate unique salts for each token deployment
function generateTokenSalts(symbol: string) {
  // Use Fr.random() with a seed based on symbol for deterministic but unique salts
  const timestamp = Date.now()
  const symbolHash = symbol
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)

  return {
    tokenSalt: new Fr(BigInt(timestamp + symbolHash)),
    bridgeSalt: new Fr(BigInt(timestamp + symbolHash + 1000)),
  }
}

export async function getL2TokenContractInstance(
  deployerAddress: any,
  ownerAztecAddress: AztecAddress,
  tokenName: string,
  tokenSymbol: string,
  decimals: number,
  salt: Fr
): Promise<ContractInstanceWithAddress> {
  return await getContractInstanceFromDeployParams(TokenContract.artifact, {
    salt: salt,
    deployer: deployerAddress,
    constructorArgs: [ownerAztecAddress, tokenName, tokenSymbol, decimals],
  })
}
export async function getL2BridgeContractInstance(
  deployerAddress: any,
  ownerAztecAddress: AztecAddress,
  l2TokenContract: AztecAddress,
  l1PortalContractAddress: EthAddress,
  salt: Fr
): Promise<ContractInstanceWithAddress> {
  return await getContractInstanceFromDeployParams(
    TokenBridgeContract.artifact,
    {
      salt: salt,
      deployer: deployerAddress,
      constructorArgs: [
        ownerAztecAddress,
        l2TokenContract,
        l1PortalContractAddress,
      ],
    }
  )
}

async function mintL1Tokens(
  l1TokenContract: EthAddress,
  amount: bigint,
  logger: Logger,
  symbol: string
) {
  try {
    logger.info(`Minting ${amount.toString()} ${symbol} tokens to owner`)
    const contract = getContract({
      address: l1TokenContract.toString(),
      abi: TestERC20Abi,
      client: l1Client,
    })

    const tx = await contract.write.mint([ownerEthAddress, amount])
    logger.info(`Mint transaction sent: ${tx}`)
    await l1Client.waitForTransactionReceipt({ hash: tx, timeout: 120000 })
    logger.info(`✅ Successfully minted ${amount.toString()} ${symbol} tokens`)
  } catch (error) {
    logger.error(`❌ Failed to mint ${symbol} tokens: ${error}`)
    throw error
  }
}

async function deployCompleteTokenSetup(
  tokenConfig: TokenConfig,
  pxe: PXE,
  ownerWallet: any,
  ownerAztecAddress: AztecAddress,
  l1ContractAddresses: any,
  sponsoredPaymentMethod: any,
  logger: Logger
): Promise<DeployedContracts> {
  logger.info(`\n=== Deploying ${tokenConfig.symbol} Token Setup ===`)

  // Generate unique salts for this token
  const { tokenSalt, bridgeSalt } = generateTokenSalts(tokenConfig.symbol)

  // Deploy L1 token contract
  logger.info(
    `Deploying L1 ${tokenConfig.symbol} with decimals ${tokenConfig.decimals} token contract`
  )
  const l1TokenContract = await deployTestERC20(
    tokenConfig.l1Name,
    tokenConfig.l1Symbol,
    tokenConfig.decimals
  )
  logger.info(
    `L1 ${
      tokenConfig.symbol
    } token contract deployed at ${l1TokenContract.toString()}`
  )

  // Mint tokens to owner
  const mintAmount = BigInt(1000000000000000000)
  await mintL1Tokens(l1TokenContract, mintAmount, logger, tokenConfig.symbol)

  // Deploy fee asset handler
  logger.info(`Deploying fee asset handler for ${tokenConfig.symbol}`)
  const feeAssetHandler = await deployFeeAssetHandler(l1TokenContract)
  logger.info(
    `Fee asset handler for ${
      tokenConfig.symbol
    } deployed at ${feeAssetHandler.toString()}`
  )

  // Add minter
  await addMinter(l1TokenContract, feeAssetHandler)

  // Deploy L1 portal contract
  logger.info(`Deploying L1 portal contract for ${tokenConfig.symbol}`)
  const l1PortalContractAddress = await deployTokenPortal()
  logger.info(
    `L1 portal contract for ${
      tokenConfig.symbol
    } deployed at ${l1PortalContractAddress.toString()}`
  )

  // Deploy L2 token contract
  logger.info(`Deploying L2 ${tokenConfig.symbol} token contract`)
  const l2TokenContract = await TokenContract.deploy(
    ownerWallet,
    ownerAztecAddress,
    tokenConfig.l2Name,
    tokenConfig.l2Symbol,
    tokenConfig.decimals
  )
    .send({
      contractAddressSalt: tokenSalt,
      fee: { paymentMethod: sponsoredPaymentMethod },
    })
    .deployed({ timeout: 120000 })

  logger.info(
    `L2 ${tokenConfig.symbol} token contract deployed at ${l2TokenContract.address}`
  )

  // Deploy L2 bridge contract
  logger.info(`Deploying L2 bridge contract for ${tokenConfig.symbol}`)
  const l2BridgeContract = await TokenBridgeContract.deploy(
    ownerWallet,
    l2TokenContract.address,
    l1PortalContractAddress
  )
    .send({
      contractAddressSalt: bridgeSalt,
      fee: { paymentMethod: sponsoredPaymentMethod },
    })
    .deployed({ timeout: 120000 })

  logger.info(
    `L2 ${tokenConfig.symbol} bridge contract deployed at ${l2BridgeContract.address}`
  )

  // Set Bridge as a minter
  logger.info(`Setting bridge as minter for ${tokenConfig.symbol}`)
  await l2TokenContract.methods
    .set_minter(l2BridgeContract.address, true)
    .send({ fee: { paymentMethod: sponsoredPaymentMethod } })
    .wait({ timeout: 120000 })

  // Initialize L1 portal contract
  logger.info(`Initializing L1 portal contract for ${tokenConfig.symbol}`)
  const l1Portal = getContract({
    address: l1PortalContractAddress.toString(),
    abi: TokenPortalAbi,
    client: l1Client,
  })

  const initTx = await l1Portal.write.initialize(
    [
      l1ContractAddresses.registryAddress.toString(),
      l1TokenContract.toString(),
      l2BridgeContract.address.toString(),
    ],
    {}
  )
  
  // Wait for the transaction to be confirmed
  logger.info(`Waiting for L1 portal initialization transaction: ${initTx}`)
  await l1Client.waitForTransactionReceipt({ hash: initTx, timeout: 120000 })
  logger.info(`L1 portal contract for ${tokenConfig.symbol} initialized`)

  const deployedContract: DeployedContracts = {
    symbol: tokenConfig.symbol,
    decimals: tokenConfig.decimals,
    logo: tokenConfig.logo,
    l1TokenContract: l1TokenContract.toString(),
    l2TokenContract: l2TokenContract.address.toString(),
    l2BridgeContract: l2BridgeContract.address.toString(),
    l1PortalContract: l1PortalContractAddress.toString(),
    feeAssetHandler: feeAssetHandler.toString(),
    sponsoredFee: '', // Will be set later
  }

  return deployedContract
}

// *************************************

async function main() {
  let pxe: PXE
  let logger: Logger

  logger = createLogger('aztec:')
  // pxe = await setupPXE();
  pxe = await setupSandbox()

  const l1ContractAddresses = (await pxe.getNodeInfo()).l1ContractAddresses
  logger.info('L1 Contract Addresses:')
  logger.info(`Registry Address: ${l1ContractAddresses.registryAddress}`)
  logger.info(`Inbox Address: ${l1ContractAddresses.inboxAddress}`)
  logger.info(`Outbox Address: ${l1ContractAddresses.outboxAddress}`)
  logger.info(`Rollup Address: ${l1ContractAddresses.rollupAddress}`)

  logger.info('\n💰 Wallet Information:')
  logger.info(`L1 Wallet Address: ${ownerEthAddress}`)
  logger.info(
    `L1 Chain: ${l1Client.chain?.name || 'Unknown'} (ID: ${
      l1Client.chain?.id || 'Unknown'
    })`
  )
  logger.info(
    `Using ${USE_SEPOLIA ? 'Sepolia testnet' : 'local sandbox'} environment`
  )
  logger.info(`L1 RPC URL: ${L1_URL}`)

  const defaultPxeUrl = USE_SEPOLIA
    ? 'http://localhost:8081'
    : 'http://localhost:8080'
  logger.info(`PXE URL: ${process.env.PXE_URL || defaultPxeUrl}`)

  // Check L1 wallet balance
  try {
    const balance = await l1Client.getBalance({
      address: ownerEthAddress as `0x${string}`,
    })
    const balanceInEth = Number(balance) / 1e18
    logger.info(`L1 Wallet Balance: ${balanceInEth.toFixed(4)} ETH`)

    if (balanceInEth < 0.01) {
      logger.warn(
        '⚠️  Low L1 wallet balance! You may need more ETH for gas fees.'
      )
    }
  } catch (error) {
    logger.warn(`Could not fetch L1 wallet balance: ${error}`)
    throw error
  }

  logger.info(' ')
  const sponsoredFPC = await getSponsoredFPCInstance()
  await pxe.registerContract({
    instance: sponsoredFPC,
    artifact: SponsoredFPCContract.artifact,
  })
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPC.address
  )
  let accountManager = await deploySchnorrAccount(pxe)
  const ownerWallet = await accountManager.getWallet()
  const ownerAztecAddress = accountManager.getAddress()
  logger.info(`Owner Aztec Address: ${ownerAztecAddress}`)

  // Ensure deployment environment is ready
  logger.info('\n🔧 Setting up deployment environment...')
  ensureDeploymentEnvironment()

  // Check for existing deployments
  logger.info('\n📋 Checking for existing deployments...')
  const existingDeployments = loadExistingDeployments()
  if (existingDeployments) {
    logger.info(
      `Found existing deployments with ${existingDeployments.tokens.length} tokens`
    )
    logger.info(
      `Deployed tokens: ${existingDeployments.tokens
        .map((t) => t.symbol)
        .join(', ')}`
    )
  }

  // Deploy all tokens and their related contracts
  logger.info('\n🚀 Starting deployment of all tokens...')
  const deployedContracts: DeployedContracts[] = []

  for (const tokenConfig of TOKEN_CONFIGS) {
    // Check if token is already deployed
    const existingToken = existingDeployments?.tokens.find(
      (t) => t.symbol === tokenConfig.symbol
    )
    if (existingToken) {
      logger.info(`⏭️  ${tokenConfig.symbol} already deployed, skipping...`)
      deployedContracts.push(existingToken)
      continue
    }

    try {
      logger.info(`\n🔄 Deploying ${tokenConfig.symbol}...`)
      const deployedContract = await deployCompleteTokenSetup(
        tokenConfig,
        pxe,
        ownerWallet,
        ownerAztecAddress,
        l1ContractAddresses,
        sponsoredPaymentMethod,
        logger
      )
      deployedContract.sponsoredFee = sponsoredFPC.address.toString()

      // Save immediately after successful deployment
      saveTokenToFile(deployedContract, sponsoredFPC.address.toString())
      deployedContracts.push(deployedContract)
      logger.info(
        `✅ Successfully deployed and saved ${tokenConfig.symbol} token setup`
      )
    } catch (error) {
      logger.error(`❌ Failed to deploy ${tokenConfig.symbol}: ${error}`)
      // Continue with other tokens even if one fails
    }
  }

  // Generate final TypeScript file
  logger.info('\n📝 Generating final TypeScript file...')
  generateSimpleTypescriptFile()
  logger.info('✅ All contract addresses saved and TypeScript file generated!')

  // Example: Test with the first deployed token (USDC)
  if (deployedContracts.length > 0) {
    const firstToken = deployedContracts[0]
    logger.info(
      `\n🧪 Testing bridge functionality with ${firstToken.symbol}...`
    )

    const l1TokenContract = EthAddress.fromString(firstToken.l1TokenContract)
    const feeAssetHandler = EthAddress.fromString(firstToken.feeAssetHandler)
    const l1PortalContractAddress = EthAddress.fromString(
      firstToken.l1PortalContract
    )

    const l1TokenManager = new L1TokenManager(
      l1TokenContract,
      feeAssetHandler,
      l1Client,
      logger
    )

    const l1PortalManager = new L1TokenPortalManager(
      l1PortalContractAddress,
      l1TokenContract,
      feeAssetHandler,
      l1ContractAddresses.outboxAddress,
      l1Client,
      logger
    )

    // Get the deployed L2 contracts for testing
    const l2TokenContract = await TokenContract.at(
      AztecAddress.fromString(firstToken.l2TokenContract),
      ownerWallet
    )
    const l2BridgeContract = await TokenBridgeContract.at(
      AztecAddress.fromString(firstToken.l2BridgeContract),
      ownerWallet
    )

    logger.info('Bridge tokens publicly')
    logger.info(`Step 1: Send tokens publicly on L1`)
    const claim = await l1PortalManager.bridgeTokensPublic(
      ownerAztecAddress,
      MINT_AMOUNT,
      true
    )

    // Claim tokens publicly on L2
    logger.info(`Step 2: Claim tokens publicly on L2`)
    await l2BridgeContract.methods
      .claim_public(
        ownerAztecAddress,
        MINT_AMOUNT,
        claim.claimSecret,
        claim.messageLeafIndex
      )
      .send({ fee: { paymentMethod: sponsoredPaymentMethod } })
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
    await authwit
      .send({ fee: { paymentMethod: sponsoredPaymentMethod } })
      .wait({ timeout: 120000 })

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
      .send({ fee: { paymentMethod: sponsoredPaymentMethod } })
      .wait({ timeout: 120000 })

    const newL2Balance = await l2TokenContract.methods
      .balance_of_public(ownerAztecAddress)
      .simulate()
    logger.info(`New L2 balance of ${ownerAztecAddress} is ${newL2Balance}`)

    const [l2ToL1MessageIndex, siblingPath] =
      await pxe.getL2ToL1MembershipWitness(
        await pxe.getBlockNumber(),
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
  } else {
    logger.warn('No tokens were deployed successfully. Skipping bridge test.')
  }
}

main()
