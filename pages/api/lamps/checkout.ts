import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { razorpayHelpers } from '../../../lib/razorpay'
import { getLampsConfig } from '../../../lib/lamps.config'

// Guard: Check for required environment variables
if (!process.env.NEXT_PUBLIC_SITE_URL) {
  throw new Error('NEXT_PUBLIC_SITE_URL environment variable is not configured. Please set it in your .env.local file.')
}

const DEFAULT_LAMP_PRICE = 19.9
const MINOR_UNIT_MULTIPLIER = 100
const PAYMENT_EXPIRY_SECONDS = 30 * 60

const toMinorUnits = (price: number | undefined) => {
  const safePrice = typeof price === 'number' && !Number.isNaN(price) ? price : DEFAULT_LAMP_PRICE
  return Math.round(safePrice * MINOR_UNIT_MULTIPLIER)
}

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

    const availableLamps = getLampsConfig()
    const lampConfig = availableLamps.find((lamp) => lamp.key === lamp_key)

    if (!lampConfig) {
      return res.status(400).json({ error: 'Invalid lamp_key. 请刷新页面后重试。' })
    }

    const amountInMinorUnits = toMinorUnits(lampConfig.price)

    console.log(`[Lamp Checkout] Creating Razorpay payment link for lamp: ${lamp_key} (${lampConfig.name})`)

    // Check lamp availability
    const { data: lamp, error: lampError } = await supabaseService
      .from('lamps')
      .select('id, status, razorpay_payment_link_id, checkout_session_id')
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

    // Check if there's an existing uncompleted Razorpay payment link
    if (lamp.razorpay_payment_link_id) {
      try {
        const existingLink = await razorpayHelpers.fetchPaymentLink(lamp.razorpay_payment_link_id)
        if (existingLink && existingLink.status === 'created') {
          console.log(`[Lamp Checkout] Returning existing payable link for lamp ${lamp_key}`)
          return res.status(200).json({ url: existingLink.short_url! })
        }
      } catch (error) {
        console.log(`[Lamp Checkout] Could not retrieve existing payment link, creating new one for lamp ${lamp_key}`)
      }
    }

    // Create Razorpay payment link
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    const paymentLink = await razorpayHelpers.createPaymentLink({
      amount: amountInMinorUnits,
      currency: 'USD',
      description: `祈福点灯 - ${lampConfig.name}`,
      notes: {
        lamp_key,
        lamp_name: lampConfig.name,
        purchase_type: 'lamp_purchase',
      },
      callback_url: `${siteUrl}/lamps`,
      callback_method: 'get',
      reference_id: lamp.id,
      expire_by: Math.floor(Date.now() / 1000) + PAYMENT_EXPIRY_SECONDS,
    })

    console.log(`[Lamp Checkout] Created payment link ${paymentLink.id} for lamp ${lamp_key}`)

    // Update lamp with payment link ID
    const { error: updateError } = await supabaseService
      .from('lamps')
      .update({
        razorpay_payment_link_id: paymentLink.id,
        updated_at: new Date().toISOString()
      })
      .eq('lamp_key', lamp_key)

    if (updateError) {
      console.error(`[Lamp Checkout] Error updating lamp ${lamp_key} with payment link ID:`, updateError)
      // Don't fail the request, but log the error
    }

    return res.status(200).json({ url: paymentLink.short_url! })

  } catch (error: any) {
    console.error('[Lamp Checkout] Unexpected error:', error)
    
    // Handle Razorpay-specific error codes
    let errorMessage = error.message || 'An unexpected error occurred while creating payment link'
    
    if (error.statusCode === 400) {
      errorMessage = 'Invalid payment parameters. Please try again.'
    } else if (error.statusCode === 401 || error.statusCode === 403) {
      errorMessage = 'Payment service authentication failed. Please contact support.'
    } else if (error.statusCode === 429) {
      errorMessage = 'Too many requests. Please try again in a moment.'
    }
    
    return res.status(500).json({ error: errorMessage })
  }
}
