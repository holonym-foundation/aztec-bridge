import { createPXEClient, EthAddress, waitForPXE, L1TokenPortalManager, Fr, PXE, AztecAddress, Wallet, createLogger } from '@aztec/aztec.js';
import { deployL1Contract } from '@aztec/ethereum';
import { TestERC20Abi, TestERC20Bytecode, TokenPortalAbi, TokenPortalBytecode } from '@aztec/l1-artifacts';
import { TokenContract } from "@aztec/noir-contracts.js/Token";
// import { TokenBridgeContract } from "@aztec/noir-contracts.js/TokenBridge";
import { TokenBridgeContract } from "../constants/contract-interfaces/TokenBridge";
import { PublicClient, WalletClient } from 'viem';

const PXE_URL = 'http://localhost:8080';
const logger = createLogger('bridge');

export const setupSandbox = async (): Promise<PXE> => {
  const pxe = await createPXEClient(PXE_URL);
  await waitForPXE(pxe);
  return pxe;
};

export const deployTestERC20 = async (walletClient: WalletClient, publicClient: PublicClient): Promise<EthAddress> => {
  if (!walletClient.account) throw new Error('Wallet client has no account');
  
  const constructorArgs = ['Test Token', 'TEST', walletClient.account.address];
  return await deployL1Contract(
    walletClient as any, // Type assertion needed due to viem version mismatch
    publicClient,
    TestERC20Abi,
    TestERC20Bytecode,
    constructorArgs
  ).then(({ address }) => address);
};

export const deployTokenPortal = async (walletClient: WalletClient, publicClient: PublicClient): Promise<EthAddress> => {
  if (!walletClient.account) throw new Error('Wallet client has no account');
  
  return await deployL1Contract(
    walletClient as any, // Type assertion needed due to viem version mismatch
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
  cleanHandsSBTContractAddress: AztecAddress,
): Promise<TokenBridgeContract> => {
  // return await TokenBridgeContract.deploy(ownerWallet, l2TokenAddress, portalAddress).send().deployed();
  return await TokenBridgeContract.deploy(ownerWallet, l2TokenAddress, portalAddress, cleanHandsSBTContractAddress).send().deployed();
};

export const bridgeTokens = async (
  l1PortalManager: L1TokenPortalManager,
  ownerAztecAddress: AztecAddress,
  amount: bigint
): Promise<void> => {
  await l1PortalManager.bridgeTokensPublic(ownerAztecAddress, amount, true);
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
  const authwit = await (ownerWallet as any).setPublicAuthWit(
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