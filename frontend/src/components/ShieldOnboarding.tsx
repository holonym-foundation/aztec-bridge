'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MeshGradient } from '@paper-design/shaders-react'

const ONBOARDED_KEY = 'shield_onboarded'
const BRAND = '#81133B'
const CLEAN_SDK = 'https://www.npmjs.com/package/@human.tech/clean.sdk'
const DOCS_CLEAN_HANDS = '/docs/users'

type Screen = {
  eyebrow: string
  title: string
  body: ReactNode
  cta: string
  visual: 'bridge' | 'shield' | 'identity' | 'zk'
}

const SCREENS: Screen[] = [
  {
    eyebrow: 'Private bridge · Ethereum ⇄ Aztec',
    title: 'Private transactions have arrived on Ethereum',
    body: (
      <p>Shield is a private bridge between Ethereum and Aztec. Move your funds privately.</p>
    ),
    cta: 'Get started',
    visual: 'bridge',
  },
  {
    eyebrow: 'Why Aztec',
    title: 'Shield your funds',
    body: (
      <p>
        On Ethereum, every balance and transfer is public — anyone can see what you hold and who you
        pay. Bridge into Aztec and it goes private: your amounts, counterparties, and history stay
        yours. Funds are screened on the way in, so the pool stays clean.
      </p>
    ),
    cta: 'Next',
    visual: 'shield',
  },
  {
    eyebrow: 'On-chain identity',
    title: 'Prove your identity',
    body: (
      <>
        <p>Reputation is everything in post-privacy web3.</p>
        <p>
          Prove your humanity to move up to <strong>$1,000</strong>. Above $1,000, prove your hands
          are clean.{' '}
          <a href={DOCS_CLEAN_HANDS} className="ob-link">Learn more</a>
        </p>
      </>
    ),
    cta: 'Next',
    visual: 'identity',
  },
  {
    eyebrow: 'Zero-knowledge by design',
    title: 'Private by default, accountable by design',
    body: (
      <p>
        Your privacy is enforced by zero-knowledge proofs, not promises.{' '}
        <strong>2M+ people</strong> and <strong>50M+ credentials</strong> already run on
        human.tech&apos;s ZK stack, built to a strict data-minimization standard — we verify what&apos;s
        needed and store nothing more.
      </p>
    ),
    cta: 'Connect wallet',
    visual: 'zk',
  },
]

/* Paper-shader field: real @paper-design MeshGradient in Shield tones, softened by a
   translucent veil so copy stays legible, plus a fine grain for paper texture. */
function PaperField({ still }: { still: boolean }) {
  return (
    <div className="ob-field" aria-hidden="true">
      <MeshGradient
        colors={['#fff6fa', '#fde7f3', '#f462a6', '#81133b']}
        speed={still ? 0 : 0.22}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <div className="ob-veil" />
      <svg className="ob-grain" width="100%" height="100%">
        <filter id="ob-noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#ob-noise)" />
      </svg>
    </div>
  )
}

/* ETH ⇄ Aztec bridge animation — a coin crosses and gains a privacy shield. */
function BridgeVisual({ still }: { still: boolean }) {
  return (
    <div className="ob-bridge">
      <div className="ob-node">
        <img src="/assets/svg/ethLogo.svg" alt="" width={30} height={30} onError={(e) => ((e.currentTarget.style.display = 'none'))} />
        <span>Ethereum</span>
      </div>
      <div className="ob-wire">
        <div className="ob-wire-line" />
        {!still && (
          <motion.div
            className="ob-coin"
            animate={{ left: ['4%', '92%', '4%'] }}
            transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.span
              className="ob-coin-ring"
              animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.7, 0.7, 1, 1, 0.7] }}
              transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </div>
      <div className="ob-node">
        <img src="/assets/svg/shield-symbol-maroon.svg" alt="" width={26} height={32} />
        <span>Aztec · private</span>
      </div>
    </div>
  )
}

function StaticGlyph({ kind }: { kind: 'shield' | 'identity' | 'zk' }) {
  const label = kind === 'shield' ? 'Private on Aztec' : kind === 'identity' ? 'Human · verified' : 'Zero-knowledge'
  return (
    <div className={`ob-glyph ob-glyph-${kind}`}>
      <img src="/assets/svg/shield-symbol-maroon.svg" alt="" width={64} height={80} />
      <span>{label}</span>
    </div>
  )
}

