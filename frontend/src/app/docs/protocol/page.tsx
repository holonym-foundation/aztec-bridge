import React from 'react'
import DocsLayout, { Callout, Code, P, UL, Table, Th, Td, type DocsSection } from '@/components/DocsLayout'

export const metadata = {
  title: 'Protocol & Cryptography · Shield | For Devs',
  description:
    'How Shield combines Aztec privacy with programmable compliance: Proof of Clean Hands circuits, proof of encryption, programmable decryption, the proving system, the smart contracts, and the Human Network.',
}

/**
 * A visible "needs subject-matter review" marker. It renders in the page (so
 * reviewers see it) and is greppable in source (so Nanak/Caleb can be tagged).
 * Keep the literal string "NEEDS SME REVIEW" intact.
 */
function SmeReview({ who, children }: { who: string; children: React.ReactNode }) {
  return (
    <Callout tone="warning">
      <strong>NEEDS SME REVIEW ({who}).</strong> {children}
    </Callout>
  )
}

const sections: DocsSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    content: (
      <>
        <P>
          Shield is a privacy bridge with programmable compliance. Two properties have to hold at once: a deposit into
          private mode must be untraceable on-chain, and it must only be openable by a party the user consented to,
          under conditions the user agreed to. This page explains the cryptography and contracts that make both true.
        </P>
        <P>
          Shield does <strong>not</strong> ship its own zero-knowledge rollup. It is an implementation of the Aztec
          Portal pattern and inherits Aztec&apos;s proving system for all rollup-level proofs. The pieces Shield adds on
          top are: an identity gate (Proof of Clean Hands, with a Human Passport fallback), on-chain signature checks in
          the bridge contracts, and an optional encrypt-to-a-controller path enforced by the Human Network.
        </P>
        <Callout tone="info">
          This page is developer and protocol reference. It is not required reading to bridge funds. If you just want to
          use the app, see the <a href="/docs/users" className="text-latest-blue-100 underline">User Guide</a>.
        </Callout>
      </>
    ),
  },
  {
    id: 'clean-hands-circuits',
    label: 'Proof of Clean Hands (ZK circuits)',
    content: (
      <>
        <P>
          Proof of Clean Hands (PoCH) is a reusable, privacy-preserving identity and sanctions proof. A user verifies
          once, holds the credential on their own device, and then generates unlimited zero-knowledge proofs from it. No
          raw personal data is written on-chain or held by Human Tech; every identity field is Poseidon-hashed inside the
          credential.
        </P>
        <H4>The credential</H4>
        <P>
          At issuance the user completes a government-ID check (passport via NFC, driver&apos;s license, residence
          permit, visa, or voter card) plus a liveness check, and is screened against sanctions, PEP, and watchlist
          sources. On success the issuer signs a credential with EdDSA over the BabyJubJub curve. The credential leaf is a
          Poseidon hash over the issuer key, a secret nullifier, birthdate, a hash of (name, date of birth, address,
          expiry), issuance time, and scope, where <Code>name = Poseidon(firstName, lastName)</Code>. No raw PII enters
          the leaf or the chain.
        </P>
        <UL>
          <li>
            A duplicate-identity nullifier (derived from name and date of birth) blocks re-registration for about 11
            months. This is the Sybil-resistance property.
          </li>
          <li>
            Credentials expire after about one year, with a randomized 0 to 30 day jitter so issuance timestamps cannot
            be correlated.
          </li>
        </UL>
        <H4>The circuit</H4>
        <P>
          The zero-knowledge circuit is Holonym&apos;s <Code>V3CleanHands</Code>, open source in{' '}
          <Code>holonym-foundation/id-hub-contracts</Code>. It proves possession of a validly-issued, unexpired,
          issuer-signed Clean Hands credential whose screening passed at issuance, binds the proof to a recipient, an
          action ID, and a scope, and (see <a href="#proof-of-encryption" className="text-latest-blue-100 underline">Proof of encryption</a>)
          emits a provably-correct encryption of the identity fields. Its public signals are{' '}
          <Code>encryptedTo</Code>, <Code>recipient</Code>, <Code>actionId</Code>, and <Code>expiry</Code>. From one
          credential a user can prove different predicates without re-verifying: &quot;I hold a valid Clean Hands
          credential,&quot; &quot;I am over 18,&quot; &quot;I am not a US person (Reg S),&quot; or &quot;my country is in
          this allowed set.&quot; The verifier learns only that the predicate is true.
        </P>
        <P>
          <strong>Shield&apos;s bridge contracts do not verify this ZK proof directly.</strong> The proof is produced and
          checked in the Human ID and Human Network system; Shield&apos;s bridge contracts verify the{' '}
          <em>attestation signature</em> that the attester issues after a successful PoCH check (see{' '}
          <a href="#smart-contracts" className="text-latest-blue-100 underline">Smart contracts</a>).
        </P>
      </>
    ),
  },
  {
    id: 'proof-of-encryption',
    label: 'Proof of encryption',
    content: (
      <>
        <P>
          A privacy tool hides data. PoCH does something stronger: it makes the same proof that hides your identity also
          carry a provably-recoverable encryption of it. The <Code>V3CleanHands</Code> circuit forces the user to
          ElGamal-encrypt their identity fields (first name, last name, and date of birth, each mapped to BabyJubJub
          points) to a designated audit network, and proves, as a public output of the same proof, that this ciphertext
          is well-formed and corresponds to the exact credential being presented. The single-use ephemeral key used for
          that encryption also signs the on-chain conditions contract, binding this encryption to this release policy.
        </P>
        <P>
          So a valid proof establishes two things at once: &quot;this person is clean,&quot; and &quot;here is an
          encryption of who they are, recoverable only by the audit network, only when a pre-committed on-chain condition
          is met.&quot; Accountability is carried inside the cryptographic object rather than bolted on afterward. This is
          verifiable encryption in the Camenisch-Shoup (2003) sense.
        </P>
        <Callout tone="info">
          Be precise about what the proof does and does not guarantee. It proves the ciphertext is well-formed and bound
          to the credential <em>under the key the circuit was given</em>. It does not, by itself, prove that key is the
          legitimate audit key, nor that the data will only ever be released under the agreed conditions. Those two
          properties are enforced by the attestation checks and by the network and its conditions gate (see{' '}
          <a href="#programmable-decryption" className="text-latest-blue-100 underline">Programmable decryption</a>), not
          by the proof alone.
        </Callout>
      </>
    ),
  },
  {
    id: 'programmable-decryption',
    label: 'Programmable decryption',
    content: (
      <>
        <P>
          If encrypted identity data can ever be recovered, the rules for recovering it are the whole ballgame.
          Programmable decryption means those rules are enforced by a public, pre-committed policy, not by an
          operator&apos;s discretion. The audit ciphertext opens only when an on-chain conditions contract returns{' '}
          <Code>canDecrypt(decryptor, recordHash)</Code> = true for that specific record. Decryption is per-record and
          rate-limited; there is no batch path that could open a whole population at once.
        </P>
        <P>
          When a request is authorized, the plaintext is reconstructed through the threshold network: distributed key
          generation (Feldman-VSS DKG), Lagrange interpolation of partial shares, and a per-node DLEQ proof that each
          share is correct. No single node ever holds the full key or sees the full plaintext (see{' '}
          <a href="#human-network" className="text-latest-blue-100 underline">The Human Network</a>).
        </P>
        <H4>Shipped vs roadmap, stated honestly</H4>
        <UL>
          <li>
            <strong>Today:</strong> the gate is a general-purpose on-chain <Code>canDecrypt</Code> boolean served by a
            single allowlisted decryptor (v0), with a 4-of-6 threshold configuration on testnet at a static epoch 0. A
            specific legal-process binding (for example a verified court-order condition) is a policy the gate{' '}
            <em>can express</em>, not a shipped feature.
          </li>
          <li>
            <strong>Roadmap:</strong> the decentralized threshold network as the default, independent release
            governance, and epoch rotation plus slashing activated in production.
          </li>
        </UL>
        <Callout tone="warning">
          The most important property to state plainly: the conditions gate is checked <em>off-chain, by each
          operator</em>, before it returns its share. The DLEQ proofs guarantee each share is correct; they do not, by
          themselves, prevent a threshold-sized set of colluding operators from reconstructing a record without
          authorization. Unauthorized decryption is deterred by threshold trust plus economic stake (restaking and
          slashing), not by mathematics alone. Two structural limits bound the harm: decryption is strictly per-record
          (no batch), and the quorum is re-drawn from the operator pool each epoch. Users can also elect a semi-trusted
          additive key share, so that operator collusion alone is not sufficient to recover their data.
        </Callout>
      </>
    ),
  },
  {
    id: 'proving-system',
    label: 'The proving system',
    content: (
      <>
        <P>There are two distinct proving systems in play, and it helps to keep them separate.</P>
        <H4>PoCH identity proofs</H4>
        <UL>
          <li>
            The <Code>V3CleanHands</Code> proof is generated client-side, proved through a VOLE-in-the-head adapter.
          </li>
          <li>
            The derived compliance proofs (age, Reg S non-US, country-set membership, EU residency) use the same V3
            Groth16 framework, which carries a trusted-setup assumption.
          </li>
          <li>
            The identity credential itself is signed with EdDSA over BabyJubJub, and the audit encryption is ElGamal over
            BabyJubJub.
          </li>
        </UL>
        <H4>Aztec rollup proving</H4>
        <UL>
          <li>
            All rollup-level proving (transaction execution, state transitions, and the validity proofs posted to and
            verified on Ethereum) is Aztec&apos;s. Shield implements no custom rollup circuits of its own and inherits
            this through the native Portal pattern rather than adding a separate relay or trust assumption.
          </li>
          <li>
            Shield&apos;s deployments run with real proofs enabled (deployment snapshots carry{' '}
            <Code>realProofs: true</Code>), not a mock prover.
          </li>
          <li>
            The only Shield-specific on-chain cryptography is signature verification: ECDSA on L1 and Schnorr over the
            Grumpkin curve on L2 (see <a href="#smart-contracts" className="text-latest-blue-100 underline">Smart contracts</a>).
          </li>
        </UL>
        <SmeReview who="Caleb, eng">
          One genuinely-open item: name the exact Aztec proving-system generation the live v5 deployment targets, if you
          want it stated in public docs. It is an upstream Aztec property tied to the pinned <Code>@aztec</Code> package
          version. Everything else in this section is grounded in the PoCH design and the repo.
        </SmeReview>
      </>
    ),
  },
  {
    id: 'smart-contracts',
    label: 'The smart contracts',
    content: (
      <>
        <P>
          Assets are held 1:1 in the L1 Portal as collateral; L2 tokens are minted on deposit and burned on withdrawal.
          Private mode mints separate &quot;Clean&quot; tokens (for example cUSDC) that are distinct from the public
          token, which is what prevents an unverified public-to-private hop from bypassing the entry check.
        </P>
        <H4>L1 (Ethereum, Solidity)</H4>
        <UL>
          <li>
            <Code>TokenPortal.sol</Code>: core portal. Public and private deposits, withdrawals, fee calculation and
            collection, and compliance verification for private deposits. Two independent pause switches (a full pause,
            and a deposit-only pause that keeps withdrawals live for migration windows).
          </li>
          <li>
            <Code>SwapBridgeRouter.sol</Code>: atomic gas top-up plus deposit in one L1 transaction. Pulls tokens via
            Permit2, routes a portion through the fuel swap for Fee Juice, and deposits both legs. The private path
            requires the router to be registered as a trusted forwarder on each portal.
          </li>
          <li>
            <Code>UniswapFuelSwap.sol</Code>: stateless Uniswap V4 swap from an ERC-20 into Fee Juice, single- or
            multi-hop with a native-ETH intermediary.
          </li>
        </UL>
        <H4>L2 (Aztec, Noir)</H4>
        <UL>
          <li>
            <Code>TokenBridge</Code> (<Code>main.nr</Code>): claims minted tokens (public and private), exits to L1
            (public and private), and verifies compliance for private exits. Attester and signer public keys (Grumpkin)
            are stored in a delayed-mutable slot with a 600-block delay before a key change takes effect, which is the
            response window if an owner key is compromised. Includes nonce replay protection and an owner pause.
          </li>
          <li>
            <Code>TokenMinterProxy</Code> (<Code>main.nr</Code>): an allowlist proxy between the bridge and the token
            contract, so a new bridge version can be authorized without redeploying the token.
          </li>
          <li>
            <Code>Token</Code>: a standard Aztec token contract (AIP-20 compatible), not custom to the bridge.
          </li>
        </UL>
        <H4>Where compliance is enforced</H4>
        <P>Compliance is checked only at the boundary where privacy begins or ends. Public mode has no gate.</P>
        <Table>
          <thead>
            <tr>
              <Th>Operation</Th>
              <Th>Layer</Th>
              <Th>Check</Th>
            </tr>
          </thead>
          <tbody>
            <tr><Td>Public deposit / public exit</Td><Td>n/a</Td><Td>None</Td></tr>
            <tr><Td>Private deposit (L1 to L2)</Td><Td>L1 TokenPortal</Td><Td>Clean Hands or Passport, ECDSA</Td></tr>
            <tr><Td>Private exit (L2 to L1)</Td><Td>L2 TokenBridge</Td><Td>Clean Hands or Passport, Schnorr over Grumpkin, with max amount and deadline</Td></tr>
          </tbody>
        </Table>
        <P>
          In both directions Clean Hands is checked first and Passport is the fallback (amount-capped). Exits also re-run
          sanctions screening and require a fresh, address-bound attestation with a single-use nonce, so a captured
          attestation cannot be replayed.
        </P>
        <Callout tone="info">
          Contract addresses are not hardcoded in these docs on purpose. Read them from the SDK, which treats{' '}
          <Code>deployments.json</Code> as the single source of truth:{' '}
          <Code>getDeployment(ACTIVE_DEPLOYMENT_ID)</Code> returns the active token, portal, bridge, and network
          addresses. That way this page can never drift from the live deployment.
        </Callout>
        <H4>Audit status</H4>
        <P>
          Shield has been audited by <strong>Nethermind Security</strong> and <strong>Hexens</strong>. Nethermind
          covered the bridge contracts and circuits (report NM-0756, May 2026: 1 critical, 2 high, and 3 medium
          findings, all resolved before deployment); Hexens covered the ZK identity circuits and the Human Network.
          Shield still carries early-network risk regardless (see the{' '}
          <a href="/docs/users#alpha" className="text-latest-blue-100 underline">alpha risk notice</a>).
        </P>
        <SmeReview who="Caleb, eng">
          Nethermind and Hexens are the confirmed Shield auditors (Nethermind: bridge contracts and circuits; Hexens: ZK
          ID circuits and Human Network). Halborn is a WaaP (wallet) auditor and is intentionally not listed here.
          Attach the published report references or links when they are available for public docs.
        </SmeReview>
      </>
    ),
  },
  {
    id: 'human-network',
    label: 'The Human Network',
    content: (
      <>
        <P>
          The audit layer runs on the Human Network (network.human.tech), the threshold-cryptography network that holds
          the keys behind Shield&apos;s compliance model. It operates as an Actively Validated Service on restaked
          Ethereum security (EigenLayer and Symbiotic), so its economic security comes from restaked collateral and its
          operator set is decentralized rather than a fixed multisig. The decryption key is never held in one place: it
          is split across operators, and each returns only a partial decryption share.
        </P>
        <UL>
          <li>
            The operator set is public and includes established professional operators (for example Alchemy, Nansen, P2P,
            EigenYields, Pier Two, HashKey, Stakely, and Kelp by Luganodes), on the order of 21 operators across roughly
            two dozen nodes.
          </li>
          <li>
            The network implements Forward-Secure Public-Key Encryption (FSPKE) for the keyshares exchanged between
            operators, so an attacker who records inter-operator traffic and later compromises a node cannot decrypt
            prior-epoch shares. Corruptions accumulated over time do not eventually yield the network secret.
          </li>
          <li>
            The audit encryption is ElGamal over BabyJubJub (a decentralized-ElGamal construction); threshold
            reconstruction uses Feldman-VSS DKG, Lagrange interpolation, and per-node DLEQ correctness proofs.
          </li>
        </UL>
        <P>
          One operational fact matters for how you read the accountability path: to date the network&apos;s production
          workload has been key derivation (a verifiable oblivious PRF that generates Human Keys), not decryption.
          Threshold decryption is implemented and gated, but no production decryption has been performed. The lawful-access
          path has been exercised with restraint, and it is also, as of today, untested in production.
        </P>
        <Callout tone="warning">
          Two honest caveats. (1) A threshold-sized coalition of colluding operators could, in principle, reconstruct a
          record; the mitigations are the restaking-based operator set, epoch-rotated quorums, per-record-only decryption,
          and the optional user-elected additive key share. (2) The stored audit ciphertext is ElGamal over BabyJubJub, a
          discrete-log construction, so it is a harvest-now-decrypt-later target for a future quantum adversary. Because
          audit records have long confidentiality lifetimes, the commitment is to migrate or re-encrypt the audit layer
          toward NIST post-quantum standards (ML-KEM / FIPS 203) and to minimize retention.
        </Callout>
        <SmeReview who="Nanak, crypto">
          Node counts, keys-generated, and total-value-secured figures move over time (roughly 3.4 million keys and about
          $1.8 billion restaked as of late May 2026). Pin any number you publish to a fresh reading of the Human Network
          dashboard and its date.
        </SmeReview>
      </>
    ),
  },
]

function H4({ children }: { children: React.ReactNode }) {
  return <h4 className="mt-5 mb-1.5 text-16 font-semibold text-latest-black-100">{children}</h4>
}

export default function ProtocolDocsPage() {
  return (
    <DocsLayout
      title="Shield | For Devs"
      subtitle="Protocol & Cryptography: the ZK, compliance, and contract layer under the SDK."
      sections={sections}
    />
  )
}
