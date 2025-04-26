// import { EasyPrivateVotingContract } from "../src/artifacts/EasyPrivateVoting.js"
import { TokenBridgeContract } from '@aztec/noir-contracts.js/TokenBridge'
import {
  createLogger,
  PXE,
  waitForPXE,
  createPXEClient,
  Logger,
  AztecAddress,
} from '@aztec/aztec.js'
import { TokenContract } from '@aztec/noir-contracts.js/Token'
import { getSponsoredFPCAddress } from './utils/sponsored_fpc.js'
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing'
import { deploySchnorrAccount } from './deploy-account.js'

const setupPXE = async () => {
  const { PXE_URL = 'http://localhost:8081' } = process.env
  const pxe = await createPXEClient(PXE_URL)
  await waitForPXE(pxe)
  return pxe
}

async function main() {
  let pxe: PXE
  let logger: Logger

  logger = createLogger('aztec:aztec-starter')

  pxe = await setupPXE()

  const l1ContractAddresses = (await pxe.getNodeInfo()).l1ContractAddresses
  logger.info('L1 Contract Addresses:')
  logger.info(`Registry Address: ${l1ContractAddresses.registryAddress}`)
  logger.info(`Inbox Address: ${l1ContractAddresses.inboxAddress}`)
  logger.info(`Outbox Address: ${l1ContractAddresses.outboxAddress}`)
  logger.info(`Rollup Address: ${l1ContractAddresses.rollupAddress}`)

  logger.info(' ')
  logger.info('===================================================')
  logger.info('Deploying Wallet')
  const wallet = await deploySchnorrAccount()
  logger.info(`Wallet deployed at ${wallet.getAddress()}`)

  logger.info(' ')
  logger.info('===================================================')
  logger.info('Deploying Sponsored Fee Payment Contract') 
  const sponseredFPCAddress = await getSponsoredFPCAddress()
  const paymentMethod = new SponsoredFeePaymentMethod(sponseredFPCAddress)
  logger.info(`Sponsored Fee Payment Contract deployed at ${sponseredFPCAddress}`)

  // const votingContract = await EasyPrivateVotingContract.deploy(wallet, wallet.getAddress()).send({ fee: { paymentMethod }}).deployed();
  // logger.info(`Voting Contract deployed at: ${votingContract.address}`);

  logger.info(' ')
  logger.info('===================================================')
  logger.info('Deploying L2 Token Contract')
  const l2TokenContract = await TokenContract.deploy(
    wallet,
    wallet.getAddress(),
    'L2 Token',
    'L2',
    18
  )
    .send({ fee: { paymentMethod } })
    .deployed()
  logger.info(`L2 token contract deployed at ${l2TokenContract.address}`)

  logger.info('===================================================')
  logger.info(' ')

  // logger.info('Deploying L2 Token Bridge Contract')
  // const l2BridgeContract = await TokenBridgeContract.deploy(
  //   wallet,
  //   l2TokenContract.address,
  //   l1PortalContractAddress,
  // )
  //   .send()
  //   .deployed();
  // logger.info(`L2 token bridge contract deployed at ${l2BridgeContract.address}`);

  // const tokenBridgeContract = await TokenBridgeContract.deploy(
  //   wallet,
  //   wallet.getAddress()
  // )
  //   .send({ fee: { paymentMethod } })
  //   .deployed()
  // logger.info(
  //   `Token Bridge Contract deployed at: ${tokenBridgeContract.address}`
  // )
}

main()
