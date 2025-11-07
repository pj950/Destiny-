import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { razorpayHelpers } from '../../../lib/razorpay'

// Guard: Check for required environment variables
if (!process.env.NEXT_PUBLIC_SITE_URL) {
  throw new Error('NEXT_PUBLIC_SITE_URL environment variable is not configured. Please set it in your .env.local file.')
}

const REPORT_PRICE = 1999 // $19.99 in cents

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
    
    console.log(`[Reports Generate] Creating Razorpay payment link for chart ${chart_id}`)
    
    // Create Razorpay payment link
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    const paymentLink = await razorpayHelpers.createPaymentLink({
      amount: REPORT_PRICE, // Amount in smallest unit (cents for USD)
      currency: 'USD',
      description: 'Deep Destiny Report',
      notes: {
        chart_id,
        purchase_type: 'deep_report',
      },
      callback_url: `${siteUrl}/dashboard`,
      callback_method: 'get',
      reference_id: chart_id,
      expire_by: Math.floor(Date.now() / 1000) + (60 * 60), // 60 minutes
    })

    console.log(`[Reports Generate] Created payment link ${paymentLink.id} for chart ${chart_id}`)

    // Create job with Razorpay metadata
    await supabaseService
      .from('jobs')
      .insert([{ 
        user_id: null, 
        chart_id, 
        job_type: 'deep_report', 
        status: 'pending', 
        result_url: null,
        metadata: { 
          razorpay_payment_link_id: paymentLink.id,
          purchase_type: 'deep_report',
          chart_id,
          payment_confirmed: false
        }
      }])
        
    res.json({ ok: true, url: paymentLink.short_url! })
  } catch (err: any) {
    console.error('[Reports Generate] Unexpected error:', err)
    
    // Handle Razorpay-specific error codes
    let errorMessage = err.message || 'An unexpected error occurred while creating payment link'
    
    if (err.statusCode === 400) {
      errorMessage = 'Invalid payment parameters. Please try again.'
    } else if (err.statusCode === 401 || err.statusCode === 403) {
      errorMessage = 'Payment service authentication failed. Please contact support.'
    } else if (err.statusCode === 429) {
      errorMessage = 'Too many requests. Please try again in a moment.'
    }
    
    return res.status(500).json({ 
      ok: false, 
      message: errorMessage
    })
  }
}
