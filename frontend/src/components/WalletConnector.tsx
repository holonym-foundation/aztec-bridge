import React, { useState } from 'react';
import { useMetaMask } from '../hooks/useMetaMask';
import { useAztecWallet } from '../hooks/useAztecWallet';

export function WalletConnector() {
  const [activeWallet, setActiveWallet] = useState<'metamask' | 'aztec' | null>(null);
  
  // MetaMask integration
  const { 
    address: metaMaskAddress, 
    isConnected: isMetaMaskConnected, 
    connect: connectMetaMask, 
    disconnect: disconnectMetaMask 
  } = useMetaMask();
  
  // Aztec wallet integration
  const { 
    account: aztecAccount, 
    address: aztecAddress,
    isConnected: isAztecConnected, 
    isConnecting: isAztecConnecting,
    connect: connectAztec, 
    disconnect: disconnectAztec 
  } = useAztecWallet();

  const handleConnectMetaMask = async () => {
    setActiveWallet('metamask');
    await connectMetaMask();
  };

  const handleConnectAztec = async () => {
    setActiveWallet('aztec');
    await connectAztec();
  };

  const handleDisconnect = async () => {
    if (activeWallet === 'metamask') {
      await disconnectMetaMask();
    } else if (activeWallet === 'aztec') {
      await disconnectAztec();
    }
    setActiveWallet(null);
  };

  return (
    <div className="wallet-connector">
      <h2>Wallet Connector</h2>
      
      <div className="wallet-section">
        <h3>MetaMask</h3>
        {isMetaMaskConnected ? (
          <div>
            <p>Connected: {metaMaskAddress}</p>
            <button onClick={handleDisconnect}>Disconnect MetaMask</button>
          </div>
        ) : (
          <button onClick={handleConnectMetaMask}>Connect MetaMask</button>
        )}
      </div>
      
      {/* Only show Aztec wallet section if MetaMask is connected */}
      {isMetaMaskConnected && (
        <div className="wallet-section">
          <h3>Obsidian Wallet</h3>
          {isAztecConnected ? (
            <div>
              <p>Connected: {aztecAccount?.address?.toString()}</p>
              <button onClick={handleDisconnect}>Disconnect Obsidian</button>
            </div>
          ) : (
            <button 
              onClick={handleConnectAztec}
              disabled={isAztecConnecting}
            >
              {isAztecConnecting ? 'Connecting...' : 'Connect Obsidian Wallet'}
            </button>
          )}
        </div>
      )}
    </div>
  );
} 