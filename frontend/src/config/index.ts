import { Network, Token } from '@/types/bridge'
// -------------------------------------

// since aztec does not have a chain ID yet, i propose to use these values to organise token lists:
// - testnet: 418719321 // keccak256('aztec-testnet')[0:4]
// - sandbox:: 147120760, // keccak256('aztec-sandbox')[0:4]

export const ADDRESS = {
  11155111: {
    // Sepolia
    CHAIN_ID: 11155111,
    CHAIN_NAME: 'Sepolia',
    L1: {
      PORTAL_SBT_CONTRACT: '0x983ad7bdc7701a77a6c22e2245d7eafe893b21fe',
      TOKEN_CONTRACT: '0xb9651f097214dc40dc1fecbca6863a2f0d46a573',
      FEE_ASSET_HANDLER_CONTRACT: '0xf83ce2aec94868ae1491c8dc5197a22eefd5cd3e',
      PORTAL_CONTRACT: '0x6f3ec949723e8e19563ce0e1eabcf0d847d97619',
    },
  },
  1337: {
    // Aztec Testnet
    CHAIN_ID: 1337,
    CHAIN_NAME: 'Aztec Testnet',
    L2: {
      TOKEN_CONTRACT: '0x1e6348061ace5d20467fd9345af2211edc3342b7c6efae215148d4315c181507',
      TOKEN_BRIDGE_CONTRACT: '0x2dfe05059f139ba21694fbf7c1696f5b8a7f046a6dd45d60b4481bdf1c9585ab',
      SPONSORED_FEE_PAYMENT_CONTRACT: '0x19b5539ca1b104d4c3705de94e4555c9630def411f025e023a13189d0c56f8f2',
    },
  },
} as const

// L1: {
//   CHAIN_NAME: 'Sepolia',
//   NAME: 'Test USDC',
//   SYMBOL: 'USDC',
//   TOKEN_CONTRACT: '0x24ca8bf6d17d0f6844eacee733fa183d343c1dc4',
// }

// L2: {
// CHAIN_NAME: 'Aztec Testnet',
//   NAME: 'Clean USDC',
//   SYMBOL: 'USDC',
//   TOKEN_CONTRACT: '0x2ab7cf582347c8a2834e0faf98339372118275997e14c5a77054bb345362e878',
// }
// -------------------------------------

export const L1_NETWORKS: Network[] = [
  {
    id: 1,
    img: '/assets/svg/ethereum.svg',
    title: 'Eth Sepolia',
    chainId: 11155111,
    network: 'sepolia',
    symbol: 'ETH',
  },
  // {
  //   id: 2,
  //   img: '/assets/svg/op.svg',
  //   title: 'Optimism',
  // },
  // {
  //   id: 3,
  //   img: '/assets/svg/polygon.svg',
  //   title: 'Polygon',
  // },
  // {
  //   id: 4,
  //   img: '/assets/svg/arbitrum.svg',
  //   title: 'Arbitrum',
  // },
  // {
  //   id: 5,
  //   img: '/assets/svg/gn.svg',
  //   title: 'Gnosis',
  // },
]

export const L2_NETWORKS: Network[] = [
  {
    id: 2,
    img: '/assets/svg/aztec.svg',
    title: 'Aztec Tesnet',
    chainId: 1337,
    network: 'aztec',
    symbol: 'ETH',
  },
  // {
  //   id: 1,
  //   img: '/assets/svg/aztec.svg',
  //   title: 'Aztec Optimistic',
  //   chainId: 1337,
  //   network: 'aztec',
  //   symbol: 'ETH',
  // },
]
// -----------------------------
export const L1_TOKENS: Token[] = [
  {
    id: 1,
    img: '/assets/svg/USDC.svg',
    title: 'USDC',
    symbol: 'USDC',
    decimals: 6,
    address: '0xb9651f097214dc40dc1fecbca6863a2f0d46a573',
  },
  // {
  //   id: 2,
  //   img: '/assets/svg/USDT.svg',
  //   title: 'Test USDT',
  //   symbol: 'USDT',
  // },
  // {
  //   id: 3,
  //   img: '/assets/svg/ETH.svg',
  //   title: 'Test ETH',
  //   symbol: 'ETH',
  // },
  // {
  //   id: 4,
  //   img: '/assets/svg/XDAI.svg',
  //   title: 'Test XDAI',
  //   symbol: 'XDAI',
  // },
]

export const L2_TOKENS: Token[] = [
  {
    id: 1,
    img: '/assets/svg/USDC.svg',
    title: 'Clean USDC',
    symbol: 'cUSDC',
    decimals: 6,
    address: '0x1e6348061ace5d20467fd9345af2211edc3342b7c6efae215148d4315c181507',
  },
  // {
  //   id: 2,
  //   img: '/assets/svg/USDT.svg',
  //   title: 'Clean USDT',
  //   symbol: 'USDT',
  // },
]
