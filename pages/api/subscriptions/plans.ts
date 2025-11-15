/**
 * GET /api/subscriptions/plans
 * 
 * Get all available subscription plans
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { SUBSCRIPTION_PLANS } from '@/features/subscriptions/services'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const plans = Object.values(SUBSCRIPTION_PLANS)

    return res.status(200).json({
      ok: true,
      data: plans,
    })
  } catch (error) {
    console.error('[API] Error fetching plans:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
