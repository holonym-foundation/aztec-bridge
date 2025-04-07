import { createPXEClient, EthAddress, waitForPXE, L1TokenPortalManager, Fr, PXE, AztecAddress, Wallet, createLogger, FeeJuicePaymentMethod, L1TokenManager, L1FeeJuicePortalManager } from '@aztec/aztec.js';
import { deployL1Contract } from '@aztec/ethereum';
import { TestERC20Abi, TestERC20Bytecode, TokenPortalAbi, TokenPortalBytecode, FeeAssetHandlerAbi, FeeAssetHandlerBytecode } from '@aztec/l1-artifacts';
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { TokenBridgeContract } from "@aztec/noir-contracts.js/TokenBridge";
import { FeeJuiceContract } from "@aztec/noir-contracts.js/FeeJuice";
import { PublicClient, WalletClient, getContract } from 'viem';
import PortalSBTJson from '../constants/PortalSBT.json'

// Fix the bytecode format
const PortalSBTAbi = PortalSBTJson.abi
const PortalSBTBytecode = PortalSBTJson.bytecode.object

const PXE_URL = 'http://localhost:8080';
// Create logger but not used to avoid linter errors
const _logger = createLogger('bridge');

// Using BigInt constructor to avoid ES2020 literal syntax issues
export const FEE_FUNDING_FOR_TESTER_ACCOUNT = BigInt('1000000000000000000');
export const MINT_AMOUNT = BigInt(1e15);

export const setupSandbox = async (): Promise<PXE> => {
  const pxe = await createPXEClient(PXE_URL);
  await waitForPXE(pxe);
  return pxe;
};

export const deployTestERC20 = async (walletClient: WalletClient, publicClient: PublicClient): Promise<EthAddress> => {
  if (!walletClient.account) throw new Error('Wallet client has no account');
  
  const constructorArgs = ['Test Token', 'TEST', walletClient.account.address];
  return await deployL1Contract(
    walletClient,
    publicClient,
    TestERC20Abi,
    TestERC20Bytecode,
    constructorArgs
  ).then(({ address }) => address);
};

export const deployFeeAssetHandler = async (walletClient: WalletClient, publicClient: PublicClient, l1TokenContract: EthAddress): Promise<EthAddress> => {
  if (!walletClient.account) throw new Error('Wallet client has no account');
  
  const constructorArgs = [walletClient.account.address, l1TokenContract.toString(), MINT_AMOUNT];
  return await deployL1Contract(
    walletClient,
    publicClient,
    FeeAssetHandlerAbi,
    FeeAssetHandlerBytecode,
    constructorArgs
  ).then(({ address }) => address);
};

export const addMinter = async (walletClient: WalletClient, l1TokenContract: EthAddress, l1TokenHandler: EthAddress): Promise<void> => {
  const contract = getContract({
    address: l1TokenContract.toString(),
    abi: TestERC20Abi,
    client: walletClient,
  });
  await contract.write.addMinter([l1TokenHandler.toString()]);
};

export const deployTokenPortal = async (walletClient: WalletClient, publicClient: PublicClient): Promise<EthAddress> => {
  return await deployL1Contract(
    walletClient,
    publicClient,
    TokenPortalAbi,
    TokenPortalBytecode,
    []
  ).then(({ address }) => address);
};

export const deployL2Token = async (ownerWallet: Wallet, ownerAztecAddress: AztecAddress): Promise<TokenContract> => {
  return await TokenContract.deploy(ownerWallet, ownerAztecAddress, "L2 Token", "L2", 18).send().deployed();
};

export const deployBridge = async (
  ownerWallet: Wallet, 
  l2TokenAddress: AztecAddress, 
  portalAddress: EthAddress,
  feePaymentMethod?: FeeJuicePaymentMethod
): Promise<TokenBridgeContract> => {
  if (feePaymentMethod) {
    return await TokenBridgeContract.deploy(ownerWallet, l2TokenAddress, portalAddress)
      .send({ fee: { paymentMethod: feePaymentMethod } })
      .deployed();
  } else {
    return await TokenBridgeContract.deploy(ownerWallet, l2TokenAddress, portalAddress)
      .send()
      .deployed();
  }
};


export const deployPortalSBT = async (walletClient: WalletClient, publicClient: PublicClient): Promise<EthAddress> => {
  return await deployL1Contract(
    walletClient,
    publicClient,
    PortalSBTAbi,
    PortalSBTBytecode,
    []
  ).then(({ address }) => address);
};
export const setupFeeJuice = async (
  pxe: PXE,
  publicClient: PublicClient,
  walletClient: WalletClient,
  ownerWallet: Wallet,
  ownerAztecAddress: AztecAddress
): Promise<{ feeJuice: FeeJuiceContract, feeJuicePaymentMethod: FeeJuicePaymentMethod }> => {
  const logger = createLogger('bridge');
  
  // Create the FeeJuice portal manager
  const feeJuicePortalManager = await L1FeeJuicePortalManager.new(
    pxe,
    publicClient,
    walletClient,
    logger,
  );

  // Bridge fee tokens to L2
  await feeJuicePortalManager.bridgeTokensPublic(ownerAztecAddress, FEE_FUNDING_FOR_TESTER_ACCOUNT, true);
  
  // Get the FeeJuice contract instance using the owner wallet
  const nodeInfo = await pxe.getNodeInfo();
  const feeJuice = await FeeJuiceContract.at(nodeInfo.protocolContractAddresses.feeJuice, ownerWallet);
  
  // Create the payment method
  const feeJuicePaymentMethod = new FeeJuicePaymentMethod(ownerAztecAddress);
  
  return { feeJuice, feeJuicePaymentMethod };
};

export const withdrawTokens = async (
  l1PortalManager: L1TokenPortalManager,
  l2BridgeContract: TokenBridgeContract,
  l2TokenContract: TokenContract,
  ownerWallet: Wallet,
  ownerAztecAddress: AztecAddress,
  ownerEthAddress: string,
  withdrawAmount: bigint,
  pxe: PXE
): Promise<void> => {
  const nonce = Fr.random();
  
  // Give approval to bridge to burn owner's funds
  const authwit = await ownerWallet.setPublicAuthWit(
    {
      caller: l2BridgeContract.address,
      action: l2TokenContract.methods.burn_public(ownerAztecAddress, withdrawAmount, nonce),
    },
    true,
  );
  await authwit.send().wait();

  const l2ToL1Message = l1PortalManager.getL2ToL1MessageLeaf(
    withdrawAmount,
    EthAddress.fromString(ownerEthAddress),
    l2BridgeContract.address,
    EthAddress.ZERO
  );

  const l2TxReceipt = await l2BridgeContract.methods
    .exit_to_l1_public(EthAddress.fromString(ownerEthAddress), withdrawAmount, EthAddress.ZERO, nonce)
    .send()
    .wait();

  const [l2ToL1MessageIndex, siblingPath] = await pxe.getL2ToL1MembershipWitness(
    await pxe.getBlockNumber(),
    l2ToL1Message
  );

  await l1PortalManager.withdrawFunds(
    withdrawAmount,
    EthAddress.fromString(ownerEthAddress),
    BigInt(l2TxReceipt.blockNumber!),
    l2ToL1MessageIndex,
    siblingPath
  );
}; 