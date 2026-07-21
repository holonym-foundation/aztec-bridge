'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MeshGradient } from '@paper-design/shaders-react'
import { useWalletStore } from '@/stores/walletStore'

const ONBOARDED_KEY = 'shield_onboarded'
const BRAND = '#81133B'
const CLEAN_SDK = 'https://human.tech/clean-sdk'
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
    eyebrow: 'Private bridge\nEthereum ⇄ Aztec',
    title: 'Private transactions have arrived for Ethereum funds',
    body: (
      <p>Move your funds between Ethereum and Aztec with privacy.</p>
    ),
    cta: 'Get started',
    visual: 'cryptex',
  },
  {
    eyebrow: 'Opt in to privacy',
    title: 'Shield your funds',
    body: (
      <p>
        On Ethereum every balance and transfer is public. Bridge into Aztec to make yours private,
        screened on the way in so the pool stays clean.
      </p>
    ),
    cta: 'Next',
    visual: 'shield',
  },
  {
    eyebrow: 'Onchain identity',
    title: 'Prove your identity',
    body: (
      <>
        <p>Reputation is everything in a post privacy web3.</p>
        <div className="ob-tiers" role="table" aria-label="Verification tiers">
          <div className="ob-tier-row" role="row">
            <div className="ob-tier-icon" role="cell">
              <TierIcon kind="unique" />
            </div>
            <div className="ob-tier-copy" role="cell">
              <strong>Up to $1,000</strong>
              <span>Prove you&apos;re a unique human. No ID.</span>
            </div>
          </div>
          <div className="ob-tier-row" role="row">
            <div className="ob-tier-icon" role="cell">
              <TierIcon kind="clean" />
            </div>
            <div className="ob-tier-copy" role="cell">
              <strong>Above $1,000</strong>
              <span>
                Prove your hands are clean.{' '}
                <InfoTooltip href="https://human.tech/shield" label="Learn more about Proof of Clean Hands" align="right">
                  Above $1,000 you verify a government ID in zero knowledge. Learn more at human.tech/shield.
                </InfoTooltip>
              </span>
            </div>
          </div>
        </div>
      </>
    ),
    cta: 'Next',
    visual: 'identity',
  },
  {
    eyebrow: 'Zero knowledge by design',
    title: 'Private by default, accountable by design',
    body: (
      <>
        <p>
          Your privacy is enforced by zero knowledge proofs, not promises.
          <InfoTooltip label="Learn more about the privacy guarantee">
            Your proofs are generated locally. Shield checks only what a rule requires and stores nothing else.
          </InfoTooltip>
        </p>
        <p>
          <strong>2M+ users</strong> and <strong>44M+ credentials</strong> already run on
          human.tech&apos;s ZK stack. It follows a strict data minimization standard. We verify
          what&apos;s needed and store nothing more.
        </p>
      </>
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
const CX_SPIRAL_TURNS = 3 // integer turns so the point ends exactly where it began (seamless loop)

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

      {still ? (
        <circle cx={CX_CENTER} cy={CX_CENTER} r={CX_CORE + 8} fill="url(#cx-core)" />
      ) : (
        <motion.circle
          cx={CX_CENTER}
          cy={CX_CENTER}
          fill="url(#cx-core)"
          animate={{ r: [CX_CORE - 4, CX_CORE + 30, CX_CORE - 4], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

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
  const label = kind === 'shield' ? 'Private on Aztec' : kind === 'identity' ? 'Human · verified' : 'Zero knowledge'
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

/* Simple inline line icons for the verification tiers grid, drawn in the Shield pink.
   "unique" reads as a fingerprint mark (proof of a unique human), "clean" reads as a
   shield with a check mark (proof of clean hands). */
function TierIcon({ kind }: { kind: 'unique' | 'clean' }) {
  return kind === 'unique' ? (
    <svg viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5a5 5 0 0 0-5 5v1.8c0 3.7-1 5.9-2.1 7.6" />
      <path d="M12 3.5a5 5 0 0 1 5 5v1.3" />
      <path d="M8.3 8.5a3.8 3.8 0 0 1 7.6 0v2.8c0 4.1-1.4 6.7-3 8.4" />
      <path d="M9.4 17.6c1.1-1.5 1.8-3.3 1.8-5.6V8.5a0.9 0.9 0 1 1 1.8 0v3.8" />
      <path d="M14 12.3v1.4c0 1.9-.5 3.4-1.4 4.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.2l6.5 2.6v4.6c0 4.4-2.7 7.9-6.5 9.4c-3.8-1.5-6.5-5-6.5-9.4V5.8L12 3.2z" />
      <path d="M8.7 12.3l2.2 2.2l4.4-4.7" />
    </svg>
  )
}

/* Minimal accessible tooltip: a small inline info glyph that reveals a short blurb on
   hover or keyboard focus. No external positioning library, no portal, just a relatively
   positioned bubble anchored to the trigger. The trigger sits inline with the sentence
   and never forces a line break. */
function InfoTooltip({ label, children, href, align = 'center' }: { label: string; children: ReactNode; href?: string; align?: 'center' | 'right' }) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()
  const icon = (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="4.7" r="0.95" fill="currentColor" />
      <path d="M8 7.1v4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
  return (
    <span className="ob-tooltip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {href ? (
        <a
          className="ob-tooltip-trigger"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          aria-describedby={tooltipId}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          {icon}
        </a>
      ) : (
        <button
          type="button"
          className="ob-tooltip-trigger"
          aria-label={label}
          aria-describedby={tooltipId}
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => setOpen((o) => !o)}
        >
          {icon}
        </button>
      )}
      <AnimatePresence>
        {open && (
          <motion.span
            id={tooltipId}
            role="tooltip"
            className={`ob-tooltip-bubble${align === 'right' ? ' ob-tooltip-bubble-right' : ''}`}
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

export default function ShieldOnboarding() {
  const reduce = useReducedMotion() ?? false
  const connectWaapWallet = useWalletStore((s) => s.connectWaapWallet)
  const isWaapConnected = useWalletStore((s) => s.isWaapConnected)
  // Start in 'loading': the shader shell renders immediately (covering the bridge from
  // the first paint) while we read localStorage / wallet state, then we resolve to the
  // real mode and the inner content fades in over the same, never-remounted shader.
  const [mode, setMode] = useState<'loading' | 'hidden' | 'flow' | 'splash'>('loading')
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // First visit runs the full flow (once). Every subsequent page load — including a
    // refresh by a connected user — lands on the branded splash; the user explicitly
    // re-enters the bridge from there. Decided once on mount so a wallet reconnecting
    // mid-session doesn't tear the splash down underneath the user.
    let onboarded = false
    try {
      onboarded = !!localStorage.getItem(ONBOARDED_KEY)
    } catch {
      onboarded = false
    }
    setMode(onboarded ? 'splash' : 'flow')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Signal the splash state to the app chrome via a root attribute. When the splash is
  // up for a *connected* user, ClientLayout lifts the real nav bar above the overlay so
  // they keep their account/nav; otherwise the splash covers everything.
  useEffect(() => {
    const root = document.documentElement
    if (mode === 'splash') {
      root.setAttribute('data-ob-splash', isWaapConnected ? 'connected' : 'active')
    } else {
      root.removeAttribute('data-ob-splash')
    }
    return () => root.removeAttribute('data-ob-splash')
  }, [mode, isWaapConnected])

  const markOnboarded = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1')
    } catch {}
  }

  const finishFlow = () => {
    markOnboarded()
    setMode('hidden')
  }

  const skip = () => finishFlow()

  const connectWallet = () => {
    connectWaapWallet().catch(() => {})
  }

  const advance = () => {
    if (index < SCREENS.length - 1) {
      setIndex((i) => i + 1)
    } else {
      // Final CTA: open the WaaP login, then fade into the app.
      markOnboarded()
      connectWallet()
      setLeaving(true)
    }
  }

  const connectFromSplash = () => {
    // Already-connected returning users just re-enter the bridge; otherwise open WaaP.
    if (!isWaapConnected) connectWallet()
    setMode('hidden')
  }

  const back = () => setIndex((i) => Math.max(0, i - 1))

  const screen = SCREENS[index]
  const progress = ((index + 1) / SCREENS.length) * 100

  const flowContent = (
    <motion.div
      key="flow"
      className="ob-inner"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Full-width progress bar */}
      <div className="ob-progress" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={SCREENS.length}>
        <motion.div className="ob-progress-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
      </div>

      <div className="ob-top">
        <img src="/assets/svg/shield-symbol-maroon.svg" alt="Shield" width={22} height={27} />
        <button className="ob-skip" onClick={skip}>Skip</button>
      </div>

      <div className="ob-stage">
        <div className="ob-stage-inner">
          <div className="ob-card-region">
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
                    <h1 className={`ob-title ob-title-${screen.visual}`}>{screen.title}</h1>
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
        </div>
      </div>
    </motion.div>
  )

  const splashContent = (
    <motion.div
      key="splash"
      className="ob-inner"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      <div className="ob-stage">
        <div className="ob-stage-inner">
          <div className="ob-card-region">
            <div className="ob-card">
              <div className="ob-cryptex-frame">
                <CryptexVisual still={reduce} />
                <div className="ob-headline">
                  <p className="ob-eyebrow">{SCREENS[0].eyebrow}</p>
                  <h1 className="ob-title">{SCREENS[0].title}</h1>
                </div>
              </div>
              <div className="ob-body">
                <p>Move your funds between Ethereum and Aztec with privacy.</p>
              </div>
            </div>
          </div>
          <div className="ob-controls">
            <div className="ob-btns">
              <button className="ob-next" onClick={connectFromSplash}>{isWaapConnected ? 'Enter app' : 'Connect wallet'}</button>
            </div>
            <p className="ob-secured">
              Secured by <strong>human.tech</strong>
              <span className="ob-dot">·</span>
              Built on <a href={CLEAN_SDK} target="_blank" rel="noopener noreferrer" className="ob-link">Clean SDK</a>
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )

  return (
    <AnimatePresence>
      {/* The shader shell is painted on the very first client frame so the bridge never
          flashes underneath. The shell itself never fades IN (initial={false}); it stays
          mounted while the inner content (progress bar, headline, controls) fades in over
          it, and it only fades OUT — cleanly revealing the bridge — when we dismiss. */}
      {mode !== 'hidden' && !leaving && (
        <motion.div
          key="ob-root"
          className="ob-root"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          <PaperField still={reduce} />
          <AnimatePresence mode="wait">
            {mode === 'flow' ? flowContent : mode === 'splash' ? splashContent : null}
          </AnimatePresence>
        </motion.div>
      )}

      {leaving && (
        <motion.div
          key="handoff"
          className="ob-handoff"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, times: [0, 0.25, 0.7, 1], ease: 'easeInOut' }}
          onAnimationComplete={() => {
            markOnboarded()
            setLeaving(false)
            setMode('hidden')
          }}
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
        /* Connected user on the splash: lift the real app nav bar above this overlay so
           it stays usable. Toggled by data-ob-splash="connected" on <html>. */
        html[data-ob-splash="connected"] .ob-header-elevate { z-index: 130 !important; }
        /* Inner content overlay: fades in over the persistent shader shell. */
        .ob-inner { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; }
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
        .ob-stage { position: relative; z-index: 2; flex: 1; min-height: 0; display: flex; align-items: center;
          justify-content: center; padding: 16px 24px; overflow-y: auto; }
        .ob-stage-inner { width: 100%; max-width: 720px; margin: auto; display: flex; flex-direction: column;
          align-items: center; gap: 28px; }
        /* Fixed content region: height is sized to the tallest screen (the cryptex hero).
           Every screen's content is vertically centered inside it, so the controls row
           below always sits at the same y and the button never shifts between screens. */
        .ob-card-region { position: relative; width: 100%; height: clamp(430px, 60vh, 540px); }
        .ob-card { position: absolute; inset: 0; width: 100%; text-align: center; display: flex;
          flex-direction: column; align-items: center; justify-content: center; }
        .ob-visual { height: 168px; display: flex; align-items: center; justify-content: center; margin-bottom: 26px; width: 100%; }
        .ob-eyebrow { font-size: 12.5px; letter-spacing: 0.14em; text-transform: uppercase; color: ${BRAND};
          font-weight: 600; margin: 0 0 14px; white-space: pre-line; line-height: 1.7; }
        .ob-title { font-size: clamp(26px, 5vw, 40px); line-height: 1.08; letter-spacing: -0.02em; font-weight: 640;
          margin: 0 0 16px; text-wrap: balance; max-width: 15ch; }
        .ob-title-zk { max-width: 24ch; }
        .ob-body { font-size: 16.5px; line-height: 1.55; color: #5a4650; max-width: 56ch; }
        .ob-body p { margin: 0 0 10px; } .ob-body p:last-child { margin-bottom: 0; }
        .ob-body strong { color: #1c1116; font-weight: 640; }
        .ob-link { color: ${BRAND}; text-decoration: underline; text-underline-offset: 2px; font-weight: 550; }
        /* verification tiers grid (page 3) */
        .ob-tiers { width: 100%; max-width: 460px; margin: 18px auto 0; border: 1px solid #f0d3e0;
          border-radius: 16px; overflow: hidden; background: rgba(255,255,255,0.55); text-align: left; }
        .ob-tier-row { display: flex; align-items: center; gap: 16px; padding: 16px 20px; }
        .ob-tier-row + .ob-tier-row { border-top: 1px solid #f0d3e0; }
        .ob-tier-icon { flex: none; width: 40px; height: 40px; border-radius: 12px; background: rgba(129,19,59,0.08);
          display: flex; align-items: center; justify-content: center; }
        .ob-tier-icon svg { width: 20px; height: 20px; }
        .ob-tier-copy { display: flex; flex-direction: column; gap: 2px; }
        .ob-tier-copy strong { font-size: 15.5px; color: #1c1116; font-weight: 640; }
        .ob-tier-copy span { font-size: 14px; line-height: 1.4; color: #5a4650; }
        /* learn more info-icon tooltip (page 4) */
        .ob-tooltip { position: relative; display: inline-flex; vertical-align: middle; margin-left: 4px; }
        .ob-tooltip-trigger { display: inline-flex; align-items: center; justify-content: center; background: none;
          border: 0; padding: 0; margin: 0; width: 17px; height: 17px; color: ${BRAND}; opacity: 0.75;
          cursor: pointer; border-radius: 50%; transition: opacity .15s ease, transform .15s ease;
          transform: translateY(-1px); }
        .ob-tooltip-trigger svg { width: 17px; height: 17px; display: block; }
        .ob-tooltip-trigger:hover, .ob-tooltip-trigger:focus-visible { opacity: 1; }
        .ob-tooltip-trigger:focus-visible { outline: 2px solid ${BRAND}; outline-offset: 2px; }
        .ob-tooltip-bubble { position: absolute; left: 50%; bottom: calc(100% + 10px); transform: translateX(-50%);
          width: 240px; max-width: 76vw; padding: 12px 14px; border-radius: 12px; background: #1c1116; color: #fdf0f6;
          font-size: 13px; line-height: 1.45; text-align: left; box-shadow: 0 12px 30px rgba(0,0,0,0.22); z-index: 5;
          pointer-events: none; }
        .ob-tooltip-bubble::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
          border: 6px solid transparent; border-top-color: #1c1116; }
        /* Edge-anchored variant: for triggers near the right edge (e.g. page-3 tiers),
           pin the bubble's right edge to the trigger so it can't overflow the viewport. */
        .ob-tooltip-bubble-right { left: auto; right: 0; transform: none; }
        .ob-tooltip-bubble-right::after { left: auto; right: 6px; transform: none; }
        .ob-controls { position: relative; z-index: 3; width: 100%; display: flex; flex-direction: column;
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
        /* cryptex hero — concentric dial rings framing the headline. max-height keeps the
           full-size mark from overflowing the fixed region on short viewports (it scales
           down with the region rather than being clipped or shrunk at its base size). */
        .ob-cryptex-frame { position: relative; width: 100%; max-width: 500px; max-height: calc(100% - 40px);
          aspect-ratio: 1 / 1; margin: 4px auto 4px; display: flex; align-items: center; justify-content: center; }
        .ob-cryptex-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
        .ob-headline { position: relative; z-index: 1; padding: 0 28px; text-align: center; }
        .ob-headline .ob-title { max-width: 17ch; }
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
          .ob-stage { padding: 14px 20px; }
          .ob-stage-inner { gap: 22px; }
          /* On mobile the cryptex is narrower, so a text-heavy screen (page 4) is tallest;
             size the region to fit it, page 1 then centers with room to spare. */
          .ob-card-region { height: clamp(420px, 66vh, 470px); }
          .ob-visual { height: 140px; margin-bottom: 20px; }
          .ob-cryptex-frame { max-width: 300px; }
          .ob-headline { padding: 0 20px; }
          .ob-title { font-size: 27px; }
          .ob-title-zk { max-width: none; }
          .ob-body { font-size: 15.5px; }
          .ob-tiers { max-width: 100%; }
          .ob-tier-row { padding: 14px 16px; gap: 12px; }
          .ob-tooltip-bubble { width: 210px; }
        }
        @media (prefers-color-scheme: dark) {
          .ob-root { background: #150a0f; color: #f6ecf1; }
          .ob-grain { mix-blend-mode: screen; opacity: 0.06; }
          .ob-veil { background: linear-gradient(180deg, rgba(21,10,15,0.34), rgba(21,10,15,0.68)); }
          .ob-body { color: #cba7b6; } .ob-body strong { color: #f6ecf1; }
          .ob-back { color: #cba7b6; border-color: #3a2530; }
          .ob-secured strong { color: #cba7b6; }
          .ob-tiers { border-color: #3a2530; background: rgba(255,255,255,0.03); }
          .ob-tier-row + .ob-tier-row { border-top-color: #3a2530; }
          .ob-tier-icon { background: rgba(246,236,241,0.08); }
          .ob-tier-copy strong { color: #f6ecf1; }
          .ob-tier-copy span { color: #cba7b6; }
          .ob-tooltip-bubble { background: #f6ecf1; color: #1c1116; }
          .ob-tooltip-bubble::after { border-top-color: #f6ecf1; }
          .ob-handoff { background: radial-gradient(#2a141f, #150a0f); }
        }
      `}</style>
    </AnimatePresence>
  )
}
