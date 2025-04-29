import { useState, useCallback, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { getContract } from 'viem';
import { ADDRESS } from '@/config';
import { TestERC20Abi } from '@aztec/l1-artifacts';
import { TokenPortalAbi } from '@aztec/l1-artifacts';
import { useAccount as useAztecAccount } from '@nemi-fi/wallet-sdk/react';
import { sdk } from '@/aztec';
import { Contract } from '@nemi-fi/wallet-sdk/eip1193';
import { TokenContract } from '@aztec/noir-contracts.js/Token';
import { AztecAddress } from '@aztec/aztec.js';

// L2 Token contract wrapper
class L2Token extends Contract.fromAztec(TokenContract) {}

export function useBridgeV2() {
  // L1 (MetaMask)
  const { address: l1Address, isConnected: isL1Connected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // L2 (Obsidian/Aztec)
  const aztecAccount = useAztecAccount(sdk);
  const isL2Connected = !!aztecAccount;

  // L1 Contracts
  const l1TokenContract = getContract({
    address: ADDRESS[11155111].L1.TOKEN_CONTRACT,
    abi: TestERC20Abi,
    client: publicClient,
  });
  const l1PortalContract = getContract({
    address: ADDRESS[11155111].L1.PORTAL_CONTRACT,
    abi: TokenPortalAbi,
    client: publicClient,
  });

  // L2 Contracts (stateful, async init)
  const [l2TokenContract, setL2TokenContract] = useState<any>(null);
  useEffect(() => {
    let ignore = false;
    async function init() {
      if (aztecAccount) {
        const contract = await L2Token.at(
          AztecAddress.fromString(ADDRESS[1337].L2.TOKEN_CONTRACT),
          aztecAccount
        );
        if (!ignore) setL2TokenContract(contract);
      }
    }
    init();
    return () => { ignore = true; };
  }, [aztecAccount]);

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [l1Balance, setL1Balance] = useState<string>('0');
  const [l2Balance, setL2Balance] = useState<string>('0');

  // L1 Balance
  const getL1Balance = useCallback(async () => {
    if (!l1Address) return;
    try {
      setLoading(true);
      const balance = await l1TokenContract.read.balanceOf([l1Address]);
      setL1Balance(balance.toString());
      setLoading(false);
      return balance;
    } catch (e) {
      setError('Failed to fetch L1 balance');
      setLoading(false);
    }
  }, [l1Address, l1TokenContract]);

  // L2 Balance
  const getL2Balance = useCallback(async () => {
    if (!aztecAccount || !l2TokenContract) return;
    try {
      setLoading(true);
      const balance = await l2TokenContract.methods.balance_of_public(aztecAccount.address).simulate();
      setL2Balance(balance.toString());
      setLoading(false);
      return balance;
    } catch (e) {
      setError('Failed to fetch L2 balance');
      setLoading(false);
    }
  }, [aztecAccount, l2TokenContract]);

  // Bridge tokens to L2
  const bridgeTokensToL2 = useCallback(async (amount: bigint) => {
    if (!l1Address || !walletClient || !l1TokenContract || !l1PortalContract) {
      setError('L1 wallet or contracts not ready');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Approve the portal contract to spend tokens
      await walletClient.writeContract({
        address: ADDRESS[11155111].L1.TOKEN_CONTRACT,
        abi: TestERC20Abi,
        functionName: 'approve',
        args: [ADDRESS[11155111].L1.PORTAL_CONTRACT, amount],
        account: l1Address,
      });
      // 2. Call the portal contract to deposit to Aztec public
      await walletClient.writeContract({
        address: ADDRESS[11155111].L1.PORTAL_CONTRACT,
        abi: TokenPortalAbi,
        functionName: 'depositToAztecPublic',
        args: [ADDRESS[1337].L2.TOKEN_CONTRACT, amount, l1Address],
        account: l1Address,
      });
      setLoading(false);
    } catch (e: any) {
      setError(e.message || 'Failed to bridge tokens to L2');
      setLoading(false);
    }
  }, [l1Address, walletClient, l1TokenContract, l1PortalContract]);

  // Withdraw tokens to L1
  const withdrawTokensToL1 = useCallback(async (amount: bigint) => {
    if (!aztecAccount || !l2TokenContract) {
      setError('L2 wallet or contract not ready');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Call the L2 contract to withdraw tokens
      await l2TokenContract.methods.withdraw_public(
        aztecAccount.address,
        amount
      ).send();
      // 2. (Optional) Wait for message to be available on L1, then call L1 portal contract to finalize withdrawal
      // This step depends on your bridge design and may require polling or event listening
      setLoading(false);
    } catch (e: any) {
      setError(e.message || 'Failed to withdraw tokens to L1');
      setLoading(false);
    }
  }, [aztecAccount, l2TokenContract]);

  return {
    isL1Connected,
    isL2Connected,
    l1Address,
    aztecAccount,
    loading,
    error,
    l1Balance,
    l2Balance,
    getL1Balance,
    getL2Balance,
    bridgeTokensToL2,
    withdrawTokensToL1,
    l1TokenContract,
    l2TokenContract,
    l1PortalContract,
  };
} 