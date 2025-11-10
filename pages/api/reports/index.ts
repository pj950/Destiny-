import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'

const DEFAULT_LIMIT = 50

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const { limit, chart_id, report_type } = req.query

  const parsedLimit = limit ? parseInt(limit as string, 10) : DEFAULT_LIMIT
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return res.status(400).json({ ok: false, message: 'limit must be a number between 1 and 100' })
  }

  try {
    let query = supabaseService
      .from('bazi_reports')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(parsedLimit)

    if (chart_id) {
      query = query.eq('chart_id', chart_id)
    }

    if (report_type) {
      query = query.eq('report_type', report_type)
    }

    const { data: reports, error } = await query

    if (error) {
      return res.status(500).json({ ok: false, message: error.message })
    }

    res.json({ ok: true, reports: reports || [] })
  } catch (err: any) {
    console.error('[Reports Index] Error:', err)
    return res.status(500).json({ ok: false, message: err.message || 'Internal server error' })
  }
}
