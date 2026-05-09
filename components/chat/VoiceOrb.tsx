'use client'

import { useEffect, useRef } from 'react'
import styles from './VoiceOrb.module.css'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Props {
  state: OrbState
  level: number // 0–1
}

export function VoiceOrb({ state, level }: Props) {
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

      // Minimum breathing so orb is always visible when active
      const breath = 0.12 + 0.06 * Math.sin(t * 2.4)
      const lv = Math.max(raw * 1.6, breath)

      // Soft background disc
      const bg = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx)
      bg.addColorStop(0,   `rgba(${r},${g},${b},0.10)`)
      bg.addColorStop(0.5, `rgba(${r},${g},${b},0.04)`)
      bg.addColorStop(1,   `rgba(${r},${g},${b},0)`)
      ctx.beginPath()
      ctx.arc(cx, cx, cx, 0, Math.PI * 2)
      ctx.fillStyle = bg
      ctx.fill()

      // Rings — scale and opacity driven by lv
      const rings = [
        { base: 46, amp: 30, alpha: 0.55, width: 2   },
        { base: 62, amp: 22, alpha: 0.30, width: 1.5 },
        { base: 76, amp: 14, alpha: 0.15, width: 1   },
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
        ctx.arc(cx, cx, 54, a, a + Math.PI * 1.3)
        ctx.strokeStyle = `rgba(${r},${g},${b},0.75)`
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.stroke()
      }

      // Core orb glow
      const glow = ctx.createRadialGradient(cx, cx, 2, cx, cx, 34)
      glow.addColorStop(0, `rgba(${r},${g},${b},1)`)
      glow.addColorStop(0.6, `rgba(${r},${g},${b},0.7)`)
      glow.addColorStop(1, `rgba(${r},${g},${b},0.2)`)
      ctx.beginPath()
      ctx.arc(cx, cx, 34, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()

      // Inner bright spot
      ctx.beginPath()
      ctx.arc(cx - 6, cx - 6, 8, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,0.35)`
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
    <div className={styles.wrap}>
      <canvas ref={canvasRef} className={styles.canvas} width={220} height={220} />
      <div className={styles.label}>{LABELS[state]}</div>
    </div>
  )
}
