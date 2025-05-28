import { NetworkConfigItem } from "@/config/l1.config"

export interface NFTMetadata {
  name: string
  description: string
  image: string
  attributes: Array<{
    trait_type: string
    value: string | number
  }>
  [key: string]: any // for other metadata properties
}

export interface OpenSeaMetadata {
  floorPrice?: number
  collectionName?: string
  safelistRequestStatus?: string
  imageUrl?: string
  description?: string
  externalUrl?: string
  twitterUsername?: string
  discordUrl?: string
  lastIngestedAt?: string
}

export interface NFTContract {
  address: string
  contractDeployer?: string
  deployedBlockNumber?: number
  openSeaMetadata?: OpenSeaMetadata
  isSpam?: boolean
  symbol?: string
}

export interface NFTCollection {
  name?: string
  slug?: string
  symbol?: string
  totalSupply?: number
  floorPrice?: number
}

export interface NFTImage {
  cachedUrl?: string
  thumbnailUrl?: string
  pngUrl?: string
  originalUrl?: string
}

type Contract = {
  address: string;
  name: string;
  symbol: string;
  totalSupply: number | null;
  tokenType: string;
  contractDeployer: string;
  deployedBlockNumber: number;
  openSeaMetadata: OpenSeaMetadata
  isSpam: boolean;
  spamClassifications: string[];
};

export interface NFT {
  name: string
  tokenAddress: string
  contract: Contract
  openSeaMetadata?: OpenSeaMetadata
  chainId: number
  tokenId: string
  tokenType: string
  description: string | null
  balance: string
  tokenUri: string | null
  image: string | null
  metadata: NFTMetadata
  collection?: NFTCollection
  network: NetworkConfigItem
}

export interface NFTResponse {
  nfts: NFT[]
  totalCount: number
  pageKey: string
}
