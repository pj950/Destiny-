import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import type { BaziReport, SubscriptionTier } from '../../../types/database'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const { id } = req.query
  const { subscription_tier = 'free' } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, message: 'report_id is required' })
  }

  try {
    const { data: report, error } = await supabaseService
      .from('bazi_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !report) {
      return res.status(404).json({ ok: false, message: 'Report not found' })
    }

    const typedReport = report as BaziReport

    // Character profile is publicly available
    if (typedReport.report_type === 'character_profile') {
      return res.json({ ok: true, report: typedReport })
    }

    // Yearly flow - check subscription tier
    if (typedReport.report_type === 'yearly_flow') {
      const typedTier = subscription_tier as SubscriptionTier
      const isPaid = typedTier !== 'free'

      if (isPaid) {
        return res.json({ ok: true, report: typedReport })
      }

      // Free users get summary only
      return res.json({
        ok: true,
        report: {
          ...typedReport,
          body: null,
          structured: {
            message: 'Please upgrade to unlock the complete yearly flow report',
          },
        },
        upgradeHint: 'Upgrade to Premium or VIP to access the full yearly flow analysis',
      })
    }

    res.json({ ok: true, report: typedReport })
  } catch (err: any) {
    console.error('[Report Get] Error:', err)
    return res.status(500).json({ ok: false, message: err.message || 'Internal server error' })
  }
}
