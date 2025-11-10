/**
 * POST /api/subscriptions/track-usage (Internal API)
 * 
 * Track feature usage for quota enforcement
 * Should be called internally when features are used
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { trackUsage } from '../../../lib/subscription'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { user_id, feature, amount = 1, report_id } = req.body

    // Validate required fields
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' })
    }

    if (!feature || !['yearly_flow', 'qa'].includes(feature)) {
      return res.status(400).json({ error: 'Invalid feature' })
    }

    // Track usage
    const success = await trackUsage(user_id, feature, amount, report_id)

    if (!success) {
      return res.status(500).json({ error: 'Failed to track usage' })
    }

    return res.status(200).json({
      ok: true,
      message: `Usage tracked: ${feature} +${amount}`,
    })
  } catch (error) {
    console.error('[API] Error tracking usage:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
