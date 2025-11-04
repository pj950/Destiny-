import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import Stripe from 'stripe'

const stripeApiVersion = (process.env.STRIPE_API_VERSION || '2024-06-20') as Stripe.LatestApiVersion

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { 
  apiVersion: stripeApiVersion 
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  
  const { chart_id } = req.body
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ 
        price_data: { 
          currency: 'usd', 
          product_data: { name: 'Deep Destiny Report' }, 
          unit_amount: 1999 
        }, 
        quantity: 1 
      }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/chart/${chart_id}`,
      metadata: { chart_id }
    })
    
    await supabaseService
      .from('jobs')
      .insert([{ 
        user_id: null, 
        chart_id, 
        job_type: 'deep_report', 
        status: 'pending', 
        result_url: null 
      }])
      
    res.json({ ok: true, url: session.url })
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message })
  }
}
