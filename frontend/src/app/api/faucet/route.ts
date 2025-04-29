import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, http, custom, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { ADDRESS } from '@/config'

// Configure environment variables in a .env.local file
// IMPORTANT: The FAUCET_PRIVATE_KEY must include the '0x' prefix
// Example: FAUCET_PRIVATE_KEY=0x1234...

// Amount of ETH to send for gas (0.05 ETH)
const FAUCET_AMOUNT = parseEther('0.05')

// Note: This API doesn't implement server-side rate limiting
// Rate limiting is handled by the client using localStorage to prevent
// users from requesting tokens more than once in 24 hours

let privateKey = process.env.FAUCET_PRIVATE_KEY
const rpcUrl = process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'

if (!privateKey) {
  throw new Error('FAUCET_PRIVATE_KEY is not set')
}

// Make sure it has 0x prefix
if (!privateKey.startsWith('0x')) {
  privateKey = `0x${privateKey}`
}

export async function POST(request: NextRequest) {
  try {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Get the recipient address from the request body
    const { address } = await request.json()

    // Validate recipient address
    if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
      return NextResponse.json(
        { error: 'Invalid recipient address' },
        { status: 400 }
      )
    }

    try {
      console.log('Creating account from private key...')
      // Create the account
      const account = privateKeyToAccount(privateKey as `0x${string}`)
      
      // Create public client for reading
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(rpcUrl),
      })

      // Send ETH instead of tokens
      console.log(`Sending ${FAUCET_AMOUNT} ETH to ${address}`)
      console.log('Using account:', account.address)

      // Get current nonce for the account
      const nonce = await publicClient.getTransactionCount({
        address: account.address,
      });
      
      // Get current gas price
      const gasPrice = await publicClient.getGasPrice();
      
      // Sign the transaction locally
      const signedTx = await account.signTransaction({
        to: address as `0x${string}`,
        value: FAUCET_AMOUNT,
        nonce,
        gasPrice,
        gas: BigInt(21000), // Standard gas limit for ETH transfers
      });
      
      // Send the raw transaction
      const hash = await publicClient.sendRawTransaction({
        serializedTransaction: signedTx,
      });

      console.log(`Transaction sent: ${hash}`)

      return NextResponse.json({
        success: true,
        txHash: hash,
        message: `${FAUCET_AMOUNT} ETH sent to ${address} for gas`,
      })
    } catch (err) {
      console.error('Error with transaction:', err)
      return NextResponse.json(
        { error: `Error processing transaction: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Faucet error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
