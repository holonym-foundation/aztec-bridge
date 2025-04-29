import { AztecWalletSdk, obsidion } from '@nemi-fi/wallet-sdk'

const aztecNode = "https://l2.testnet.nemi.fi";
// const aztecNode = 'https://registry.obsidion.xyz/node'

// Create the Aztec Wallet SDK instance without pino-based logging
export const sdk = new AztecWalletSdk({
  aztecNode: aztecNode,
  // connectors: [obsidion({ walletUrl: WALLET_URL })],
  connectors: [obsidion({})],
  // Remove any logger config that might be using Pino
})

// Function to connect to the Obsidian wallet
export const connectWallet = async () => {
  try {
    await sdk.connect('obsidion')
    return await sdk.getAccount()
  } catch (error) {
    console.error('Failed to connect to Obsidian wallet:', error)
    throw error
  }
}
