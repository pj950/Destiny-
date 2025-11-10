import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { razorpayHelpers } from '../../../lib/razorpay'
import { createOrUpdateSubscription } from '../../../lib/subscription'
import { buffer } from 'stream/consumers'

// Guard: Check for required environment variables
if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
  throw new Error('RAZORPAY_WEBHOOK_SECRET environment variable is not configured. Please set it in your .env.local file.')
}

const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

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

  let event: any

  try {
    // Get raw body as buffer
    const rawBody = await buffer(req)
    const signature = req.headers['x-razorpay-signature']

    if (!signature) {
      console.error('[Razorpay Webhook] Missing x-razorpay-signature header')
      return res.status(400).json({ error: 'Missing x-razorpay-signature header' })
    }

    // Verify webhook signature
    const isValid = razorpayHelpers.verifyWebhookSignature(
      rawBody.toString(),
      signature as string,
      webhookSecret
    )

    if (!isValid) {
      console.error('[Razorpay Webhook] Signature verification failed')
      return res.status(401).json({ error: 'Webhook signature verification failed' })
    }

    // Parse the webhook body
    event = JSON.parse(rawBody.toString())

    // Log the event
    console.log(`[Razorpay Webhook] Received event: ${event.event} (${event.id})`)

    // Handle payment link paid event
    if (event.event === 'payment_link.paid') {
      const paymentLink = event.payload.payment_link.entity
      const payment = event.payload.payment.entity

      // Extract metadata from notes and reference_id
      const purchaseType = paymentLink.notes?.purchase_type
      const lamp_key = paymentLink.notes?.lamp_key
      const chart_id = paymentLink.notes?.chart_id || paymentLink.reference_id
      const plan_id = paymentLink.notes?.plan_id
      const user_id = paymentLink.notes?.user_id
      const billing_cycle = paymentLink.notes?.billing_cycle

      if (purchaseType === 'subscription' && user_id && plan_id) {
        // Handle subscription purchase
        console.log(`[Razorpay Webhook] Event ${event.id}: Processing subscription payment for user ${user_id}, plan ${plan_id}`)

        // Check if we've already processed this event for this user
        const { data: existingSubscription, error: searchError } = await supabaseService
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', user_id)
          .eq('status', 'active')
          .maybeSingle()

        if (searchError) {
          console.error(`[Razorpay Webhook] Event ${event.id}: Error searching for subscription:`, searchError)
          return res.status(500).json({ error: 'Database error while searching for subscription' })
        }

        // Check if we've already processed this exact webhook event
        if (existingSubscription?.metadata?.last_webhook_event_id === event.id) {
          console.log(`[Razorpay Webhook] Event ${event.id}: Already processed for user ${user_id}, returning success`)
          return res.status(200).json({ received: true, message: 'Event already processed' })
        }

        // Create or update subscription
        const subscription = await createOrUpdateSubscription(
          user_id,
          plan_id as any,
          `razorpay_${payment?.id}`,
          'razorpay'
        )

        if (!subscription) {
          console.error(`[Razorpay Webhook] Event ${event.id}: Failed to create/update subscription for user ${user_id}`)
          return res.status(500).json({ error: 'Failed to create subscription' })
        }

        // Update subscription metadata with webhook event ID
        const { error: updateError } = await supabaseService
          .from('user_subscriptions')
          .update({
            metadata: {
              ...(existingSubscription?.metadata || {}),
              last_webhook_event_id: event.id,
              payment_link_id: paymentLink.id,
              razorpay_payment_id: payment?.id,
              billing_cycle,
              payment_confirmed_at: new Date().toISOString(),
            },
          })
          .eq('id', subscription.id)

        if (updateError) {
          console.error(`[Razorpay Webhook] Event ${event.id}: Error updating subscription metadata:`, updateError)
          // Don't fail the whole webhook, just log
        }

        console.log(`[Razorpay Webhook] Event ${event.id}: Successfully activated subscription for user ${user_id}`)
        return res.status(200).json({ received: true })

      } else if (purchaseType === 'lamp_purchase' && lamp_key) {
        // Handle lamp purchase
        console.log(`[Razorpay Webhook] Event ${event.id}: Processing lamp purchase for ${lamp_key}, payment link ${paymentLink.id}`)

        // Check if we've already processed this event for this lamp
        const { data: existingLamp, error: searchError } = await supabaseService
          .from('lamps')
          .select('*')
          .eq('lamp_key', lamp_key)
          .maybeSingle()

        if (searchError) {
          console.error(`[Razorpay Webhook] Event ${event.id}: Error searching for lamp ${lamp_key}:`, searchError)
          return res.status(500).json({ error: 'Database error while searching for lamp' })
        }

        if (!existingLamp) {
          console.error(`[Razorpay Webhook] Event ${event.id}: Lamp ${lamp_key} not found`)
          return res.status(200).json({ received: true, message: 'Lamp not found' })
        }

        // Check if we've already processed this exact webhook event (idempotency using event ID)
        if (existingLamp.last_webhook_event_id === event.id) {
          console.log(`[Razorpay Webhook] Event ${event.id}: Already processed for lamp ${lamp_key}, returning success`)
          return res.status(200).json({ received: true, message: 'Event already processed' })
        }

        // Check if already lit
        if (existingLamp.status === 'lit') {
          // Enhanced idempotency: verify payment ID matches to prevent duplicate processing
          if (existingLamp.razorpay_payment_id && payment?.id && existingLamp.razorpay_payment_id !== payment.id) {
            console.log(`[Razorpay Webhook] Event ${event.id}: Lamp ${lamp_key} is lit but payment ID differs (existing: ${existingLamp.razorpay_payment_id}, new: ${payment.id})`)
          }
          console.log(`[Razorpay Webhook] Event ${event.id}: Lamp ${lamp_key} is already lit`)
          return res.status(200).json({ received: true, message: 'Lamp already lit' })
        }

        // Update lamp to lit status with payment ID and webhook event ID (handle undefined paymentId gracefully)
        const { error: updateError } = await supabaseService
          .from('lamps')
          .update({
            status: 'lit',
            razorpay_payment_id: payment?.id || null,
            last_webhook_event_id: event.id,
            updated_at: new Date().toISOString()
          })
          .eq('lamp_key', lamp_key)

        if (updateError) {
          console.error(`[Razorpay Webhook] Event ${event.id}: Error updating lamp ${lamp_key}:`, updateError)
          return res.status(500).json({ error: 'Failed to update lamp status' })
        }

        console.log(`[Razorpay Webhook] Event ${event.id}: Successfully lit lamp ${lamp_key}`)
        return res.status(200).json({ received: true })

      } else if (chart_id && purchaseType === 'deep_report') {
        // Handle report generation
        console.log(`[Razorpay Webhook] Event ${event.id}: Processing payment link ${paymentLink.id} for chart ${chart_id}`)

        // Find the job associated with this payment link
        const { data: existingJob, error: searchError } = await supabaseService
          .from('jobs')
          .select('*')
          .eq('chart_id', chart_id)
          .eq('metadata->>razorpay_payment_link_id', paymentLink.id)
          .maybeSingle()

        if (searchError) {
          console.error(`[Razorpay Webhook] Event ${event.id}: Error searching for existing job:`, searchError)
          return res.status(500).json({ error: 'Database error while searching for job' })
        }

        if (existingJob) {
          // Check if we've already processed this exact webhook event (idempotency using event ID)
          const lastEventId = existingJob.metadata?.last_webhook_event_id
          if (lastEventId === event.id) {
            console.log(`[Razorpay Webhook] Event ${event.id}: Already processed, returning success`)
            return res.status(200).json({ received: true, message: 'Event already processed' })
          }

          // Job exists, update it to ensure it's pending and mark the event as processed
          console.log(`[Razorpay Webhook] Event ${event.id}: Updating existing job ${existingJob.id} to pending status`)
          
          const { error: updateError } = await supabaseService
            .from('jobs')
            .update({
              status: 'pending',
              metadata: {
                ...existingJob.metadata,
                payment_confirmed: true,
                last_webhook_event_id: event.id,
                payment_confirmed_at: new Date().toISOString(),
                razorpay_payment_id: payment?.id || null
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', existingJob.id)

          if (updateError) {
            console.error(`[Razorpay Webhook] Event ${event.id}: Error updating job ${existingJob.id}:`, updateError)
            return res.status(500).json({ error: 'Failed to update job' })
          }

          console.log(`[Razorpay Webhook] Event ${event.id}: Successfully updated job ${existingJob.id}`)
        } else {
          // Job doesn't exist, create it (edge case: job creation failed in /api/reports/generate)
          console.log(`[Razorpay Webhook] Event ${event.id}: Job not found, creating new job for chart ${chart_id}`)

          // Verify chart exists before creating job
          const { data: chart, error: chartError } = await supabaseService
            .from('charts')
            .select('id')
            .eq('id', chart_id)
            .maybeSingle()

          if (chartError || !chart) {
            console.error(`[Razorpay Webhook] Event ${event.id}: Chart ${chart_id} not found`)
            return res.status(200).json({ received: true, message: 'Chart not found' })
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
                razorpay_payment_link_id: paymentLink.id,
                purchase_type: 'deep_report',
                chart_id,
                payment_confirmed: true,
                last_webhook_event_id: event.id,
                payment_confirmed_at: new Date().toISOString(),
                razorpay_payment_id: payment?.id || null
              }
            })

          if (insertError) {
            console.error(`[Razorpay Webhook] Event ${event.id}: Error creating job:`, insertError)
            return res.status(500).json({ error: 'Failed to create job' })
          }

          console.log(`[Razorpay Webhook] Event ${event.id}: Successfully created job for chart ${chart_id}`)
        }
      } else {
        // Neither lamp purchase nor report generation
        console.error(`[Razorpay Webhook] Event ${event.id}: Unknown payment link type. Missing chart_id and lamp_key/purchase_type in notes`)
        return res.status(400).json({ error: 'Invalid payment link metadata' })
      }

      // Return success response quickly
      return res.status(200).json({ received: true })
    }

    // For other event types, just acknowledge receipt
    console.log(`[Razorpay Webhook] Event ${event.id}: Event type ${event.event} not handled, acknowledging`)
    return res.status(200).json({ received: true })

  } catch (err: any) {
    console.error('[Razorpay Webhook] Unexpected error:', err)
    return res.status(500).json({ error: `Webhook error: ${err.message || 'Unknown error'}` })
  }
}