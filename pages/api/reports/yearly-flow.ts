import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { YEARLY_FLOW_PROMPT_VERSION } from '../../../lib/gemini/schemas'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { chart_id, target_year, subscription_tier = 'free' } = req.body

  if (!chart_id || typeof chart_id !== 'string') {
    return res.status(400).json({ ok: false, message: 'chart_id is required' })
  }

  const year = target_year || new Date().getFullYear()

  if (typeof year !== 'number' || year < 1900 || year > 2100) {
    return res.status(400).json({ ok: false, message: 'target_year must be a valid year' })
  }

  try {
    // Verify chart exists
    const { data: chart, error: chartError } = await supabaseService
      .from('charts')
      .select('id')
      .eq('id', chart_id)
      .single()

    if (chartError || !chart) {
      return res.status(404).json({ ok: false, message: 'Chart not found' })
    }

    // Create job record
    const { data: job, error: jobError } = await supabaseService
      .from('jobs')
      .insert([
        {
          user_id: null, // TODO: Extract from auth when available
          chart_id,
          job_type: 'yearly_flow_report',
          status: 'pending',
          result_url: null,
          metadata: {
            target_year: year,
            prompt_version: YEARLY_FLOW_PROMPT_VERSION,
            subscription_tier,
            requester_timestamp: new Date().toISOString(),
          },
        },
      ])
      .select()
      .single()

    if (jobError || !job) {
      console.error('[Yearly Flow] Failed to create job:', jobError)
      return res.status(500).json({ ok: false, message: 'Failed to create job' })
    }

    res.json({ ok: true, job_id: job.id, target_year: year })
  } catch (err: any) {
    console.error('[Yearly Flow] Error:', err)
    return res.status(500).json({ ok: false, message: err.message || 'Internal server error' })
  }
}
