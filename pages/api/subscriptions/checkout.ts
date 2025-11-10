/**
 * POST /api/subscriptions/checkout
 * 
 * Create a Razorpay payment link for subscription checkout
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { razorpayHelpers } from '../../../lib/razorpay'
import { SUBSCRIPTION_PLANS } from '../../../lib/subscription'
import type { SubscriptionTier } from '../../../types/database'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { plan_id, billing_cycle = 'monthly', user_id, customer_email, customer_name } = req.body

    // Validate plan_id
    if (!plan_id || !(plan_id in SUBSCRIPTION_PLANS)) {
      return res.status(400).json({ error: 'Invalid plan_id' })
    }

    // Validate billing_cycle
    if (!['monthly', 'yearly'].includes(billing_cycle)) {
      return res.status(400).json({ error: 'Invalid billing_cycle' })
    }

    // Validate user_id
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' })
    }

    const plan = SUBSCRIPTION_PLANS[plan_id as SubscriptionTier]
    const amount = plan.price[billing_cycle as 'monthly' | 'yearly']

    // For free tier, no checkout needed
    if (amount === 0) {
      return res.status(400).json({ error: 'Free tier does not require payment' })
    }

    // Create payment link
    const paymentLink = await razorpayHelpers.createPaymentLink({
      amount: amount * 100, // Convert to paise (smallest currency unit)
      currency: 'INR',
      description: `${plan.name} Subscription (${billing_cycle})`,
      customer: customer_email ? {
        email: customer_email,
        name: customer_name,
      } : undefined,
      notes: {
        plan_id,
        user_id,
        billing_cycle,
        purchase_type: 'subscription',
      },
      reference_id: `sub_${user_id}_${plan_id}_${Date.now()}`,
    })

    return res.status(200).json({
      ok: true,
      data: {
        payment_link_id: paymentLink.id,
        payment_url: paymentLink.short_url,
        amount: amount,
        currency: 'INR',
        plan: plan.name,
        billing_cycle,
        expires_at: paymentLink.expire_by,
      },
    })
  } catch (error: any) {
    console.error('[API] Error creating checkout:', error)
    return res.status(500).json({ 
      error: 'Failed to create checkout',
      details: error.message,
    })
  }
}
