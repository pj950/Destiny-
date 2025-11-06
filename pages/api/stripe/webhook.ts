import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import Stripe from 'stripe'
import { buffer } from 'stream/consumers'

// Guard: Check for required environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not configured. Please set it in your .env.local file.')
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not configured. Please set it in your .env.local file.')
}

const stripeApiVersion = (process.env.STRIPE_API_VERSION || '2024-06-20') as Stripe.LatestApiVersion

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { 
  apiVersion: stripeApiVersion 
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Disable body parsing, need raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let event: Stripe.Event

  try {
    // Get raw body as buffer
    const rawBody = await buffer(req)
    const signature = req.headers['stripe-signature']

    if (!signature) {
      console.error('[Webhook] Missing stripe-signature header')
      return res.status(400).json({ error: 'Missing stripe-signature header' })
    }

    // Verify webhook signature
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch (err: any) {
      console.error('[Webhook] Signature verification failed:', err.message)
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` })
    }

    // Log the event
    console.log(`[Webhook] Received event: ${event.type} (${event.id})`)

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      // Check if this is a lamp purchase or report generation
      const purchaseType = session.metadata?.type
      const lamp_key = session.metadata?.lamp_key
      const chart_id = session.metadata?.chart_id

      if (purchaseType === 'lamp_purchase' && lamp_key) {
        // Handle lamp purchase
        console.log(`[Webhook] Event ${event.id}: Processing lamp purchase for ${lamp_key}, session ${session.id}`)

        // Check if we've already processed this event for this lamp
        const { data: existingLamp, error: searchError } = await supabaseService
          .from('lamps')
          .select('*')
          .eq('lamp_key', lamp_key)
          .maybeSingle()

        if (searchError) {
          console.error(`[Webhook] Event ${event.id}: Error searching for lamp ${lamp_key}:`, searchError)
          return res.status(500).json({ error: 'Database error while searching for lamp' })
        }

        if (!existingLamp) {
          console.error(`[Webhook] Event ${event.id}: Lamp ${lamp_key} not found`)
          return res.status(404).json({ error: 'Lamp not found' })
        }

        // Check if already lit or already processed this webhook
        if (existingLamp.status === 'lit') {
          console.log(`[Webhook] Event ${event.id}: Lamp ${lamp_key} is already lit`)
          return res.status(200).json({ received: true, message: 'Lamp already lit' })
        }

        // Update lamp to lit status
        const { error: updateError } = await supabaseService
          .from('lamps')
          .update({
            status: 'lit',
            updated_at: new Date().toISOString()
          })
          .eq('lamp_key', lamp_key)

        if (updateError) {
          console.error(`[Webhook] Event ${event.id}: Error updating lamp ${lamp_key}:`, updateError)
          return res.status(500).json({ error: 'Failed to update lamp status' })
        }

        console.log(`[Webhook] Event ${event.id}: Successfully lit lamp ${lamp_key}`)
        return res.status(200).json({ received: true })

      } else if (chart_id) {
        // Handle report generation (existing logic)
        console.log(`[Webhook] Event ${event.id}: Processing checkout session ${session.id} for chart ${chart_id}`)

        // Check if we've already processed this event (idempotency check)
        const { data: existingJob, error: searchError } = await supabaseService
          .from('jobs')
          .select('*')
          .eq('chart_id', chart_id)
          .eq('metadata->>checkout_session_id', session.id)
          .maybeSingle()

        if (searchError) {
          console.error(`[Webhook] Event ${event.id}: Error searching for existing job:`, searchError)
          return res.status(500).json({ error: 'Database error while searching for job' })
        }

        if (existingJob) {
          // Check if we've already processed this exact webhook event
          const lastEventId = existingJob.metadata?.last_webhook_event_id
          if (lastEventId === event.id) {
            console.log(`[Webhook] Event ${event.id}: Already processed, returning success`)
            return res.status(200).json({ received: true, message: 'Event already processed' })
          }

          // Job exists, update it to ensure it's pending and mark the event as processed
          console.log(`[Webhook] Event ${event.id}: Updating existing job ${existingJob.id} to pending status`)
          
          const { error: updateError } = await supabaseService
            .from('jobs')
            .update({
              status: 'pending',
              metadata: {
                ...existingJob.metadata,
                payment_confirmed: true,
                last_webhook_event_id: event.id,
                payment_confirmed_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', existingJob.id)

          if (updateError) {
            console.error(`[Webhook] Event ${event.id}: Error updating job ${existingJob.id}:`, updateError)
            return res.status(500).json({ error: 'Failed to update job' })
          }

          console.log(`[Webhook] Event ${event.id}: Successfully updated job ${existingJob.id}`)
        } else {
          // Job doesn't exist, create it (edge case: job creation failed in /api/reports/generate)
          console.log(`[Webhook] Event ${event.id}: Job not found, creating new job for chart ${chart_id}`)

          // Verify chart exists before creating job
          const { data: chart, error: chartError } = await supabaseService
            .from('charts')
            .select('id')
            .eq('id', chart_id)
            .maybeSingle()

          if (chartError || !chart) {
            console.error(`[Webhook] Event ${event.id}: Chart ${chart_id} not found`)
            return res.status(404).json({ error: 'Chart not found' })
          }

          const { error: insertError } = await supabaseService
            .from('jobs')
            .insert({
              user_id: null,
              chart_id,
              job_type: 'deep_report',
              status: 'pending',
              result_url: null,
              metadata: {
                checkout_session_id: session.id,
                payment_confirmed: true,
                last_webhook_event_id: event.id,
                payment_confirmed_at: new Date().toISOString()
              }
            })

          if (insertError) {
            console.error(`[Webhook] Event ${event.id}: Error creating job:`, insertError)
            return res.status(500).json({ error: 'Failed to create job' })
          }

          console.log(`[Webhook] Event ${event.id}: Successfully created job for chart ${chart_id}`)
        }
      } else {
        // Neither lamp purchase nor report generation
        console.error(`[Webhook] Event ${event.id}: Unknown checkout session type. Missing chart_id and lamp_key/type metadata`)
        return res.status(400).json({ error: 'Invalid checkout session metadata' })
      }

      // Return success response quickly
      return res.status(200).json({ received: true })
    }

    // For other event types, just acknowledge receipt
    console.log(`[Webhook] Event ${event.id}: Event type ${event.type} not handled, acknowledging`)
    return res.status(200).json({ received: true })

  } catch (err: any) {
    console.error('[Webhook] Unexpected error:', err)
    return res.status(500).json({ error: `Webhook error: ${err.message || 'Unknown error'}` })
  }
}
