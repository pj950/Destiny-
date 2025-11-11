/**
 * POST /api/subscriptions/update
 * 
 * Update user's subscription settings (auto_renew, etc.)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getUserSubscription } from '../../../lib/subscription'
import { supabaseService } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // In a real app, extract userId from auth header/session
    const userId = req.query.user_id as string
    const { auto_renew } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'user_id query parameter is required' })
    }

    if (typeof auto_renew !== 'boolean') {
      return res.status(400).json({ error: 'auto_renew must be a boolean' })
    }

    // Check if user has an active subscription
    const subscription = await getUserSubscription(userId)
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' })
    }

    // Update subscription
    const { data: updated, error } = await supabaseService
      .from('user_subscriptions')
      .update({ 
        auto_renew,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id)
      .select()
      .single()

    if (error) {
      console.error('[API] Error updating subscription:', error)
      return res.status(500).json({ error: 'Failed to update subscription' })
    }

    return res.status(200).json({
      ok: true,
      data: updated,
      message: `Auto-renewal ${auto_renew ? 'enabled' : 'disabled'} successfully`,
    })
  } catch (error) {
    console.error('[API] Error updating subscription:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
