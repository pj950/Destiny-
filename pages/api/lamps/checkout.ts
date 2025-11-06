import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import Stripe from 'stripe'

// Guard: Check for required environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not configured. Please set it in your .env.local file.')
}

if (!process.env.NEXT_PUBLIC_SITE_URL) {
  throw new Error('NEXT_PUBLIC_SITE_URL environment variable is not configured. Please set it in your .env.local file.')
}

const stripeApiVersion = (process.env.STRIPE_API_VERSION || '2024-06-20') as Stripe.LatestApiVersion
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { 
  apiVersion: stripeApiVersion 
})

const LAMP_PRICE = 1990 // $19.90 in cents
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
    const { lamp_key }: CheckoutRequest = req.body

    // Validate lamp_key
    if (!lamp_key || typeof lamp_key !== 'string') {
      return res.status(400).json({ error: 'lamp_key is required and must be a string' })
    }

    if (!VALID_LAMP_KEYS.includes(lamp_key)) {
      return res.status(400).json({ error: 'Invalid lamp_key. Must be one of: p1, p2, p3, p4' })
    }

    console.log(`[Lamp Checkout] Creating checkout session for lamp: ${lamp_key}`)

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

    // Check if there's an existing uncompleted checkout session
    if (lamp.checkout_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(lamp.checkout_session_id)
        if (existingSession.status === 'open') {
          console.log(`[Lamp Checkout] Returning existing open session for lamp ${lamp_key}`)
          return res.status(200).json({ url: existingSession.url! })
        }
      } catch (error) {
        console.log(`[Lamp Checkout] Could not retrieve existing session, creating new one for lamp ${lamp_key}`)
      }
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `祈福点灯 - ${lamp_key.toUpperCase()}`,
              description: `点亮祈福灯 ${lamp_key.toUpperCase()}，为您祈求福运安康`,
              images: [`${process.env.NEXT_PUBLIC_SITE_URL}/images/${lamp_key}.jpg`],
            },
            unit_amount: LAMP_PRICE,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/lamps?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/lamps`,
      metadata: {
        lamp_key,
        type: 'lamp_purchase'
      },
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
    })

    console.log(`[Lamp Checkout] Created checkout session ${session.id} for lamp ${lamp_key}`)

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
    return res.status(500).json({ 
      error: error.message || 'An unexpected error occurred while creating checkout session' 
    })
  }
}