export default function ShieldOnboarding() {
  const reduce = useReducedMotion() ?? false
  const [visible, setVisible] = useState(false)
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDED_KEY)) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  const commitDone = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1')
    } catch {}
    setVisible(false)
  }

  const skip = () => commitDone()

  const advance = () => {
    if (index < SCREENS.length - 1) {
      setIndex((i) => i + 1)
    } else {
      // Final CTA: play a soft zoom + splash + gradient fade into the app.
      setLeaving(true)
    }
  }

  const back = () => setIndex((i) => Math.max(0, i - 1))

  if (!visible) return null

  const screen = SCREENS[index]
  const progress = ((index + 1) / SCREENS.length) * 100

  return (
    <AnimatePresence onExitComplete={commitDone}>
      {!leaving ? (
        <motion.div
          key="onboarding"
          className="ob-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          <PaperField still={reduce} />

          {/* Full-width progress bar */}
          <div className="ob-progress" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={SCREENS.length}>
            <motion.div className="ob-progress-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
          </div>

          <div className="ob-top">
            <img src="/assets/svg/shield-symbol-maroon.svg" alt="Shield" width={22} height={27} />
            <button className="ob-skip" onClick={skip}>Skip</button>
          </div>

          <div className="ob-stage">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                className="ob-card"
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -22 }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="ob-visual">
                  {screen.visual === 'bridge' ? <BridgeVisual still={reduce} /> : <StaticGlyph kind={screen.visual} />}
                </div>
                <p className="ob-eyebrow">{screen.eyebrow}</p>
                <h1 className="ob-title">{screen.title}</h1>
                <div className="ob-body">{screen.body}</div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="ob-controls">
            <div className="ob-btns">
              {index > 0 && <button className="ob-back" onClick={back}>Back</button>}
              <button className="ob-next" onClick={advance}>{screen.cta}</button>
            </div>
            <p className="ob-secured">
              Secured by <strong>human.tech</strong>
              <span className="ob-dot">·</span>
              Built on <a href={CLEAN_SDK} target="_blank" rel="noopener noreferrer" className="ob-link">Clean SDK</a>
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="handoff"
          className="ob-handoff"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, times: [0, 0.25, 0.7, 1], ease: 'easeInOut' }}
          onAnimationComplete={commitDone}
        >
          <motion.div
            className="ob-handoff-mark"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.8, 1, 1.06], opacity: [0, 1, 1] }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          >
            <img src="/assets/svg/human.tech.logo.svg" alt="human.tech" width={140} onError={(e) => ((e.currentTarget.src = '/assets/svg/shield-symbol-maroon.svg'))} />
          </motion.div>
        </motion.div>
      )}

      <style key="ob-style">{`
        .ob-root { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column;
          overflow: hidden; font-family: 'Suisse Intl', system-ui, sans-serif;
          background: #fff6fa; color: #1c1116; }
        .ob-field { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
        .ob-field canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; }
        .ob-veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,246,250,0.30), rgba(255,246,250,0.66)); }
        .ob-grain { position: absolute; inset: 0; opacity: 0.05; mix-blend-mode: multiply; pointer-events: none; }
        .ob-progress { position: relative; z-index: 3; height: 4px; width: 100%; background: rgba(129,19,59,0.12); }
        .ob-progress-fill { height: 100%; background: linear-gradient(90deg, ${BRAND}, #f462a6); }
        .ob-top { position: relative; z-index: 3; display: flex; align-items: center; justify-content: space-between;
          padding: 18px 22px 0; }
        .ob-skip { background: none; border: 0; color: #987f8a; font-size: 14px; cursor: pointer; padding: 6px; }
        .ob-skip:hover { color: #5a4650; }
        .ob-stage { position: relative; z-index: 2; flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 8px 24px; }
        .ob-card { width: 100%; max-width: 560px; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .ob-visual { height: 168px; display: flex; align-items: center; justify-content: center; margin-bottom: 26px; width: 100%; }
        .ob-eyebrow { font-size: 12.5px; letter-spacing: 0.14em; text-transform: uppercase; color: ${BRAND};
          font-weight: 600; margin: 0 0 12px; }
        .ob-title { font-size: clamp(26px, 5vw, 40px); line-height: 1.08; letter-spacing: -0.02em; font-weight: 640;
          margin: 0 0 16px; text-wrap: balance; max-width: 15ch; }
        .ob-body { font-size: 16.5px; line-height: 1.55; color: #5a4650; max-width: 48ch; }
        .ob-body p { margin: 0 0 10px; } .ob-body p:last-child { margin-bottom: 0; }
        .ob-body strong { color: #1c1116; font-weight: 640; }
        .ob-link { color: ${BRAND}; text-decoration: underline; text-underline-offset: 2px; font-weight: 550; }
        .ob-controls { position: relative; z-index: 3; padding: 0 24px 30px; display: flex; flex-direction: column;
          align-items: center; gap: 16px; }
        .ob-btns { width: 100%; max-width: 420px; display: flex; gap: 12px; }
        .ob-next { flex: 1; height: 54px; border: 0; border-radius: 14px; background: ${BRAND}; color: #fff;
          font-size: 16px; font-weight: 620; cursor: pointer; transition: transform .15s ease, filter .15s ease; }
        .ob-next:hover { transform: translateY(-1px); filter: brightness(1.08); }
        .ob-back { height: 54px; padding: 0 22px; border: 1px solid #eccfdc; border-radius: 14px; background: transparent;
          color: #5a4650; font-size: 16px; font-weight: 560; cursor: pointer; }
        .ob-back:hover { background: rgba(129,19,59,0.05); }
        .ob-secured { font-size: 12.5px; color: #987f8a; margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .ob-secured strong { color: #5a4650; font-weight: 620; }
        .ob-dot { opacity: 0.5; }
        /* bridge visual */
        .ob-bridge { display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; max-width: 460px; }
        .ob-node { display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 0 0 auto; width: 92px; }
        .ob-node span { font-size: 12px; color: #5a4650; font-weight: 550; text-align: center; }
        .ob-wire { position: relative; flex: 1; height: 40px; }
        .ob-wire-line { position: absolute; top: 50%; left: 0; right: 0; height: 2px; transform: translateY(-50%);
          background: linear-gradient(90deg, rgba(129,19,59,0.15), ${BRAND}, rgba(129,19,59,0.15)); border-radius: 2px; }
        .ob-coin { position: absolute; top: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%;
          background: ${BRAND}; box-shadow: 0 0 12px rgba(129,19,59,0.5); }
        .ob-coin-ring { position: absolute; inset: -6px; border-radius: 50%; border: 2px solid #f462a6; }
        /* static glyphs */
        .ob-glyph { display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .ob-glyph span { font-size: 13px; color: ${BRAND}; font-weight: 600; letter-spacing: 0.02em; }
        .ob-glyph img { filter: drop-shadow(0 8px 24px rgba(129,19,59,0.22)); }
        /* handoff splash */
        .ob-handoff { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center;
          background: radial-gradient(#FDE7F3, #ffffff); }
        .ob-handoff-mark { display: grid; place-items: center; }
        @media (max-width: 640px) {
          .ob-visual { height: 140px; margin-bottom: 20px; }
          .ob-node { width: 78px; }
          .ob-title { font-size: 27px; }
          .ob-body { font-size: 15.5px; }
        }
        @media (prefers-color-scheme: dark) {
          .ob-root { background: #150a0f; color: #f6ecf1; }
          .ob-grain { mix-blend-mode: screen; opacity: 0.06; }
          .ob-veil { background: linear-gradient(180deg, rgba(21,10,15,0.34), rgba(21,10,15,0.68)); }
          .ob-body { color: #cba7b6; } .ob-body strong { color: #f6ecf1; }
          .ob-node span { color: #cba7b6; } .ob-back { color: #cba7b6; border-color: #3a2530; }
          .ob-secured strong { color: #cba7b6; }
          .ob-handoff { background: radial-gradient(#2a141f, #150a0f); }
        }
      `}</style>
    </AnimatePresence>
  )
}
