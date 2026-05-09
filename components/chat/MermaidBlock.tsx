'use client'

import { useEffect, useRef, useState } from 'react'

let mermaidReady = false

export function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default
        if (!mermaidReady) {
          mermaid.initialize({
            startOnLoad: false,
            theme: document.documentElement.classList.contains('dark') ? 'dark' : 'neutral',
            fontFamily: 'var(--font-inter, sans-serif)',
            fontSize: 13,
          })
          mermaidReady = true
        }
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
        const { svg } = await mermaid.render(id, code.trim())
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Mermaid render error')
      }
    }

    render()
    return () => { cancelled = true }
  }, [code])

  if (error) return <pre style={{ fontSize: '0.75rem', opacity: 0.5 }}>{code}</pre>

  return (
    <div
      ref={ref}
      style={{
        overflow: 'auto',
        maxWidth: '100%',
        margin: '0.75rem 0',
        padding: '0.75rem',
        borderRadius: '0.5rem',
        background: 'rgba(0,0,0,0.03)',
      }}
    />
  )
}
