'use client'

import React, { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Brand palette (Shield SOP): maroon lead, pink tints, navy accent. Raw canvas
// fills are allowed to use exact brand hexes.
const MAROON = '#81133B'
const PINK_MID = '#BF1254'
const PINK_LIGHT = '#F462A6'
const NAVY = '#17235E'

// The cipher alphabet the rings shuffle through while a transfer is being
// privately processed. A hex set plus a few diamond marks reads as ciphertext
// without ever spelling a word.
const GLYPHS = '0123456789ABCDEF◇△▽◆'.split('')

interface RingSpec {
  radiusFactor: number // fraction of the base radius
  count: number // glyphs spaced around the ring
  speed: number // radians / second (sign sets the direction)
  color: string
  alpha: number // canvas globalAlpha, not a Tailwind opacity token
  fontFactor: number // glyph size as a fraction of the base radius
}

// Three concentric dials, each turning at its own slow speed and direction so
// they read as a settling lock rather than a spinner.
const RINGS: RingSpec[] = [
  { radiusFactor: 1.0, count: 16, speed: 0.1, color: PINK_LIGHT, alpha: 0.4, fontFactor: 0.12 },
  { radiusFactor: 0.7, count: 12, speed: -0.14, color: PINK_MID, alpha: 0.62, fontFactor: 0.13 },
  { radiusFactor: 0.42, count: 8, speed: 0.19, color: MAROON, alpha: 0.85, fontFactor: 0.14 },
]

interface Glyph {
  char: string
  scramble: number // frames left in this glyph's shuffle burst
}

const randGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]

export interface CryptexAnimationProps {
  /** Rendered height in px; width fills the parent. */
  height?: number
  className?: string
}

/**
 * Cryptex: concentric rings of cipher glyphs that slowly rotate and shuffle,
 * with a nested Aztec-style diamond pulsing at the core. Canvas + rAF, no deps.
 * Pauses when scrolled off-screen. Honors reduced motion by painting a single
 * static frame (rings at rest, glyphs settled) instead of animating.
 */
export default function CryptexAnimation({ height = 140, className = '' }: CryptexAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cssW = canvas.clientWidth || 280
    const cssH = height
    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    const rings: Glyph[][] = RINGS.map((r) =>
      Array.from({ length: r.count }, () => ({ char: randGlyph(), scramble: 0 })),
    )

    const resize = () => {
      cssW = canvas.clientWidth || cssW
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const drawDiamond = (cx: number, cy: number, size: number, alpha: number) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = MAROON
      ctx.lineWidth = 1.6
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(cx, cy - size)
      ctx.lineTo(cx + size, cy)
      ctx.lineTo(cx, cy + size)
      ctx.lineTo(cx - size, cy)
      ctx.closePath()
      ctx.stroke()
      ctx.restore()
    }

    const draw = (t: number) => {
      const cx = cssW / 2
      const cy = cssH / 2
      const base = Math.max(20, Math.min(cssW, cssH) / 2 - 16)

      ctx.clearRect(0, 0, cssW, cssH)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      RINGS.forEach((spec, ri) => {
        const radius = base * spec.radiusFactor
        const rotation = spec.speed * t
        const fontPx = Math.max(9, base * spec.fontFactor)

        // Faint guide circle framing each dial.
        ctx.save()
        ctx.globalAlpha = 0.08
        ctx.strokeStyle = spec.color
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()

        ctx.font = `${fontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`
        rings[ri].forEach((glyph, gi) => {
          if (glyph.scramble > 0) {
            glyph.char = randGlyph()
            glyph.scramble -= 1
          } else if (!reduceMotion && Math.random() < 0.012) {
            glyph.scramble = 6 + Math.floor(Math.random() * 10)
          }

          const angle = (gi / spec.count) * Math.PI * 2 + rotation
          const x = cx + radius * Math.cos(angle)
          const y = cy + radius * Math.sin(angle)
          ctx.save()
          // A glyph mid-shuffle glows brighter, so the "encrypting" ripple is
          // visible without the whole ring flickering.
          ctx.globalAlpha = glyph.scramble > 0 ? Math.min(1, spec.alpha + 0.3) : spec.alpha
          ctx.fillStyle = spec.color
          ctx.fillText(glyph.char, x, y)
          ctx.restore()
        })
      })

      // Nested Aztec-style diamond at the core, gently pulsing.
      const pulse = reduceMotion ? 0.9 : 0.62 + 0.32 * (0.5 + 0.5 * Math.sin(t * 1.6))
      const coreSize = base * 0.2
      drawDiamond(cx, cy, coreSize, pulse)
      drawDiamond(cx, cy, coreSize * 0.5, pulse)
      ctx.save()
      ctx.globalAlpha = 0.9
      ctx.fillStyle = NAVY
      ctx.beginPath()
      ctx.arc(cx, cy, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    resize()

    // Reduced motion: paint one settled frame and stop. No rAF, no shuffle.
    if (reduceMotion) {
      draw(0)
      const ro = new ResizeObserver(() => {
        resize()
        draw(0)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    let raf = 0
    let running = true
    let start = 0
    const loop = (now: number) => {
      if (!running) return
      if (!start) start = now
      draw((now - start) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    // Pause the loop while the card is scrolled out of view.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true
          start = 0
          raf = requestAnimationFrame(loop)
        } else if (!entry.isIntersecting && running) {
          running = false
          cancelAnimationFrame(raf)
        }
      },
      { threshold: 0 },
    )
    io.observe(canvas)

    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
    }
  }, [height, reduceMotion])

  return (
    <div
      className={className}
      role="img"
      aria-label="Your transfer is being privately processed"
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height }} />
    </div>
  )
}
