import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { Token } from '../constants/tokens.js';

export interface DeployedContracts {
  symbol: string;
  decimals: number;
  logo: string;
  l1TokenContract: string;
  l2TokenContract: string;
  l2BridgeContract: string;
  l1PortalContract: string;
  feeAssetHandler: string;
  sponsoredFee: string;
}

export interface DeployedTokensData {
  deployedAt: string;
  sponsoredFeeAddress: string;
  tokens: DeployedContracts[];
}

const DEPLOYED_TOKENS_FILE = join('constants', 'deployed-tokens.json');

export function ensureDeploymentEnvironment() {
  // Ensure the constants directory exists
  const dir = dirname(DEPLOYED_TOKENS_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
  
  // Create initial JSON file if it doesn't exist
  if (!existsSync(DEPLOYED_TOKENS_FILE)) {
    const initialData: DeployedTokensData = {
      deployedAt: new Date().toISOString(),
      sponsoredFeeAddress: '',
      tokens: []
    };
    
    writeFileSync(DEPLOYED_TOKENS_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    console.log(`📄 Created initial deployment file: ${DEPLOYED_TOKENS_FILE}`);
  } else {
    console.log(`📄 Deployment file exists: ${DEPLOYED_TOKENS_FILE}`);
  }
}

export function loadExistingDeployments(): DeployedTokensData | null {
  if (!existsSync(DEPLOYED_TOKENS_FILE)) {
    return null;
  }
  
  try {
    const fileContent = readFileSync(DEPLOYED_TOKENS_FILE, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading deployed tokens file:', error);
    return null;
  }
}

export function saveTokenToFile(deployedContract: DeployedContracts, sponsoredFeeAddress: string) {
  let existingData = loadExistingDeployments();
  
  if (!existingData) {
    existingData = {
      deployedAt: new Date().toISOString(),
      sponsoredFeeAddress,
      tokens: []
    };
  }
  
  // Update sponsored fee address if provided
  if (sponsoredFeeAddress) {
    existingData.sponsoredFeeAddress = sponsoredFeeAddress;
  }
  
  // Remove existing token with same symbol if it exists
  existingData.tokens = existingData.tokens.filter(token => token.symbol !== deployedContract.symbol);
  
  // Add the new token
  existingData.tokens.push(deployedContract);
  
  // Save to file
  writeFileSync(DEPLOYED_TOKENS_FILE, JSON.stringify(existingData, null, 2), 'utf8');
  console.log(`✅ Saved ${deployedContract.symbol} contract addresses to ${DEPLOYED_TOKENS_FILE}`);
}

export function generateSimpleTypescriptFile() {
  const fileContent = `// Auto-generated file - Do not edit manually
// Import deployed tokens from JSON file

import deployedTokensData from './deployed-tokens.json';

export const DEPLOYED_TOKENS = deployedTokensData;

// Helper function to get token by symbol
export function getTokenBySymbol(symbol: string) {
  return deployedTokensData.tokens.find(token => token.symbol === symbol);
}

// Helper function to get all deployed tokens
export function getAllTokens() {
  return deployedTokensData.tokens;
}

export type DeployedToken = typeof deployedTokensData.tokens[0];
`;

  const filePath = join('constants', 'deployed-tokens.ts');
  writeFileSync(filePath, fileContent, 'utf8');
  console.log(`📝 Generated simple TypeScript file: ${filePath}`);
} 