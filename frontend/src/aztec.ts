import { AztecWalletSdk, obsidion } from "@nemi-fi/wallet-sdk";
import { Contract } from "@nemi-fi/wallet-sdk/eip1193";
import { createAztecNodeClient, createPXEClient } from "@aztec/aztec.js";
import { getDeployedTestAccountsWallets } from "@aztec/accounts/testing";
import { Eip1193Account } from "@nemi-fi/wallet-sdk/eip1193";
import { type Connector, createConnector } from 'wagmi';

// Define the Account type
export type Account = any; // Replace with proper type when available

// const aztecNode = "https://l2.testnet.nemi.fi";
const aztecNode = "https://registry.obsidion.xyz/node"
const WALLET_URL = "https://app.obsidion.xyz"

// Create the Aztec Wallet SDK instance
export const sdk = new AztecWalletSdk({
  aztecNode: aztecNode,
  connectors: [obsidion({ walletUrl: WALLET_URL })],
});



const pxeUrl = aztecNode
// const pxeUrl = "http://localhost:8081";
// export const pxe = createPXEClient(pxeUrl);
export const pxe  = createAztecNodeClient(pxeUrl);


// Function to connect to the Obsidian wallet
export const connectWallet = async () => {
  try {
    await sdk.connect("obsidion");
    return await sdk.getAccount();
  } catch (error) {
    console.error("Failed to connect to Obsidian wallet:", error);
    throw error;
  }
};

// Helper function to create a contract instance
export const createContract = <T>(ContractClass: any, address: string, account: Account) => {
  return ContractClass.at(address, account);
};

// Export a hook for React components
export { useAccount } from "@nemi-fi/wallet-sdk/react"; 