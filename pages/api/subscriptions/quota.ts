/**
 * GET /api/subscriptions/quota
 * 
 * Get current user's quota usage
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getQuotaUsage, getUserTier, SUBSCRIPTION_PLANS } from '@/features/subscriptions/services'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // In a real app, extract userId from auth header/session
    const userId = req.query.user_id as string

    if (!userId) {
      return res.status(400).json({ error: 'user_id query parameter is required' })
    }

    const tier = await getUserTier(userId)
    const quotaUsage = await getQuotaUsage(userId)
    const plan = SUBSCRIPTION_PLANS[tier]

    return res.status(200).json({
      ok: true,
      data: {
        tier,
        quota: quotaUsage,
        limits: {
          yearly_flow: plan.features.yearly_flow.limit,
          qa_questions: plan.features.qa.limit,
        },
      },
    })
  } catch (error) {
    console.error('[API] Error fetching quota:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
