import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { computeBazi } from '../../../lib/bazi'
import { analyzeBaziInsights, toDBFormat } from '../../../lib/bazi-insights'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  
  // MVP: No authentication required
  // TODO (Post-MVP): Verify Bearer token from Authorization header
  
  const { profile_id } = req.body
  
  // Input validation
  if (!profile_id || typeof profile_id !== 'string') {
    return res.status(400).json({ ok: false, message: 'profile_id is required' })
  }
  
  try {
    // Fetch the profile
    const { data: profile, error } = await supabaseService
      .from('profiles')
      .select('*')
      .eq('id', profile_id)
      .single()
      
    if (error || !profile) {
      return res.status(400).json({ ok: false, message: 'profile not found' })
    }
    
    // Compute the BaZi chart
    const chart = computeBazi(profile.birth_local, profile.birth_timezone)
    
    // Analyze BaZi insights
    const birthYear = new Date(profile.birth_local).getFullYear()
    const insights = analyzeBaziInsights(chart, birthYear)
    const insightsDB = toDBFormat(insights)
    
    // Insert the chart into the database with new insights fields
    const { data: inserted, error: insertErr } = await supabaseService
      .from('charts')
      .insert([{ 
        profile_id, 
        chart_json: chart, 
        wuxing_scores: chart.wuxing,
        day_master: insightsDB.day_master,
        ten_gods: insightsDB.ten_gods,
        luck_cycles: insightsDB.luck_cycles
      }])
      .select()
      .single()
      
    if (insertErr) {
      return res.status(500).json({ ok: false, message: insertErr.message })
    }
    
    if (!inserted) {
      return res.status(500).json({ ok: false, message: 'Failed to create chart' })
    }
    
    res.json({ ok: true, chart: chart, chart_id: inserted.id })
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message || 'Internal server error' })
  }
}
