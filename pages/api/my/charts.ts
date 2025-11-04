import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'

// MVP: Configurable limit for charts to return
const DEFAULT_LIMIT = 20

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  
  // MVP: No authentication required
  // TODO (Post-MVP): Extract user_id from Bearer token and filter by user's profiles
  // const authHeader = req.headers.authorization
  // if (!authHeader || !authHeader.startsWith('Bearer ')) {
  //   return res.status(401).json({ ok: false, message: 'Unauthorized' })
  // }
  // const token = authHeader.substring(7)
  // Validate token and get user_id, then filter charts by profiles.user_id
  
  const { profile_id, limit } = req.query
  
  // Parse limit with validation
  const parsedLimit = limit ? parseInt(limit as string, 10) : DEFAULT_LIMIT
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return res.status(400).json({ ok: false, message: 'limit must be a number between 1 and 100' })
  }
  
  try {
    let query = supabaseService
      .from('charts')
      .select('id, profile_id, chart_json, wuxing_scores, ai_summary, created_at')
      .order('created_at', { ascending: false })
      .limit(parsedLimit)
    
    // MVP: Optional profile_id filter for anonymous access
    if (profile_id) {
      query = query.eq('profile_id', profile_id)
    }
    
    const { data: charts, error } = await query
    
    if (error) {
      return res.status(500).json({ ok: false, message: error.message })
    }
    
    res.json({ ok: true, charts: charts || [] })
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message || 'Internal server error' })
  }
}
