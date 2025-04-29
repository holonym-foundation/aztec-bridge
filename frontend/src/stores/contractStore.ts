import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { AztecAddress, readFieldCompressedString } from '@aztec/aztec.js'
import { ADDRESS } from '@/config'
import { TokenContract } from '../constants/aztec/artifacts/Token'
import { TokenBridgeContract } from '@aztec/noir-contracts.js/TokenBridge'
import { Contract } from '@nemi-fi/wallet-sdk/eip1193'

class L2Token extends Contract.fromAztec(TokenContract) {}
class L2TokenBridge extends Contract.fromAztec(TokenBridgeContract) {}

// Use intersection type instead of extending
type L2TokenMetadata = {
  name: string
  symbol: string
  decimals: number
}

interface ContractState {
  l2TokenContract: L2Token | null
  l2TokenMetadata: L2TokenMetadata | null
  l2BridgeContract: L2TokenBridge | null
  l1ContractAddresses: any | null
  setL2Contracts: (aztecAccount: any) => Promise<void>
  resetContracts: () => void
}

const contractStore = create<ContractState>((set) => ({
  l2TokenContract: null,
  l2TokenMetadata: null,
  l2BridgeContract: null,
  l1ContractAddresses: null,

  setL2Contracts: async (aztecAccount) => {
    if (!aztecAccount) {
      console.warn('No aztec account provided for contract setup')
      return
    }

    try {
      const l1ContractAddresses =
        await aztecAccount.aztecNode.getL1ContractAddresses()
      // console.log('Retrieved L1 contract addresses', {
      //   registry: l1ContractAddresses.registryAddress.toString(),
      //   inbox: l1ContractAddresses.inboxAddress.toString(),
      //   outbox: l1ContractAddresses.outboxAddress.toString(),
      //   rollup: l1ContractAddresses.rollupAddress.toString(),
      // })

      const token = await L2Token.at(
        AztecAddress.fromString(ADDRESS[1337].L2.TOKEN_CONTRACT),
        aztecAccount
      )

      const bridge = await L2TokenBridge.at(
        AztecAddress.fromString(ADDRESS[1337].L2.TOKEN_BRIDGE_CONTRACT),
        aztecAccount
      )

      // console.log('fetching token info...')

      // const [nameResponse, symbolResponse, decimals] = await Promise.all([
      //   token.methods.public_get_name({}).simulate(),
      //   token.methods.public_get_symbol({}).simulate(),
      //   token.methods.public_get_decimals().simulate(),
      // ])

      const nameResponse = 'Test USDC'
      const symbolResponse = 'USDC'
      const decimals = 6

      // const name = readFieldCompressedString(nameResponse as any)
      // const symbol = readFieldCompressedString(symbolResponse as any)
      const name = nameResponse
      const symbol = symbolResponse

      set({
        l2TokenContract: token,
        l2TokenMetadata: {
          name,
          symbol,
          decimals: Number(decimals),
        },
        l2BridgeContract: bridge,
        l1ContractAddresses,
      })
    } catch (error) {
      console.error('Failed to setup contracts', error)
    }
  },

  resetContracts: () => {
    set({
      l2TokenContract: null,
      l2TokenMetadata: null,
      l2BridgeContract: null,
      l1ContractAddresses: null,
    })
  },
}))

// // Helper selectors using shallow comparisons
// export const useL2TokenContract = () =>
//   contractStore(useShallow((state) => state.l2TokenContract))

// export const useL2BridgeContract = () =>
//   contractStore(useShallow((state) => state.l2BridgeContract))

// export const useL1ContractAddresses = () =>
//   contractStore(useShallow((state) => state.l1ContractAddresses))

// // Get multiple contracts at once with shallow comparison
// export const useL2Contracts = () =>
//   contractStore(
//     useShallow((state) => ({
//       l2TokenContract: state.l2TokenContract,
//       l2BridgeContract: state.l2BridgeContract,
//     }))
//   )

// Export main store with all state and actions
export const useContractStore = () =>
  contractStore(
    useShallow((state) => ({
      l2TokenContract: state.l2TokenContract,
      l2TokenMetadata: state.l2TokenMetadata,
      l2BridgeContract: state.l2BridgeContract,
      l1ContractAddresses: state.l1ContractAddresses,
      setL2Contracts: state.setL2Contracts,
      resetContracts: state.resetContracts,
    }))
  )
