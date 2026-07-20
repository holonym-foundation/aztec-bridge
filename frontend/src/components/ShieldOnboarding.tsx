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
  visual: 'cryptex' | 'shield' | 'identity' | 'zk'
}

const SCREENS: Screen[] = [
  {
    eyebrow: 'Private bridge · Ethereum ⇄ Aztec',
    title: 'Private transactions have arrived on Ethereum',
    body: (
      <p>Shield is a private bridge between Ethereum and Aztec. Move your funds privately.</p>
    ),
    cta: 'Get started',
    visual: 'cryptex',
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
        colors={['#fff6fa', '#fde7f3', '#fcd4ea', '#fa8fc4']}
        speed={still ? 0 : 0.16}
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

/* Cryptex hero mark — concentric dial rings framing the headline. A point spirals from
   the outer ring (public, light) to the private core (dark, occluded) and back out,
   endlessly shielding and unshielding. No text, no logos — state is read through light
   and shadow alone. */
const CX_SIZE = 320
const CX_CENTER = CX_SIZE / 2
const CX_OUTER = 148
const CX_CORE = 30
const CX_STEPS = 48
const CX_SPIRAL_TURNS = 2.5

const CX_RINGS = [
  { r: 148, dash: '1.5 15', duration: 46, dir: 1 },
  { r: 114, dash: '1.5 12', duration: 34, dir: -1 },
  { r: 80, dash: '1.5 10', duration: 26, dir: 1 },
  { r: 48, dash: '1.5 8', duration: 19, dir: -1 },
]

function cxPoint(radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX_CENTER + radius * Math.cos(rad), y: CX_CENTER + radius * Math.sin(rad) }
}

// t: 0 -> 1 is one full shield (inward) + unshield (outward) cycle.
function cxRadiusAt(t: number) {
  const half = t <= 0.5 ? t / 0.5 : (1 - t) / 0.5
  return CX_CORE + (CX_OUTER - CX_CORE) * half
}

function cxToneAt(t: number) {
  const half = t <= 0.5 ? t / 0.5 : (1 - t) / 0.5 // 1 = at outer edge (public), 0 = at core (private)
  const fill = half > 0.66 ? '#f462a6' : half > 0.33 ? '#b23a72' : '#3d0e21'
  const opacity = 0.35 + half * 0.65
  const glow = Math.max(0, half - 0.4) * 0.9
  return { fill, opacity, glow }
}

const CX_SPIRAL = Array.from({ length: CX_STEPS + 1 }, (_, i) => {
  const t = i / CX_STEPS
  const radius = cxRadiusAt(t)
  const angle = t * CX_SPIRAL_TURNS * 360
  const { x, y } = cxPoint(radius, angle)
  const { fill, opacity, glow } = cxToneAt(t)
  return { x, y, fill, opacity, glow }
})
const CX_X = CX_SPIRAL.map((p) => p.x)
const CX_Y = CX_SPIRAL.map((p) => p.y)
const CX_FILL = CX_SPIRAL.map((p) => p.fill)
const CX_OPACITY = CX_SPIRAL.map((p) => p.opacity)
const CX_GLOW = CX_SPIRAL.map((p) => p.glow)

function CryptexVisual({ still }: { still: boolean }) {
  return (
    <svg className="ob-cryptex-svg" viewBox={`0 0 ${CX_SIZE} ${CX_SIZE}`} aria-hidden="true">
      <defs>
        <radialGradient id="cx-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3d0e21" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3d0e21" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CX_CENTER} cy={CX_CENTER} r={CX_CORE + 8} fill="url(#cx-core)" />

      {CX_RINGS.map((ring, i) =>
        still ? (
          <circle
            key={ring.r}
            cx={CX_CENTER}
            cy={CX_CENTER}
            r={ring.r}
            fill="none"
            stroke={i === 0 ? '#e79cbe' : i === CX_RINGS.length - 1 ? '#5a1f36' : '#c96f97'}
            strokeWidth={1.4}
            strokeDasharray={ring.dash}
            opacity={0.5}
          />
        ) : (
          <motion.g
            key={ring.r}
            style={{ transformOrigin: `${CX_CENTER}px ${CX_CENTER}px` }}
            animate={{ rotate: ring.dir * 360 }}
            transition={{ duration: ring.duration, repeat: Infinity, ease: 'linear' }}
          >
            <motion.circle
              cx={CX_CENTER}
              cy={CX_CENTER}
              r={ring.r}
              fill="none"
              strokeWidth={1.4}
              strokeDasharray={ring.dash}
              animate={{
                stroke: ['#f2b7d3', '#5a1f36', '#f2b7d3'],
                opacity: [0.28, 0.72, 0.28],
              }}
              transition={{
                duration: 9,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.55,
              }}
            />
          </motion.g>
        )
      )}

      {!still && (
        <>
          <motion.circle
            r={11}
            animate={{ cx: CX_X, cy: CX_Y, fill: CX_FILL, opacity: CX_GLOW }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            style={{ filter: 'blur(5px)' }}
          />
          <motion.circle
            r={4}
            animate={{ cx: CX_X, cy: CX_Y, fill: CX_FILL, opacity: CX_OPACITY }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />
        </>
      )}

      {still && (
        <>
          <circle cx={cxPoint(CX_OUTER, 40).x} cy={cxPoint(CX_OUTER, 40).y} r={4.5} fill="#f462a6" />
          <circle cx={cxPoint(CX_CORE + 4, 220).x} cy={cxPoint(CX_CORE + 4, 220).y} r={3.5} fill="#3d0e21" opacity={0.7} />
        </>
      )}
    </svg>
  )
}

/* A quiet echo of the cryptex mark — a faint dashed ring behind the glyph, no motion. */
function StaticGlyph({ kind }: { kind: 'shield' | 'identity' | 'zk' }) {
  const label = kind === 'shield' ? 'Private on Aztec' : kind === 'identity' ? 'Human · verified' : 'Zero-knowledge'
  return (
    <div className={`ob-glyph ob-glyph-${kind}`}>
      <svg className="ob-glyph-ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#e79cbe" strokeWidth="1.2" strokeDasharray="1.5 11" opacity="0.55" />
      </svg>
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
                {screen.visual === 'cryptex' ? (
                  <div className="ob-cryptex-frame">
                    <CryptexVisual still={reduce} />
                    <div className="ob-headline">
                      <p className="ob-eyebrow">{screen.eyebrow}</p>
                      <h1 className="ob-title">{screen.title}</h1>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="ob-visual">
                      <StaticGlyph kind={screen.visual} />
                    </div>
                    <p className="ob-eyebrow">{screen.eyebrow}</p>
                    <h1 className="ob-title">{screen.title}</h1>
                  </>
                )}
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
        .ob-veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,246,250,0.38), rgba(255,246,250,0.78)); }
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
        /* cryptex hero — concentric dial rings framing the headline */
        .ob-cryptex-frame { position: relative; width: 100%; max-width: 340px; aspect-ratio: 1 / 1;
          margin: 4px auto 4px; display: flex; align-items: center; justify-content: center; }
        .ob-cryptex-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
        .ob-headline { position: relative; z-index: 1; padding: 0 34px; text-align: center; }
        .ob-headline .ob-title { max-width: 12ch; }
        /* static glyphs */
        .ob-glyph { position: relative; display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .ob-glyph-ring { position: absolute; top: 50%; left: 50%; width: 132px; height: 132px;
          transform: translate(-50%, -50%); z-index: 0; }
        .ob-glyph img, .ob-glyph span { position: relative; z-index: 1; }
        .ob-glyph span { font-size: 13px; color: ${BRAND}; font-weight: 600; letter-spacing: 0.02em; }
        .ob-glyph img { filter: drop-shadow(0 8px 24px rgba(129,19,59,0.22)); }
        /* handoff splash */
        .ob-handoff { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center;
          background: radial-gradient(#FDE7F3, #ffffff); }
        .ob-handoff-mark { display: grid; place-items: center; }
        @media (max-width: 640px) {
          .ob-visual { height: 140px; margin-bottom: 20px; }
          .ob-cryptex-frame { max-width: 260px; }
          .ob-headline { padding: 0 20px; }
          .ob-title { font-size: 27px; }
          .ob-body { font-size: 15.5px; }
        }
        @media (prefers-color-scheme: dark) {
          .ob-root { background: #150a0f; color: #f6ecf1; }
          .ob-grain { mix-blend-mode: screen; opacity: 0.06; }
          .ob-veil { background: linear-gradient(180deg, rgba(21,10,15,0.34), rgba(21,10,15,0.68)); }
          .ob-body { color: #cba7b6; } .ob-body strong { color: #f6ecf1; }
          .ob-back { color: #cba7b6; border-color: #3a2530; }
          .ob-secured strong { color: #cba7b6; }
          .ob-handoff { background: radial-gradient(#2a141f, #150a0f); }
        }
      `}</style>
    </AnimatePresence>
  )
}
