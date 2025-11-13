import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { stripeHelpers } from '../../../lib/stripe'

const LAMP_PRICE = 1990 // ₹19.90 in paise (smallest unit for INR)

interface CheckoutRequest {
  lamp_id: string
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

    const { lamp_id }: CheckoutRequest = req.body

    // Validate lamp_id
    if (!lamp_id || typeof lamp_id !== 'string') {
      return res.status(400).json({ error: 'lamp_id is required and must be a string' })
    }

    console.log(`[Lamp Checkout] Creating Stripe checkout for lamp ID: ${lamp_id}`)

    // Check lamp availability
    const { data: lamp, error: lampError } = await supabaseService
      .from('lamps')
      .select('id, status, checkout_session_id, lamp_key')
      .eq('id', lamp_id)
      .single()

    if (lampError || !lamp) {
      console.error(`[Lamp Checkout] Lamp ${lamp_id} not found:`, lampError)
      return res.status(404).json({ error: 'Lamp not found' })
    }

    if (lamp.status === 'lit') {
      console.log(`[Lamp Checkout] Lamp ${lamp.lamp_key} is already lit`)
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

    console.log(`[Lamp Checkout] Created Stripe session ${session.id} for lamp ${lamp.lamp_key}`)

    // Update lamp with checkout session ID
    const { error: updateError } = await supabaseService
      .from('lamps')
      .update({
        checkout_session_id: session.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', lamp_id)

    if (updateError) {
      console.error(`[Lamp Checkout] Error updating lamp ${lamp_id} with session ID:`, updateError)
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
