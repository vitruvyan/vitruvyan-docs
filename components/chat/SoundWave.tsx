'use client'

import { useEffect, useRef } from 'react'

export function SoundWave({ level, isDark }: { level: number; isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const tRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height

    const draw = () => {
      tRef.current += 0.08
      ctx.clearRect(0, 0, W, H)

      const amplitude = Math.max(4, level * H * 0.45)
      const color = isDark ? '147, 197, 253' : '109, 40, 217'

      ctx.beginPath()
      ctx.strokeStyle = `rgba(${color}, ${0.5 + level * 0.5})`
      ctx.lineWidth = 1.5

      for (let x = 0; x <= W; x++) {
        const ratio = x / W
        const freq1 = Math.sin(ratio * Math.PI * 8 + tRef.current)
        const freq2 = Math.sin(ratio * Math.PI * 3 - tRef.current * 0.7) * 0.4
        const y = H / 2 + (freq1 + freq2) * amplitude
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()

      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [level, isDark])

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={32}
      style={{ display: 'block', width: 240, height: 32 }}
    />
  )
}
