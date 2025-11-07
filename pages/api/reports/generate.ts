import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
// import Stripe from 'stripe' // TODO: Migrate to Razorpay in follow-up ticket

// TODO: Replace with Razorpay implementation in follow-up ticket
// Guard: Check for required environment variables
// if (!process.env.STRIPE_SECRET_KEY) {
//   throw new Error('STRIPE_SECRET_KEY environment variable is not configured. Please set it in your .env.local file.')
// }

// const stripeApiVersion = (process.env.STRIPE_API_VERSION || '2024-06-20') as Stripe.LatestApiVersion

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { 
//   apiVersion: stripeApiVersion 
// })

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
    
    // TODO: Replace with Razorpay implementation in follow-up ticket
    // const session = await stripe.checkout.sessions.create({
    //   payment_method_types: ['card'],
    //   mode: 'payment',
    //   line_items: [{ 
    //     price_data: { 
    //       currency: 'usd', 
    //       product_data: { name: 'Deep Destiny Report' }, 
    //       unit_amount: 1999 
    //     }, 
    //     quantity: 1 
    //   }],
    //   success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/chart/${chart_id}`,
    //   metadata: { chart_id }
    // })
    
    // Temporary placeholder for build to succeed
    console.log(`[Reports Generate] TODO: Implement Razorpay payment link creation for chart ${chart_id}`)
    return res.status(501).json({ error: 'Payment integration temporarily disabled during Razorpay migration' })
    
    // TODO: Replace with Razorpay implementation in follow-up ticket
    // await supabaseService
    //   .from('jobs')
    //   .insert([{ 
    //     user_id: null, 
    //     chart_id, 
    //     job_type: 'deep_report', 
    //     status: 'pending', 
    //     result_url: null,
    //     metadata: { checkout_session_id: session.id }
    //   }])
        
    // res.json({ ok: true, url: session.url })
  } catch (err: any) {
    // TODO: Replace with Razorpay error handling in follow-up ticket
    // Better error handling for Stripe errors
    // if (err.type === 'StripeAuthenticationError') {
    //   return res.status(500).json({ 
    //     ok: false, 
    //     message: 'Stripe authentication failed. Please verify your STRIPE_SECRET_KEY is valid.' 
    //   })
    // }
    
    // if (err.type === 'StripeInvalidRequestError') {
    //   return res.status(500).json({ 
    //     ok: false, 
    //     message: `Stripe request error: ${err.message}` 
    //   })
    // }
    
    // if (err.type === 'StripeAPIError' || err.type === 'StripeConnectionError') {
    //   return res.status(500).json({ 
    //     ok: false, 
    //     message: 'Stripe service temporarily unavailable. Please try again later.' 
    //   })
    // }
    
    return res.status(500).json({ 
      ok: false, 
      message: `Payment checkout creation failed: ${err.message || 'Unknown error'}` 
    })
  }
}
