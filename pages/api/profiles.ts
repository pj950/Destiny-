import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  
  // MVP: No authentication required - profiles created anonymously
  // TODO (Post-MVP): Verify Bearer token from Authorization header
  // const authHeader = req.headers.authorization
  // if (!authHeader || !authHeader.startsWith('Bearer ')) {
  //   return res.status(401).json({ ok: false, message: 'Unauthorized' })
  // }
  // const token = authHeader.substring(7)
  // Validate token with supabase.auth.getUser(token) and set user_id
  
  const { name, birth_local, birth_timezone, gender, lat, lon } = req.body
  
  // Input validation
  if (!birth_local || typeof birth_local !== 'string') {
    return res.status(400).json({ ok: false, message: 'birth_local is required and must be a valid timestamp string' })
  }
  
  if (!birth_timezone || typeof birth_timezone !== 'string') {
    return res.status(400).json({ ok: false, message: 'birth_timezone is required' })
  }
  
  // Validate that birth_local is a valid date
  const birthDate = new Date(birth_local)
  if (isNaN(birthDate.getTime())) {
    return res.status(400).json({ ok: false, message: 'birth_local must be a valid ISO 8601 timestamp' })
  }

  try {
    const { data: p, error: insertErr } = await supabaseService
      .from('profiles')
      .insert([{ 
        user_id: null, // MVP: null for anonymous users
        name, 
        birth_local, 
        birth_timezone, 
        gender, 
        lat, 
        lon 
      }])
      .select()
      .single()
      
    if (insertErr) {
      return res.status(500).json({ ok: false, message: insertErr.message })
    }
    
    if (!p) {
      return res.status(500).json({ ok: false, message: 'Failed to create profile' })
    }
    
    res.json({ ok: true, profile_id: p.id })
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message || 'Internal server error' })
  }
}
