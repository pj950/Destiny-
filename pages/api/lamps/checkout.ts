import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { stripeHelpers } from '../../../lib/stripe'

const LAMP_PRICE = 1990 // ₹19.90 in paise (smallest unit for INR)
const VALID_LAMP_KEYS = ['p1', 'p2', 'p3', 'p4']

interface CheckoutRequest {
  lamp_key: string
}

interface CheckoutResponse {
  url: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CheckoutResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check for required environment variables at request time
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (!siteUrl) {
      console.error('[Lamp Checkout] NEXT_PUBLIC_SITE_URL environment variable is not configured')
      return res.status(500).json({ error: 'Server configuration error: missing NEXT_PUBLIC_SITE_URL' })
    }

    const { lamp_key }: CheckoutRequest = req.body

    // Validate lamp_key
    if (!lamp_key || typeof lamp_key !== 'string') {
      return res.status(400).json({ error: 'lamp_key is required and must be a string' })
    }

    if (!VALID_LAMP_KEYS.includes(lamp_key)) {
      return res.status(400).json({ error: 'Invalid lamp_key. Must be one of: p1, p2, p3, p4' })
    }

    console.log(`[Lamp Checkout] Creating Stripe checkout for lamp: ${lamp_key}`)

    // Check lamp availability
    const { data: lamp, error: lampError } = await supabaseService
      .from('lamps')
      .select('id, status, checkout_session_id')
      .eq('lamp_key', lamp_key)
      .single()

    if (lampError || !lamp) {
      console.error(`[Lamp Checkout] Lamp ${lamp_key} not found:`, lampError)
      return res.status(404).json({ error: 'Lamp not found' })
    }

    if (lamp.status === 'lit') {
      console.log(`[Lamp Checkout] Lamp ${lamp_key} is already lit`)
      return res.status(400).json({ error: 'This lamp has already been lit' })
    }

    // Create Stripe Checkout Session for one-time payment
    const session = await stripeHelpers.createCheckoutSession({
      priceId: process.env.STRIPE_PRICE_LAMP || 'price_lamp',
      userId: 'anonymous',
      planId: 'lamp',
      billingCycle: 'monthly', // Not applicable for lamp purchase
      successUrl: `${siteUrl}/lamps?payment=success`,
      cancelUrl: `${siteUrl}/lamps?payment=cancel`,
      customerEmail: undefined,
    })

    console.log(`[Lamp Checkout] Created Stripe session ${session.id} for lamp ${lamp_key}`)

    // Update lamp with checkout session ID
    const { error: updateError } = await supabaseService
      .from('lamps')
      .update({
        checkout_session_id: session.id,
        updated_at: new Date().toISOString()
      })
      .eq('lamp_key', lamp_key)

    if (updateError) {
      console.error(`[Lamp Checkout] Error updating lamp ${lamp_key} with session ID:`, updateError)
      // Don't fail the request, but log the error
    }

    return res.status(200).json({ url: session.url! })

  } catch (error: any) {
    console.error('[Lamp Checkout] Unexpected error:', error)
    
    // Handle Stripe-specific error codes
    let errorMessage = error.message || 'An unexpected error occurred while creating payment checkout'
    
    if (error.type === 'StripeInvalidRequestError') {
      errorMessage = 'Invalid payment parameters. Please try again.'
    } else if (error.type === 'StripeAuthenticationError') {
      errorMessage = 'Payment service authentication failed. Please contact support.'
    } else if (error.type === 'StripeRateLimitError') {
      errorMessage = 'Too many requests. Please try again in a moment.'
    }
    
    return res.status(500).json({ error: errorMessage })
  }
}
