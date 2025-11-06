import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  
  // MVP: No authentication required
  // TODO (Post-MVP): Verify Bearer token and set user_id
  
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
  
  try {
    // Check if already drawn today (MVP: check for anonymous user)
    const { data: fortune, error } = await supabaseService
      .from('fortunes')
      .select('*')
      .eq('draw_date', today)
      .eq('user_id', null) // MVP: anonymous user
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') { // PGRST116 is "not found"
        return res.json({ ok: true, hasFortune: false })
      }
      return res.status(500).json({ ok: false, message: error.message })
    }
    
    if (!fortune) {
      return res.json({ ok: true, hasFortune: false })
    }
    
    res.json({ 
      ok: true, 
      hasFortune: true,
      fortune: {
        id: fortune.id,
        category: fortune.category,
        stick_id: fortune.stick_id,
        stick_text: fortune.stick_text,
        stick_level: fortune.stick_level,
        ai_analysis: fortune.ai_analysis,
        created_at: fortune.created_at
      }
    })
    
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message || 'Internal server error' })
  }
}