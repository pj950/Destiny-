import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  
  const { name, birth_local, birth_timezone, gender, lat, lon } = req.body

  const { data: p, error: insertErr } = await supabaseService
    .from('profiles')
    .insert([{ 
      user_id: null,
      name, 
      birth_local, 
      birth_timezone, 
      gender, 
      lat, 
      lon 
    }])
    .select()
    .single()
    
  if (insertErr) return res.status(500).json({ ok: false, message: insertErr.message })
  
  res.json({ ok: true, profile_id: p.id })
}
