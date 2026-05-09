'use client'

import { useEffect, useRef, useCallback } from 'react'

interface Attractor {
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  speed: number
}

// Box-Muller gaussian random
function gaussian(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

export default function GaussianCanvas({ audioLevel = 0 }: { audioLevel?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const attractors = useRef<Attractor[]>([])
  const frameRef = useRef<number>(0)
  const timeRef = useRef<number>(0)
  // Use ref so animation loop reads latest value without re-mounting
  const audioLevelRef = useRef(audioLevel)
  audioLevelRef.current = audioLevel

  const initAttractors = useCallback((w: number, h: number) => {
    attractors.current = Array.from({ length: 4 }, (_, i) => ({
      x: w * (0.2 + i * 0.2),
      y: h * 0.5,
      vx: 0,
      vy: 0,
      phase: (i / 4) * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.3,
    }))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initAttractors(canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    const SD = 40

    const draw = () => {
      const t = (timeRef.current += 0.008)
      const w = canvas.width
      const h = canvas.height
      const al = audioLevelRef.current
      const boost = 1 + al * 3

      // Trail fade — color matches current theme background
      const isDark = document.documentElement.classList.contains('dark')
      ctx.fillStyle = isDark ? 'rgba(17,17,17,0.06)' : 'rgba(255,255,255,0.06)'
      ctx.fillRect(0, 0, w, h)

      attractors.current.forEach((att, i) => {
        // Lissajous-like autonomous movement
        att.x = w * (0.15 + 0.7 * (0.5 + 0.45 * Math.sin(t * att.speed + att.phase)))
        att.y = h * (0.2 + 0.6 * (0.5 + 0.4 * Math.cos(t * att.speed * 0.7 + att.phase + 1.2)))

        // Draw gaussian lines from this attractor
        const count = Math.floor((6 + al * 8) * boost)
        for (let j = 0; j < count; j++) {
          const sd = (SD + al * 60) * boost
          const x = att.x + gaussian() * sd
          const y = att.y + gaussian() * sd

          // Color palette: violet (#7c3aed), teal (#0d9488), sage (#6b8f71) — works on light+dark
          const hues = [262, 174, 152]
          const hue = hues[i % hues.length]
          const alpha = (0.15 + Math.random() * 0.2) * (1 + al * 0.5)

          ctx.strokeStyle = `hsla(${hue}, 65%, 52%, ${alpha})`
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(att.x, att.y)
          ctx.stroke()
        }
      })

      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(frameRef.current)
    }
  }, [initAttractors])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.85,
      }}
    />
  )
}
