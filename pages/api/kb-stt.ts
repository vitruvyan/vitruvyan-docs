import type { NextApiRequest, NextApiResponse } from 'next'

export const config = { api: { bodyParser: false } }

const OPENAI_KEY = process.env.OPENAI_API_KEY || ''

async function readBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

  try {
    const audioBuffer = await readBody(req)
    const contentType = (req.headers['content-type'] || 'audio/webm').split(';')[0]

    const fd = new FormData()
    fd.append('file', new Blob([audioBuffer], { type: contentType }), 'audio.webm')
    fd.append('model', 'whisper-1')

    const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: fd,
    })
    const data = await upstream.json()
    return res.status(upstream.ok ? 200 : upstream.status).json(data)
  } catch {
    return res.status(502).json({ error: 'STT service error' })
  }
}
