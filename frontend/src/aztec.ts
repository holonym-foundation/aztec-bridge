'use client'

import { AztecWalletSdk, obsidion } from '@nemi-fi/wallet-sdk'
import { createAztecNodeClient, createPXEClient } from "@aztec/aztec.js";

const NODE_URL = "https://aztec-alpha-testnet-fullnode.zkv.xyz/"
const WALLET_URL = "https://app.obsidion.xyz"

export const aztecNode = createAztecNodeClient(NODE_URL);

export const pxe = createPXEClient(NODE_URL);

// Create the Aztec Wallet SDK instance
export const sdk = new AztecWalletSdk({
  aztecNode: NODE_URL,
  connectors: [obsidion({})],
})

// Function to connect to the specified wallet type
export const connectWallet = async (type: 'obsidion' | 'azguard') => {
  try {
    await sdk.connect(type)
    return await sdk.getAccount()
  } catch (error) {
    console.error(`Failed to connect to ${type} wallet:`, error)
    throw error
  }
}
