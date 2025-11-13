/**
 * POST /api/subscriptions/cancel
 * 
 * Cancel user's subscription (handles both Stripe and database-only subscriptions)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { cancelSubscription, getUserSubscription } from '../../../lib/subscription'
import { stripeHelpers } from '../../../lib/stripe'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // In a real app, extract userId from auth header/session
    const userId = req.query.user_id as string
    const { cancel_at_end = true } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'user_id query parameter is required' })
    }

    // Check if user has an active subscription
    const subscription = await getUserSubscription(userId)
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' })
    }

    // If subscription has a Stripe subscription ID, cancel it in Stripe first
    if (subscription.stripe_subscription_id) {
      try {
        await stripeHelpers.cancelSubscription(subscription.stripe_subscription_id, cancel_at_end)
        console.log(`[API] Canceled Stripe subscription ${subscription.stripe_subscription_id}`)
      } catch (error: any) {
        console.error('[API] Error canceling Stripe subscription:', error)
        return res.status(500).json({ 
          error: 'Failed to cancel subscription in Stripe',
          details: error.message,
        })
      }
    }

    // Cancel subscription in database
    const success = await cancelSubscription(userId, cancel_at_end)

    if (!success) {
      return res.status(500).json({ error: 'Failed to cancel subscription in database' })
    }

    return res.status(200).json({
      ok: true,
      message: cancel_at_end 
        ? 'Subscription will be canceled at the end of current period'
        : 'Subscription has been canceled immediately',
    })
  } catch (error) {
    console.error('[API] Error canceling subscription:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
