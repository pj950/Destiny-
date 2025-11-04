import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  
  const { data: job, error } = await supabaseService
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single()
    
  if (error) return res.status(404).json({ ok: false, message: 'job not found' })
  
  res.json({ ok: true, job })
}
