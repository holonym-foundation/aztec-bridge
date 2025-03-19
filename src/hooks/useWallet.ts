import { useState, useEffect } from 'react';

interface ConnectOptions {
  name: string;
}

interface Permission {
  chains: string[];
  methods: string[];
}

interface AzguardWallet {
  connected: boolean;
  accounts: string[];
  connect: (options: ConnectOptions, permissions: Permission[]) => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useWallet = () => {
  const [wallet, setWallet] = useState<AzguardWallet | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const initWallet = async () => {
      try {
        if (typeof window === 'undefined') return;
        
        const { AzguardClient } = await import('@azguardwallet/client');
        
        // Check if Azguard Wallet extension is installed
        if (!AzguardClient.isAzguardInstalled()) {
          alert('Please install Azguard Wallet extension to use this application');
          return;
        }

        const azguardWallet = await AzguardClient.create();
        setWallet(azguardWallet);
        
        // Check if already connected
        const connected = await azguardWallet.connected;
        setIsConnected(connected);
        
        if (connected) {
          setAddress(azguardWallet.accounts[0]);
        }
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
      }
    };

    initWallet();
  }, []);

  const connect = async () => {
    try {
      if (!wallet) {
        throw new Error('Wallet not initialized');
      }
      
      await wallet.connect(
        {
          name: "Holonym Aztec Bridge"
        },
        [
          {
            chains: [
              // "aztec:41337",  // Main Aztec network
              "aztec:31337"   // Sandbox network
            ],
            methods: ["send_transaction", "add_private_authwit", "call"],
          }
        ]
      );
      setAddress(wallet.accounts[0]);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      if (!wallet) {
        throw new Error('Wallet not initialized');
      }
      
      await wallet.disconnect();
      setAddress(null);
      setIsConnected(false);
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  };

  return {
    wallet,
    isConnected,
    address,
    connect,
    disconnect,
  };
}; 