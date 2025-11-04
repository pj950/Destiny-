import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'

// MVP: Configurable limit for jobs to return
const DEFAULT_LIMIT = 50

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  
  // MVP: No authentication required
  // TODO (Post-MVP): Extract user_id from Bearer token and filter by user's jobs
  
  const { limit, chart_id } = req.query
  
  // Parse limit with validation
  const parsedLimit = limit ? parseInt(limit as string, 10) : DEFAULT_LIMIT
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return res.status(400).json({ ok: false, message: 'limit must be a number between 1 and 100' })
  }
  
  try {
    let query = supabaseService
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parsedLimit)
    
    // Optional chart_id filter
    if (chart_id) {
      query = query.eq('chart_id', chart_id)
    }
    
    const { data: jobs, error } = await query
    
    if (error) {
      return res.status(500).json({ ok: false, message: error.message })
    }
    
    res.json({ ok: true, jobs: jobs || [] })
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message || 'Internal server error' })
  }
}
