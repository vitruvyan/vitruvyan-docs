import type { NextApiRequest, NextApiResponse } from 'next'

const OPENAI_KEY = process.env.OPENAI_API_KEY || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' })

  try {
    const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'tts-1', voice: 'nova', input: text.slice(0, 4096) }),
    })
    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}))
      return res.status(upstream.status).json(err)
    }
    const audio = await upstream.arrayBuffer()
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    return res.send(Buffer.from(audio))
  } catch {
    return res.status(502).json({ error: 'TTS service error' })
  }
}
