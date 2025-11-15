/**
 * POST /api/subscriptions/checkout
 * 
 * Create a Stripe Checkout Session for subscription payment
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { stripeHelpers } from '@/features/payments/stripe'
import { SUBSCRIPTION_PLANS } from '@/features/subscriptions/services'
import type { SubscriptionTier } from '@/types/database'

// Stripe Price IDs mapping (configured in Stripe Dashboard)
// These should be set as environment variables in production
const STRIPE_PRICE_IDS: Record<string, { monthly: string; yearly: string }> = {
  basic: {
    monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY || 'price_basic_monthly',
    yearly: process.env.STRIPE_PRICE_BASIC_YEARLY || 'price_basic_yearly',
  },
  premium: {
    monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || 'price_premium_monthly',
    yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY || 'price_premium_yearly',
  },
  vip: {
    monthly: process.env.STRIPE_PRICE_VIP_MONTHLY || 'price_vip_monthly',
    yearly: process.env.STRIPE_PRICE_VIP_YEARLY || 'price_vip_yearly',
  },
}

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

    // Get Stripe Price ID
    const priceId = STRIPE_PRICE_IDS[plan_id]?.[billing_cycle as 'monthly' | 'yearly']
    if (!priceId) {
      return res.status(500).json({ error: 'Stripe price not configured for this plan' })
    }

    // Get base URL for redirect
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // Create Stripe Checkout Session
    const session = await stripeHelpers.createCheckoutSession({
      priceId,
      userId: user_id,
      planId: plan_id,
      billingCycle: billing_cycle as 'monthly' | 'yearly',
      successUrl: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/checkout/cancel`,
      customerEmail: customer_email,
    })

    return res.status(200).json({
      ok: true,
      url: session.url,
      session_id: session.id,
    })
  } catch (error: any) {
    console.error('[API] Error creating checkout:', error)
    return res.status(500).json({ 
      error: 'Failed to create checkout',
      details: error.message,
    })
  }
}
