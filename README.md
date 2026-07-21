# Shield — human.tech's bridge to Aztec

Shield is human.tech's privacy-preserving, accountable bridge to Aztec, the first app built on the [Clean SDK](https://human.tech/clean-sdk). Live at https://shield.human.tech.

A visual overview of the Aztec Bridge flow:

![Aztec Bridge Flow](docs/aztec%20bridge%20flow.png)

A comprehensive bridge application for transferring tokens between Ethereum (L1) and Aztec Network (L2), featuring a modern React/Next.js frontend with seamless Web3 integration.

## ⚠️ **Aztec Mainnet Alpha — Use Caution**

Active deployment: **Ethereum mainnet (L1) + Aztec Mainnet Alpha v5 (L2)** with real ZK proofs, live per `bridge-script/deployments/registry.json`.

**Try without real funds:** a public testnet is live at [testnet.shield.human.tech](https://testnet.shield.human.tech/).

**Aztec is in Alpha**, not full production:

- ~1 TPS, ~6s block times (blocks bundled into ~72s checkpoints settled to L1)
- Ongoing audits + bug bounty (see [aztec.network/blog/alpha-network-security-what-to-expect](https://aztec.network/blog/alpha-network-security-what-to-expect))
- Aztec advises users to only deposit funds they can afford to lose

**Bridge-specific:**

- Audited by Nethermind Security (NM-0756, May 2026); all findings resolved
- Public launch shipped with Aztec v5 (21 July 2026)

Prior testnet deployments (Sepolia + Aztec testnet 4.2.0-rc.1) remain in `bridge-script/deployments/` for historical reference but are no longer the active deployment.

## 🌟 Overview

Shield enables users to:
- Bridge tokens between Ethereum Layer 1 and Aztec Layer 2
- Bridge USDC today, with more ERC-20 assets planned
- Interact with Aztec's privacy-preserving Layer 2 network
- Use sponsored transactions for improved UX
- Connect multiple wallet types including MetaMask and WaaP

## 📦 Clean SDK

Shield is the first app built on **Clean SDK** ([`@human.tech/clean.sdk`](https://www.npmjs.com/package/@human.tech/clean.sdk)), human.tech's programmable privacy toolkit. The SDK lives in [`packages/sdk/`](packages/sdk) — any app, on Aztec or any chain, can integrate it to give its users private, accountable transactions by routing funds through Aztec.

```bash
npm install @human.tech/clean.sdk
```

Links: [npm](https://www.npmjs.com/package/@human.tech/clean.sdk) · [User Guide](https://shield.human.tech/docs/users) · [Developer Guide](https://shield.human.tech/docs/developers) · [Clean SDK overview](https://human.tech/clean-sdk)

## 🏗️ Architecture

```
shield.human.tech/
├── frontend/           # Next.js React application
├── bridge-script/      # Bridge automation scripts
├── l1-contracts/       # L1 smart contracts (Foundry)
├── aztec-contracts/    # L2 Aztec contracts (Noir)
└── .github/           # CI/CD workflows
```

### Key Components

- **Frontend**: Modern Next.js app with TypeScript, Tailwind CSS, and Web3 integrations
- **Bridge Scripts**: Automated bridging logic and deployment scripts
- **L1 Contracts**: Ethereum smart contracts for token portals and handlers
- **L2 Contracts**: Aztec Noir contracts for private token management

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Foundry (for L1 contracts)
- Aztec CLI (for L2 contracts)

### Installation

```bash
# Clone the repository
git clone https://github.com/holonym-foundation/shield.human.tech.git
cd shield.human.tech

# Install frontend dependencies
cd frontend
pnpm install

# Install bridge script dependencies
cd ../bridge-script
pnpm install
```

### Environment Setup

Create environment files for sensitive configuration:

```bash
# Frontend (.env.local)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
FAUCET_PRIVATE_KEY=0x...
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/...
ALCHEMY_API_KEY=your_alchemy_key

# Bridge Scripts (.env)
L1_URL=https://sepolia.infura.io/v3/...
MNEMONIC=your_test_mnemonic
PXE_URL=http://localhost:8081
```

### Development

```bash
# Start the frontend development server
cd frontend
pnpm dev

# The app will be available at http://localhost:3000
```

## 🔧 Development Scripts

### Frontend Commands

```bash
cd frontend

# Development
pnpm dev          # Start dev server with Turbo
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

### Bridge Scripts

```bash
cd bridge-script

# Bridge operations
node index.js                    # Run main bridge script
node index-testnet.js           # Run testnet deployment
node fees.ts                    # Fee management utilities
```

### L1 Contracts (Foundry)

```bash
cd l1-contracts

# Contract operations
forge build       # Compile contracts
forge test         # Run tests
forge deploy       # Deploy contracts
```

## 🌐 Supported Networks

### Layer 1 (Ethereum)
- **Mainnet**: Ethereum Mainnet (active deployment)
- **Testnet**: Sepolia (historical/dev only)

### Layer 2 (Aztec)
- **Mainnet**: Aztec Mainnet Alpha v5 (active deployment)
- **Testnet**: Aztec Testnet (historical/dev only)

## 🎨 Frontend Features

### Modern UI/UX
- **Design System**: Custom Tailwind CSS components
- **Responsive**: Mobile-first responsive design
- **Dark Mode**: Theme support
- **Toast Notifications**: Real-time user feedback

### Web3 Integration
- **Multi-Wallet Support**: MetaMask, WaaP, WalletConnect
- **Token Management**: USDC today, more ERC-20 assets planned
- **Transaction Tracking**: Real-time transaction status
- **Gas Optimization**: Sponsored transactions support

### Data & Analytics
- **Datadog Integration**: Performance monitoring and logging
- **React Query**: Efficient data fetching and caching
- **Persistent State**: Local storage persistence

## 🔐 Security

### Basic Security Practices Implemented
- ✅ Environment variables for all sensitive data
- ✅ Proper secret management in CI/CD
- ✅ No hardcoded production credentials
- ✅ Basic input validation

### Environment Variables
All sensitive information is properly managed through environment variables:
- API keys, private keys, and RPC URLs are never committed
- Production secrets are managed through Vercel and GitHub Secrets
- Test values are clearly marked and separated from production

## 🚀 Deployment

### Vercel Deployment (Automated)
The project uses GitHub Actions for automated deployment:

```yaml
# Triggers on main branch push
# Deploys to both preview and production environments
# Manages environment variables securely
```

### Manual Deployment

```bash
# Build and deploy frontend
cd frontend
pnpm build
vercel --prod

# Deploy L1 contracts
cd l1-contracts
forge script script/Deploy.s.sol --broadcast
```

## 🧪 Testing

### Frontend Testing
```bash
cd frontend
pnpm test          # Run unit tests
pnpm test:e2e      # Run end-to-end tests
```

### Contract Testing
```bash
cd l1-contracts
forge test         # Test L1 contracts

cd aztec-contracts
aztec test         # Test L2 contracts
```

## 📚 API Reference

### Bridge API Endpoints

#### Faucet (testnet/dev only)
- `POST /api/faucet` - Request test ETH for gas fees
- Body: `{ "address": "0x..." }`

#### Token Minting (testnet/dev only)
- `POST /api/mint-tokens` - Mint test tokens
- Body: `{ "address": "0x...", "amount": "1000" }`

#### Alchemy Integration
- `GET /api/alchemy/nfts` - Fetch user NFTs
- `GET /api/alchemy/tokens-balances` - Get token balances

## 🛠️ Development Workflow

### Code Quality
- **ESLint**: Configured with Next.js and React rules
- **Prettier**: Code formatting
- **TypeScript**: Full type safety
- **Git Hooks**: Pre-commit validation

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: Feature development

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Maintain test coverage
- Update documentation for new features
- Ensure security review for sensitive changes

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` directory
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions

## 🔗 Links

- Shield: [app](https://shield.human.tech) · [docs](https://shield.human.tech/docs) · [support](https://support.shield.human.tech) · [testnet](https://testnet.shield.human.tech/)
- [Clean SDK](https://human.tech/clean-sdk)
- [Aztec Network](https://aztec.network/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Foundry Book](https://book.getfoundry.sh/)
- [Noir Documentation](https://noir-lang.org/)

---

Built with ❤️ for the Aztec ecosystem
