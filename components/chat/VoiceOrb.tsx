'use client'

import { useEffect, useRef } from 'react'
import styles from './VoiceOrb.module.css'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Props {
  state: OrbState
  level: number // 0–1
  embedded?: boolean
}

export function VoiceOrb({ state, level, embedded = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const levelRef = useRef(level)
  const stateRef = useRef(state)
  const frameRef = useRef(0)
  const timeRef = useRef(0)

  levelRef.current = level
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const S = 220
    canvas.width = S
    canvas.height = S
    const cx = S / 2

    const PALETTE = {
      listening: { r: 16,  g: 185, b: 129 }, // emerald
      thinking:  { r: 251, g: 191, b: 36  }, // amber
      speaking:  { r: 124, g: 58,  b: 237 }, // violet
      idle:      { r: 124, g: 58,  b: 237 },
    }

    const draw = (ts: number) => {
      frameRef.current = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, S, S)

      const s = stateRef.current
      const raw = levelRef.current
      const { r, g, b } = PALETTE[s] ?? PALETTE.idle
      const t = ts / 1000

      // Amplify raw level — audio levels from analyser are often 0.05–0.2
      const breath = 0.14 + 0.08 * Math.sin(t * 2.4)
      const lv = Math.max(raw * 3.5, breath)

      // Background disc — grows with level
      const bgR = 55 + 55 * lv
      const bg = ctx.createRadialGradient(cx, cx, 0, cx, cx, bgR)
      bg.addColorStop(0,   `rgba(${r},${g},${b},${0.14 + 0.12 * lv})`)
      bg.addColorStop(0.55,`rgba(${r},${g},${b},${0.04 + 0.06 * lv})`)
      bg.addColorStop(1,   `rgba(${r},${g},${b},0)`)
      ctx.beginPath()
      ctx.arc(cx, cx, bgR, 0, Math.PI * 2)
      ctx.fillStyle = bg
      ctx.fill()

      // Ripple rings — 3 staggered phases, expand outward over ~1s each
      const rippleGain = Math.min(lv * 1.6, 1)
      if (rippleGain > 0.08) {
        for (let i = 0; i < 3; i++) {
          const phase = (t * 1.1 + i * 0.33) % 1
          const rr = 38 + phase * 78
          const ra = (1 - phase) * 0.55 * rippleGain
          ctx.beginPath()
          ctx.arc(cx, cx, rr, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${r},${g},${b},${ra})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      // Main rings — large amplitude
      const rings = [
        { base: 42, amp: 62, alpha: 0.70, width: 2.5 },
        { base: 58, amp: 42, alpha: 0.38, width: 1.5 },
        { base: 72, amp: 26, alpha: 0.18, width: 1   },
      ]
      rings.forEach(({ base, amp, alpha, width }) => {
        const radius = base + amp * lv
        ctx.beginPath()
        ctx.arc(cx, cx, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
        ctx.lineWidth = width
        ctx.stroke()
      })

      // Thinking spinner arc
      if (s === 'thinking') {
        const a = t * 2.5
        ctx.beginPath()
        ctx.arc(cx, cx, 52, a, a + Math.PI * 1.3)
        ctx.strokeStyle = `rgba(${r},${g},${b},0.75)`
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.stroke()
      }

      // Core orb — pulsing size driven by level
      const coreR = 28 + 16 * lv
      const glow = ctx.createRadialGradient(cx, cx, 2, cx, cx, coreR)
      glow.addColorStop(0,   `rgba(${r},${g},${b},1)`)
      glow.addColorStop(0.55,`rgba(${r},${g},${b},0.75)`)
      glow.addColorStop(1,   `rgba(${r},${g},${b},0.18)`)
      ctx.beginPath()
      ctx.arc(cx, cx, coreR, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()

      // Inner highlight
      ctx.beginPath()
      ctx.arc(cx - 5, cx - 5, 7, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,0.42)`
      ctx.fill()
    }

    frameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  if (state === 'idle') return null

  const LABELS: Record<OrbState, string> = {
    idle: '',
    listening: 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
  }

  return (
    <div className={embedded ? styles.wrapEmbedded : styles.wrap}>
      <canvas ref={canvasRef} className={styles.canvas} width={220} height={220} />
      <div className={styles.label}>{LABELS[state]}</div>
    </div>
  )
}
