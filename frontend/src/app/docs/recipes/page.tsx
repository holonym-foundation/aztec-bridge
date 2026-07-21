import React from 'react'
import DocsLayout, { Callout, Code, P, UL, type DocsSection } from '@/components/DocsLayout'
import CodeBlock from '@/components/CodeBlock'

export const metadata = {
  title: 'Recipes · Shield | For Devs',
  description:
    'What you can build with the Clean SDK: the AEX Privacy Guard agent, private payroll/treasury, a compliant OTC desk, private donations, and an SDK-embedded wallet.',
}

/** Greppable subject-matter-review marker, rendered visibly. */
function SmeReview({ who, children }: { who: string; children: React.ReactNode }) {
  return (
    <Callout tone="warning">
      <strong>NEEDS SME REVIEW ({who}).</strong> {children}
    </Callout>
  )
}

const sections: DocsSection[] = [
  {
    id: 'intro',
    label: 'What you can build',
    content: (
      <>
        <P>
          Every recipe below uses only the real <Code>@human.tech/clean.sdk</Code> surface documented in the{' '}
          <a href="/docs/developers" className="text-latest-blue-100 underline">Developer Guide</a>. The building blocks
          are always the same: authenticate once, optionally pre-check attestation eligibility, then move value with{' '}
          <Code>bridgeL1ToL2</Code> or <Code>withdrawL2ToL1</Code> in public or private mode, and observe progress
          through <Code>onEvent</Code>. Private mode is what makes these compliant-yet-confidential.
        </P>
        <Callout tone="info">
          No recipe here invents an SDK method. If a call is not in the Developer Guide, it is not real. Wallet signing
          and transaction sending are always your wallet&apos;s functions, passed in as <Code>signMessage</Code> /{' '}
          <Code>sendTransaction</Code> / a <Code>walletAdapter</Code>.
        </Callout>
      </>
    ),
  },
  {
    id: 'aex-privacy-guard',
    label: 'AEX Privacy Guard agent',
    content: (
      <>
        <P>
          <strong>What it is.</strong> AEX (the agent exchange) hosts autonomous agents that hold their own WaaP wallets
          and transact on a user&apos;s behalf. The <strong>Privacy Guard</strong> is an agent that acts as a compliance
          and privacy gate in front of any outbound move: before it shields funds into private mode, it confirms the
          controlling address is attestation-eligible (which runs sanctions screening on the backend), and only then
          bridges privately. If the agent is interrupted mid-flow, it resumes the exact operation rather than
          double-spending.
        </P>
        <P>
          <strong>SDK calls.</strong> <Code>authenticate</Code>, <Code>getAttestationStatus</Code> /{' '}
          <Code>checkPochEligibility</Code> / <Code>checkPassportEligibility</Code>, <Code>bridgeL1ToL2</Code> (with{' '}
          <Code>isPrivate: true</Code>), <Code>onEvent</Code>, <Code>getOperations</Code>, and <Code>resume</Code>.
        </P>
        <CodeBlock>{`import { HumanTechBridge, ACTIVE_DEPLOYMENT_ID, BridgeEventType } from '@human.tech/clean.sdk'

// The agent runs headless (Node), so pass an explicit domain and RPC URL.
const bridge = new HumanTechBridge({
  l1RpcUrl: process.env.L1_RPC_URL!,          // your own endpoint; never a shared key in client code
  deployment: ACTIVE_DEPLOYMENT_ID,
  domain: 'aex.human.tech',
})

// 1. Authenticate the agent's bound (L1, L2) wallet pair once, persist the JWT.
const { token } = await bridge.authenticate({
  l1Address: agent.l1Address,
  l2Address: agent.l2Address,
  domain: 'aex.human.tech',
  uri: 'https://aex.human.tech',
  chainId: agent.l1ChainId,
  signMessage: (msg) => agent.wallet.signMessage(msg),
})
bridge.setAuthToken(token)

// 2. Compliance gate: only proceed if the controlling address is eligible.
//    checkPochEligibility() consumes no nonce, so it is safe as a pre-check.
const poch = await bridge.checkPochEligibility()
if (!poch.eligible) {
  const passport = await bridge.checkPassportEligibility()
  if (!passport.eligible) {
    throw new Error('Privacy Guard: address not eligible for a private move; halting.')
  }
}

// 3. Shield the funds privately, watching every lifecycle event for policy hooks.
const result = await bridge.bridgeL1ToL2({
  token: 'USDC',
  amount: policy.amount,
  l1Address: agent.l1Address,
  l2Address: agent.l2Address,
  isPrivate: true,
  fuel: { enabled: true, amount: '5', fuelType: 'private' }, // must be 'private' in private mode
  sendTransaction: (tx) => agent.wallet.sendTransaction(tx),
  walletAdapter: agent.aztecWalletAdapter,
  signMessage: (msg) => agent.wallet.signMessage(msg),
  signTypedData: (addr, json) => agent.wallet.signTypedData(addr, JSON.parse(json)),
  onEvent: (event) => {
    if (event.type === BridgeEventType.DO_NOT_RELOAD) agent.lockCriticalSection()
    agent.telemetry(event.type, event)
  },
})

// 4. On restart, resume anything left incomplete instead of re-bridging.
for (const op of await bridge.getOperations()) {
  if (op.status !== 'completed' && op.status !== 'failed') {
    await bridge.resume(op.id, {
      signMessage: (msg) => agent.wallet.signMessage(msg),
      sendTransaction: (tx) => agent.wallet.sendTransaction(tx),
      walletAdapter: agent.aztecWalletAdapter,
    })
  }
}`}</CodeBlock>
        <SmeReview who="Caleb, eng">
          The AEX product behavior above (agent-held WaaP wallets, Privacy Guard as a screening gate, WaaP as the default
          agent wallet) is sourced from internal AEX and AEX-Arkhai notes, not from this repo. Confirm the agent&apos;s
          real wallet model and whether the Privacy Guard invokes the SDK exactly as sketched before this ships as an
          official integration example. The SDK calls themselves are real; the agent framing is the part to verify.
        </SmeReview>
      </>
    ),
  },
  {
    id: 'payroll-treasury',
    label: 'Private payroll / treasury',
    content: (
      <>
        <P>
          <strong>What it is.</strong> A treasury or payroll operator shields operating capital into private mode so that
          balances, counterparties, and payment history stay confidential on Aztec, then distributes within L2. Because
          the bridge enforces a 1:1 L1-to-L2 address binding, this pattern funds one verified operations wallet privately
          and does the fan-out on L2, rather than binding one attestation across many wallets.
        </P>
        <P>
          <strong>SDK calls.</strong> <Code>authenticate</Code>, <Code>bridgeL1ToL2</Code> (private, with{' '}
          <Code>fuel</Code> so the L2 wallet can pay for its own claims and later transfers), <Code>getFuelQuote</Code>{' '}
          to preview gas, <Code>onEvent</Code>.
        </P>
        <CodeBlock>{`// Preview how much Fee Juice a $5 top-up buys before committing.
const quote = await bridge.getFuelQuote({ token: 'USDC', fuelAmount: '5', slippageBps: 300 })
console.log('expected FeeJuice:', quote.expectedOutput, 'min:', quote.minOutput)

// Shield the payroll float privately and fund L2 gas in the same operation.
await bridge.bridgeL1ToL2({
  token: 'USDC',
  amount: payrollFloat,          // e.g. one pay-cycle of operating capital
  l1Address: treasury.l1Address,
  l2Address: treasury.opsL2Address,
  isPrivate: true,
  fuel: { enabled: true, amount: '10', fuelType: 'private' },
  sendTransaction: (tx) => treasury.wallet.sendTransaction(tx),
  walletAdapter: treasury.aztecWalletAdapter,
  signMessage: (msg) => treasury.wallet.signMessage(msg),
  signTypedData: (addr, json) => treasury.wallet.signTypedData(addr, JSON.parse(json)),
  onEvent: (e) => treasury.audit(e),
})
// Distribution to individual recipients happens with your Aztec wallet on L2,
// using the private cUSDC now held by the ops wallet.`}</CodeBlock>
        <Callout tone="warning">
          Alpha per-user daily deposit caps apply to the bridging leg. Size the float to the cap, or spread deposits
          across the rolling 24-hour window. See <a href="/docs/users#limits" className="text-latest-blue-100 underline">Rate limits and caps</a>.
        </Callout>
      </>
    ),
  },
  {
    id: 'otc-desk',
    label: 'Compliant OTC desk',
    content: (
      <>
        <P>
          <strong>What it is.</strong> An OTC or market-making desk that needs a CEX-clean settlement path: the
          counterparty is proven clean (Proof of Clean Hands), the trade settles in private mode so size and timing do
          not leak, and the desk can exit publicly to a clean address afterward.
        </P>
        <P>
          <strong>SDK calls.</strong> <Code>getAttestationStatus</Code> and <Code>checkPochEligibility</Code> to gate the
          counterparty, <Code>bridgeL1ToL2</Code> (private) to settle in, <Code>withdrawL2ToL1</Code> to exit.
        </P>
        <CodeBlock>{`// Gate: require full Proof of Clean Hands (no per-transaction cap) for desk size.
const status = await bridge.getAttestationStatus()
const poch = await bridge.checkPochEligibility()
if (!poch.eligible) {
  throw new Error('Counterparty must complete Proof of Clean Hands before OTC settlement.')
}

// Settle in privately...
await bridge.bridgeL1ToL2({
  token: 'USDC', amount: ticket.size,
  l1Address: desk.l1Address, l2Address: desk.l2Address,
  isPrivate: true,
  sendTransaction: (tx) => desk.wallet.sendTransaction(tx),
  walletAdapter: desk.aztecWalletAdapter,
  signMessage: (msg) => desk.wallet.signMessage(msg),
  onEvent: (e) => desk.record(ticket.id, e),
})

// ...and later exit to a clean L1 address.
await bridge.withdrawL2ToL1({
  token: 'cUSDC', amount: ticket.size,
  l1Address: desk.settlementL1Address, l2Address: desk.l2Address,
  isPrivate: true,
  sendTransaction: (tx) => desk.wallet.sendTransaction(tx),
  walletAdapter: desk.aztecWalletAdapter,
  signMessage: (msg) => desk.wallet.signMessage(msg),
  onEvent: (e) => desk.record(ticket.id, e),
})`}</CodeBlock>
        <P>
          Private exits re-run sanctions screening and require a fresh, address-bound attestation, so a desk that was
          clean at entry still has to be clean at exit.
        </P>
      </>
    ),
  },
  {
    id: 'private-donations',
    label: 'Private donation flow',
    content: (
      <>
        <P>
          <strong>What it is.</strong> Donors contribute to a cause without their giving being publicly linkable, while
          the receiving organization still gets a clean, screened inflow. Each donor shields their own gift privately;
          the organization holds private cUSDC and can withdraw when it needs fiat rails.
        </P>
        <P>
          <strong>SDK calls.</strong> <Code>bridgeL1ToL2</Code> (private) per donor, <Code>getOperations</Code> /{' '}
          <Code>getOperation</Code> for the organization&apos;s reconciliation, <Code>withdrawL2ToL1</Code> to cash out.
        </P>
        <CodeBlock>{`// Donor side: a one-shot private contribution to the org's L2 address.
await bridge.bridgeL1ToL2({
  token: 'USDC', amount: donation.amount,
  l1Address: donor.l1Address, l2Address: org.l2Address,
  isPrivate: true,
  fuel: { enabled: true, amount: '1', fuelType: 'private' },
  sendTransaction: (tx) => donor.wallet.sendTransaction(tx),
  walletAdapter: donor.aztecWalletAdapter,
  signMessage: (msg) => donor.wallet.signMessage(msg),
  signTypedData: (addr, json) => donor.wallet.signTypedData(addr, JSON.parse(json)),
  onEvent: (e) => donor.showProgress(e),
})

// Org side: reconcile received operations for its own records.
const ops = await bridge.getOperations()
const inflows = ops.filter((o) => o.status === 'completed')`}</CodeBlock>
        <Callout tone="info">
          Donating to an address is not the same as gifting gas. Fee Juice is non-transferable once it lands, so a donor
          who funds fuel to the org&apos;s address gives the org a claim link, not movable gas. See{' '}
          <a href="/docs/users#fuel-links" className="text-latest-blue-100 underline">Sharing gas</a>.
        </Callout>
      </>
    ),
  },
  {
    id: 'embedded-wallet',
    label: 'SDK-embedded wallet',
    content: (
      <>
        <P>
          <strong>What it is.</strong> A wallet app that embeds bridging directly, instead of sending users to a separate
          bridge site. The wallet already has an Aztec account, so it implements the SDK&apos;s{' '}
          <Code>WalletAdapterInterface</Code> around its own signer and calls the bridge in-process. This is the pattern
          the reference Next.js app in this repo uses.
        </P>
        <P>
          <strong>SDK calls.</strong> <Code>verifySession</Code> to restore a session on launch, <Code>authenticate</Code>{' '}
          when there is none, a <Code>walletAdapter</Code> implementing <Code>WalletAdapterInterface</Code>, and{' '}
          <Code>bridgeL1ToL2</Code> / <Code>withdrawL2ToL1</Code>.
        </P>
        <CodeBlock>{`import type { WalletAdapterInterface } from '@human.tech/clean.sdk'

// Restore a persisted session first; only prompt to sign if it is invalid.
bridge.setAuthToken(store.get('shieldJwt'))
const session = await bridge.verifySession()
if (!session.valid) {
  const { token } = await bridge.authenticate({
    l1Address, l2Address,
    domain: window.location.host,
    uri: window.location.origin,
    chainId,
    signMessage: (msg) => wallet.signMessage(msg),
  })
  store.set('shieldJwt', token)
  bridge.setAuthToken(token)
}

// Wrap the wallet's own Aztec signer as the adapter the SDK expects.
const walletAdapter: WalletAdapterInterface = {
  bridgeAddress: activeBridgeAddress,
  async executeCall(contractAddress, method, args, options) {
    return { txHash: await wallet.aztec.call(contractAddress, method, args, options) }
  },
  async executeWithdrawToL1Private(l1Address, amount, nonce, cleanHands, passport, l2Address) {
    return wallet.aztec.withdrawPrivate(l1Address, amount, nonce, cleanHands, passport, l2Address)
  },
  async executeWithdrawToL1Public(l1Address, amount, nonce, cleanHands, passport, l2Address) {
    return wallet.aztec.withdrawPublic(l1Address, amount, nonce, cleanHands, passport, l2Address)
  },
  async registerToken(tokenAddress) { await wallet.aztec.registerToken(tokenAddress) },
}`}</CodeBlock>
        <Callout tone="info">
          Register the token and bridge contracts with your wallet&apos;s PXE before bridging, or the L2 claim fails. The
          Next.js app in this monorepo is a complete, working reference for the adapter and PXE registration.
        </Callout>
      </>
    ),
  },
]

export default function RecipesDocsPage() {
  return (
    <DocsLayout
      title="Recipes"
      subtitle="What you can build with the Clean SDK."
      sections={sections}
    />
  )
}
