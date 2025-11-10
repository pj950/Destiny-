/**
 * GET /api/subscriptions/current
 * 
 * Get current user's subscription status
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getUserSubscription, getUserTier, getQuotaUsage, SUBSCRIPTION_PLANS } from '../../../lib/subscription'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // In a real app, extract userId from auth header/session
    // For now, we'll expect it in query params for testing
    const userId = req.query.user_id as string

    if (!userId) {
      return res.status(400).json({ error: 'user_id query parameter is required' })
    }

    const subscription = await getUserSubscription(userId)
    const tier = await getUserTier(userId)
    const quotaUsage = await getQuotaUsage(userId)
    const plan = SUBSCRIPTION_PLANS[tier]

    return res.status(200).json({
      ok: true,
      data: {
        tier,
        plan: plan.name,
        subscription: subscription ? {
          status: subscription.status,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          auto_renew: subscription.auto_renew,
          cancel_at: subscription.cancel_at,
        } : null,
        quota: quotaUsage,
      },
    })
  } catch (error) {
    console.error('[API] Error fetching current subscription:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
