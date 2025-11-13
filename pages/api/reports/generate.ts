import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { stripeHelpers } from '../../../lib/stripe'

// Guard: Check for required environment variables
if (!process.env.NEXT_PUBLIC_SITE_URL) {
  throw new Error('NEXT_PUBLIC_SITE_URL environment variable is not configured. Please set it in your .env.local file.')
}

const REPORT_PRICE = 1999 // ₹19.99 in paise

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  
  const { chart_id } = req.body
  
  // Input validation
  if (!chart_id || typeof chart_id !== 'string') {
    return res.status(400).json({ ok: false, message: 'chart_id is required' })
  }
  
  try {
    // Server-side validation: verify chart exists before creating checkout
    const { data: chart, error: chartError } = await supabaseService
      .from('charts')
      .select('id, profile_id')
      .eq('id', chart_id)
      .single()
    
    if (chartError || !chart) {
      return res.status(404).json({ ok: false, message: 'Chart not found' })
    }
    
    console.log(`[Reports Generate] Creating Stripe checkout for chart ${chart_id}`)
    
    // Create Stripe Checkout Session
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    const session = await stripeHelpers.createCheckoutSession({
      priceId: process.env.STRIPE_PRICE_DEEP_REPORT || 'price_deep_report',
      userId: 'anonymous',
      planId: 'deep_report',
      billingCycle: 'monthly', // Not applicable for one-time report purchase
      successUrl: `${siteUrl}/dashboard?payment=success`,
      cancelUrl: `${siteUrl}/dashboard?payment=cancel`,
      customerEmail: undefined,
    })

    console.log(`[Reports Generate] Created Stripe session ${session.id} for chart ${chart_id}`)

    // Create job with Stripe metadata
    await supabaseService
      .from('jobs')
      .insert([{ 
        user_id: null, 
        chart_id, 
        job_type: 'deep_report', 
        status: 'pending', 
        result_url: null,
        metadata: { 
          stripe_checkout_session_id: session.id,
          purchase_type: 'deep_report',
          chart_id,
          payment_confirmed: false
        }
      }])
        
    res.json({ ok: true, url: session.url! })
  } catch (err: any) {
    console.error('[Reports Generate] Unexpected error:', err)
    
    // Handle Stripe-specific error codes
    let errorMessage = err.message || 'An unexpected error occurred while creating payment checkout'
    
    if (err.type === 'StripeInvalidRequestError') {
      errorMessage = 'Invalid payment parameters. Please try again.'
    } else if (err.type === 'StripeAuthenticationError') {
      errorMessage = 'Payment service authentication failed. Please contact support.'
    } else if (err.type === 'StripeRateLimitError') {
      errorMessage = 'Too many requests. Please try again in a moment.'
    }
    
    return res.status(500).json({ 
      ok: false, 
      message: errorMessage
    })
  }
}
