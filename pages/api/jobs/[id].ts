import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  
  // MVP: No authentication required
  // TODO (Post-MVP): Verify Bearer token from Authorization header
  
  const { id } = req.query
  
  // Input validation
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, message: 'id parameter is required' })
  }
  
  try {
    const { data: job, error } = await supabaseService
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single()
      
    if (error || !job) {
      return res.status(404).json({ ok: false, message: 'job not found' })
    }
    
    res.json({ ok: true, job })
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message || 'Internal server error' })
  }
}
