export enum BridgeDirection {
  L1_TO_L2 = 'L1_TO_L2',
  L2_TO_L1 = 'L2_TO_L1',
}

export interface Network {
  id: number;
  img: string;
  title: string;
  chainId: number;
  network: string;
  symbol: string;
}

export interface Token {
  id: number;
  img: string;
  title: string;
  symbol: string;
  decimals: number;
  address: string;
}

export interface BridgeSectionState {
  network: Network | null;
  token: Token | null;
}

export interface BridgeState {
  from: BridgeSectionState;
  to: BridgeSectionState;
  direction: BridgeDirection;
  amount: string;
}
