import type { NextApiRequest, NextApiResponse } from 'next'

export const config = { maxDuration: 30 }

// KB_API_URL must be set in Vercel env vars → public api_graph URL (e.g. http://VPS_IP:10004)
const KB_API = process.env.KB_API_URL || 'http://localhost:10004'
const KB_API_KEY = process.env.KB_API_KEY || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { query, history } = req.body
  if (!query?.trim()) {
    return res.status(400).json({ error: 'query is required' })
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (KB_API_KEY) headers['X-API-Key'] = KB_API_KEY

    const upstream = await fetch(`${KB_API}/kb/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: query.trim(), history: history || [] }),
    })

    const data = await upstream.json()
    return res.status(upstream.ok ? 200 : upstream.status).json(data)
  } catch (err) {
    console.error('[kb-ask proxy]', err)
    return res.status(502).json({ error: 'KB service unavailable' })
  }
}
