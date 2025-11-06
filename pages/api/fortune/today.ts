import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { randomUUID } from 'crypto'

const SESSION_COOKIE_NAME = 'fortune_session'
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

const buildFortunePayload = (fortune: any) => ({
  id: fortune.id,
  category: fortune.category,
  stick_id: fortune.stick_id,
  stick_text: fortune.stick_text,
  stick_level: fortune.stick_level,
  ai_analysis: fortune.ai_analysis,
  created_at: fortune.created_at,
})

const serializeCookie = (name: string, value: string) => {
  const expires = `Max-Age=${SESSION_COOKIE_MAX_AGE}`
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${name}=${value}; Path=/; ${expires}; HttpOnly; SameSite=Lax${secure}`
}

const ensureSessionId = (req: NextApiRequest, res: NextApiResponse) => {
  let sessionId = req.cookies?.[SESSION_COOKIE_NAME]
  if (!sessionId) {
    sessionId = randomUUID()
    const newCookie = serializeCookie(SESSION_COOKIE_NAME, sessionId)
    const existing = res.getHeader('Set-Cookie')
    if (!existing) {
      res.setHeader('Set-Cookie', newCookie)
    } else if (Array.isArray(existing)) {
      res.setHeader('Set-Cookie', [...existing, newCookie])
    } else {
      res.setHeader('Set-Cookie', [existing, newCookie])
    }
  }
  return sessionId
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  
  // MVP: No authentication required
  // TODO (Post-MVP): Verify Bearer token and set user_id
  
  const sessionId = ensureSessionId(req, res)
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
  
  try {
    const { data: fortune, error } = await supabaseService
      .from('fortunes')
      .select('*')
      .eq('draw_date', today)
      .eq('session_id', sessionId)
      .maybeSingle()
    
    if (error) {
      return res.status(500).json({ ok: false, message: error.message })
    }
    
    if (!fortune) {
      return res.json({ ok: true, hasFortune: false })
    }
    
    return res.json({ 
      ok: true, 
      hasFortune: true,
      fortune: buildFortunePayload(fortune)
    })
    
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message || 'Internal server error' })
  }
}