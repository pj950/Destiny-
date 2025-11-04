import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { computeBazi } from '../../../lib/bazi'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  
  const { profile_id } = req.body
  
  const { data: profile, error } = await supabaseService
    .from('profiles')
    .select('*')
    .eq('id', profile_id)
    .single()
    
  if (error || !profile) return res.status(400).json({ ok: false, message: 'profile not found' })
  
  const chart = computeBazi(profile.birth_local, profile.birth_timezone)
  
  const { data: inserted, error: insertErr } = await supabaseService
    .from('charts')
    .insert([{ 
      profile_id, 
      chart_json: chart, 
      wuxing_scores: chart.wuxing 
    }])
    .select()
    .single()
    
  if (insertErr) return res.status(500).json({ ok: false, message: insertErr.message })
  
  res.json({ ok: true, chart: chart, chart_id: inserted.id })
}
