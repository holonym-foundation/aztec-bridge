import { useState } from 'react';
import { TokenPortalAbi } from '@aztec/l1-artifacts/TokenPortalAbi';
import { TestERC20Abi } from '@aztec/l1-artifacts/TestERC20Abi';
import { extractEvent } from '@aztec/ethereum/utils';
import { getContract, type Hex } from 'viem';
import type { ViemPublicClient, ViemWalletClient } from '@aztec/ethereum';
import { EthAddress } from '@aztec/aztec.js/eth_address';
import { AztecAddress, generateClaimSecret, L2AmountClaim } from '@aztec/aztec.js';

export type BridgingStatus = 'idle' | 'approving' | 'bridging' | 'completed' | 'error';

export function useL1BridgeToL2() {
  const [status, setStatus] = useState<BridgingStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const bridgeTokens = async (
    recipientAddress: AztecAddress,
    amount: bigint,
    tokenAddress: EthAddress,
    portalAddress: EthAddress,
    publicClient: ViemPublicClient,
    walletClient: ViemWalletClient,
  ): Promise<L2AmountClaim> => {
    try {
      setStatus('approving');
      setError(null);

      // Get token contract instance
      const tokenContract = getContract({
        address: tokenAddress.toString(),
        abi: TestERC20Abi,
        client: walletClient,
      });

      // Get portal contract instance
      const portalContract = getContract({
        address: portalAddress.toString(),
        abi: TokenPortalAbi,
        client: walletClient,
      });

      // Check allowance
      const userAddress = walletClient.account.address;
      const allowance = await tokenContract.read.allowance([userAddress, portalAddress.toString()]);
      
      // Approve tokens if necessary
      if (allowance < amount) {
        const approveTxHash = await tokenContract.write.approve([portalAddress.toString(), amount]);
        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      }

      // Generate claim secret and hash
      const [claimSecret, claimSecretHash] = await generateClaimSecret();
      
      // Bridge tokens
      setStatus('bridging');
      
      const { request } = await portalContract.simulate.depositToAztecPublic([
        recipientAddress.toString(),
        amount,
        claimSecretHash.toString(),
      ]);

      const txHash = await walletClient.writeContract(request);
      const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      // Extract the event to get the message hash and leaf index
      const log = extractEvent(
        txReceipt.logs,
        portalContract.address,
        portalContract.abi,
        'DepositToAztecPublic',
        log =>
          log.args.secretHash === claimSecretHash.toString() &&
          log.args.amount === amount &&
          log.args.to === recipientAddress.toString(),
      );

      if (!log) {
        throw new Error('Failed to find the deposit event in transaction logs');
      }

      setStatus('completed');
      
      return {
        claimAmount: amount,
        claimSecret,
        claimSecretHash,
        messageHash: log.args.key,
        messageLeafIndex: log.args.index,
      };
    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    }
  };

  const bridgeTokensPrivate = async (
    recipientAddress: AztecAddress,
    amount: bigint,
    tokenAddress: EthAddress,
    portalAddress: EthAddress,
    publicClient: ViemPublicClient,
    walletClient: ViemWalletClient,
  ) => {
    try {
      setStatus('approving');
      setError(null);

      // Get token contract instance
      const tokenContract = getContract({
        address: tokenAddress.toString(),
        abi: TestERC20Abi,
        client: walletClient,
      });

      // Get portal contract instance
      const portalContract = getContract({
        address: portalAddress.toString(),
        abi: TokenPortalAbi,
        client: walletClient,
      });

      // Check allowance
      const userAddress = walletClient.account.address;
      const allowance = await tokenContract.read.allowance([userAddress, portalAddress.toString()]);
      
      // Approve tokens if necessary
      if (allowance < amount) {
        const approveTxHash = await tokenContract.write.approve([portalAddress.toString(), amount]);
        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      }

      // Generate claim secret and hash
      const [claimSecret, claimSecretHash] = await generateClaimSecret();
      
      // Bridge tokens privately
      setStatus('bridging');
      
      const { request } = await portalContract.simulate.depositToAztecPrivate([
        amount,
        claimSecretHash.toString(),
      ]);

      const txHash = await walletClient.writeContract(request);
      const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      // Extract the event to get the message hash and leaf index
      const log = extractEvent(
        txReceipt.logs,
        portalContract.address,
        portalContract.abi,
        'DepositToAztecPrivate',
        log => 
          log.args.amount === amount && 
          log.args.secretHashForL2MessageConsumption === claimSecretHash.toString(),
      );

      if (!log) {
        throw new Error('Failed to find the deposit event in transaction logs');
      }

      setStatus('completed');
      
      return {
        claimAmount: amount,
        claimSecret,
        claimSecretHash,
        recipient: recipientAddress,
        messageHash: log.args.key,
        messageLeafIndex: log.args.index,
      };
    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    }
  };

  return {
    bridgeTokens,
    bridgeTokensPrivate,
    status,
    error,
  };
} 