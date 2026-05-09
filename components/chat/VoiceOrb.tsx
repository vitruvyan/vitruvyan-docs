'use client'

import { useEffect, useRef } from 'react'
import styles from './VoiceOrb.module.css'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Props {
  state: OrbState
  level: number // 0–1
}

const ICONS: Record<OrbState, string> = {
  idle: '',
  listening: '🎤',
  thinking: '◈',
  speaking: '◉',
}

export function VoiceOrb({ state, level }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const levelRef = useRef(level)
  const stateRef = useRef(state)
  const frameRef = useRef(0)
  const angleRef = useRef(0)

  levelRef.current = level
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const SIZE = 160
    canvas.width = SIZE
    canvas.height = SIZE
    const cx = SIZE / 2

    const COLORS: Record<OrbState, string> = {
      idle: '#7c3aed',
      listening: '#10b981',
      thinking: '#f59e0b',
      speaking: '#7c3aed',
    }

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, SIZE, SIZE)

      const s = stateRef.current
      const lv = levelRef.current
      const color = COLORS[s] || COLORS.speaking

      if (s === 'thinking') {
        angleRef.current += 0.04
        // Breathing pulse
        const pulse = 0.15 + 0.08 * Math.sin(angleRef.current * 2)
        drawRings(ctx, cx, color, pulse)
        drawSpinner(ctx, cx, color, angleRef.current)
      } else {
        angleRef.current += 0.02
        const boosted = Math.min(lv * 1.8, 1)
        drawRings(ctx, cx, color, boosted)
      }

      // Core orb
      const gradient = ctx.createRadialGradient(cx, cx, 4, cx, cx, 28)
      gradient.addColorStop(0, hexAlpha(color, 0.95))
      gradient.addColorStop(1, hexAlpha(color, 0.6))
      ctx.beginPath()
      ctx.arc(cx, cx, 28, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
    }

    draw()
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  if (state === 'idle') return null

  return (
    <div className={styles.wrap}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <span className={styles.icon}>{ICONS[state]}</span>
    </div>
  )
}

function drawRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  color: string,
  level: number,
) {
  const rings = [
    { r: 38 + level * 22, alpha: 0.35 },
    { r: 52 + level * 28, alpha: 0.18 },
    { r: 66 + level * 14, alpha: 0.08 },
  ]
  rings.forEach(({ r, alpha }) => {
    ctx.beginPath()
    ctx.arc(cx, cx, r, 0, Math.PI * 2)
    ctx.strokeStyle = hexAlpha(color, alpha)
    ctx.lineWidth = 1.5
    ctx.stroke()
  })
}

function drawSpinner(
  ctx: CanvasRenderingContext2D,
  cx: number,
  color: string,
  angle: number,
) {
  ctx.beginPath()
  ctx.arc(cx, cx, 44, angle, angle + Math.PI * 1.2)
  ctx.strokeStyle = hexAlpha(color, 0.6)
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.stroke()
}

function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
