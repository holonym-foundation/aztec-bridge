import { NetworkConfigItem } from "@/config/l1.config"

export type T_UserTokenType =
  | 'native'
  | 'erc20'
  | 'erc721'
  | 'erc1155'
  | 'stablecoin'

export interface I_UserTokenBalance {
  address: string
  name: string
  symbol: string
  decimals: number
  chain: string
  network?: NetworkConfigItem
  logo?: string
  type: T_UserTokenType
  balance: string // raw balance in wei or smallest unit
  balance_formatted: number // balance in ether or human-readable unit
  balance_usd_value: number // balance in USD
  exchange_rate: number
}

// ---------------------------------
export interface AlchemyTokenPrice {
  currency: string
  value: string
  lastUpdatedAt: string
}

export interface AlchemyTokenMetadata {
  decimals: number
  logo: string | null
  name: string
  symbol: string
}

export interface AlchemyToken {
  address: string
  network: string
  tokenAddress: string | null
  tokenBalance: string
  tokenMetadata: AlchemyTokenMetadata | Record<string, never>
  tokenPrices: AlchemyTokenPrice[]
}

export interface AlchemyTokenResponse {
  data: {
    tokens: AlchemyToken[]
  }
}

export type T_AlchemyTokenBalanceResponse = AlchemyToken & {
  chainId: number
}
