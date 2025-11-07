import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { razorpayHelpers } from '../../../lib/razorpay'
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

interface RazorpayWebhookEvent {
  event: string
  payload: {
    payment_link: {
      entity: {
        id: string
        amount: number
        currency: string
        status: string
        reference_id?: string
        notes?: Record<string, string>
        payments?: Array<{
          entity: {
            id: string
            amount: number
            currency: string
            status: string
            method: string
            created_at: number
          }
        }>
      }
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let event: RazorpayWebhookEvent

  try {
    // Get raw body as buffer
    const rawBody = await buffer(req)
    const signature = req.headers['x-razorpay-signature']

    if (!signature) {
      console.error('[Razorpay Webhook] Missing x-razorpay-signature header')
      return res.status(400).json({ error: 'Missing x-razorpay-signature header' })
    }

    if (typeof signature !== 'string') {
      console.error('[Razorpay Webhook] Invalid signature format')
      return res.status(400).json({ error: 'Invalid signature format' })
    }

    // Verify webhook signature
    const isValid = razorpayHelpers.verifyWebhookSignature(
      rawBody.toString(),
      signature,
      webhookSecret
    )

    if (!isValid) {
      console.error('[Razorpay Webhook] Signature verification failed')
      return res.status(400).json({ error: 'Webhook signature verification failed' })
    }

    // Parse the event
    event = JSON.parse(rawBody.toString())

    // Log the event
    console.log(`[Razorpay Webhook] Received event: ${event.event}`)

    // Handle payment_link.paid event
    if (event.event === 'payment_link.paid') {
      const paymentLink = event.payload.payment_link.entity
      const paymentId = paymentLink.payments?.[0]?.entity.id
      const referenceId = paymentLink.reference_id
      const notes = paymentLink.notes || {}

      const purchaseType = notes.purchase_type
      const lampKey = notes.lamp_key
      const chartId = notes.chart_id

      // Extract lamp_key from notes for lamp purchases
      if (purchaseType === 'lamp_purchase' && lampKey) {
        // Handle lamp purchase
        console.log(`[Razorpay Webhook] Processing lamp purchase for ${lampKey}, payment link ${paymentLink.id}`)

        // Find lamp by payment link ID
        const { data: existingLamp, error: searchError } = await supabaseService
          .from('lamps')
          .select('*')
          .eq('razorpay_payment_link_id', paymentLink.id)
          .maybeSingle()

        if (searchError) {
          console.error(`[Razorpay Webhook] Error searching for lamp with payment link ${paymentLink.id}:`, searchError)
          return res.status(500).json({ error: 'Database error while searching for lamp' })
        }

        if (!existingLamp) {
          console.error(`[Razorpay Webhook] Lamp not found for payment link ${paymentLink.id}`)
          return res.status(404).json({ error: 'Lamp not found' })
        }

        // Check if already lit or already processed this webhook
        if (existingLamp.status === 'lit') {
          console.log(`[Razorpay Webhook] Lamp ${existingLamp.lamp_key} is already lit`)
          return res.status(200).json({ received: true, message: 'Lamp already lit' })
        }

        // Update lamp to lit status and store payment ID
        const updateData: any = {
          status: 'lit',
          updated_at: new Date().toISOString()
        }

        if (paymentId) {
          updateData.razorpay_payment_id = paymentId
        }

        const { error: updateError } = await supabaseService
          .from('lamps')
          .update(updateData)
          .eq('id', existingLamp.id)

        if (updateError) {
          console.error(`[Razorpay Webhook] Error updating lamp ${existingLamp.lamp_key}:`, updateError)
          return res.status(500).json({ error: 'Failed to update lamp status' })
        }

        console.log(`[Razorpay Webhook] Successfully lit lamp ${existingLamp.lamp_key} with payment link ${paymentLink.id}`)
        return res.status(200).json({ received: true })

      } else if (chartId) {
        // Handle report generation
        console.log(`[Razorpay Webhook] Processing payment link ${paymentLink.id} for chart ${chartId}`)

        // Find job by payment link ID
        const { data: existingJob, error: searchError } = await supabaseService
          .from('jobs')
          .select('*')
          .eq('metadata->>razorpay_payment_link_id', paymentLink.id)
          .maybeSingle()

        if (searchError) {
          console.error(`[Razorpay Webhook] Error searching for existing job:`, searchError)
          return res.status(500).json({ error: 'Database error while searching for job' })
        }

        if (existingJob) {
          // Check if we've already processed this exact webhook event
          const lastEventId = existingJob.metadata?.last_razorpay_webhook_event_id
          if (lastEventId === paymentLink.id) {
            console.log(`[Razorpay Webhook] Payment link ${paymentLink.id} already processed, returning success`)
            return res.status(200).json({ received: true, message: 'Payment link already processed' })
          }

          // Job exists, update it to ensure it's pending and mark the event as processed
          console.log(`[Razorpay Webhook] Updating existing job ${existingJob.id} to pending status`)
          
          const { error: updateError } = await supabaseService
            .from('jobs')
            .update({
              status: 'pending',
              metadata: {
                ...existingJob.metadata,
                payment_confirmed: true,
                razorpay_payment_id: paymentId,
                last_razorpay_webhook_event_id: paymentLink.id,
                payment_confirmed_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', existingJob.id)

          if (updateError) {
            console.error(`[Razorpay Webhook] Error updating job ${existingJob.id}:`, updateError)
            return res.status(500).json({ error: 'Failed to update job' })
          }

          console.log(`[Razorpay Webhook] Successfully updated job ${existingJob.id}`)
        } else {
          // Job doesn't exist, create it (edge case: job creation failed in /api/reports/generate)
          console.log(`[Razorpay Webhook] Job not found, creating new job for chart ${chartId}`)

          // Verify chart exists before creating job
          const { data: chart, error: chartError } = await supabaseService
            .from('charts')
            .select('id')
            .eq('id', chartId)
            .maybeSingle()

          if (chartError || !chart) {
            console.error(`[Razorpay Webhook] Chart ${chartId} not found`)
            return res.status(404).json({ error: 'Chart not found' })
          }

          const { error: insertError } = await supabaseService
            .from('jobs')
            .insert({
              user_id: null,
              chartId,
              job_type: 'deep_report',
              status: 'pending',
              result_url: null,
              metadata: {
                razorpay_payment_link_id: paymentLink.id,
                purchase_type: 'deep_report',
                chartId,
                payment_confirmed: true,
                razorpay_payment_id: paymentId,
                last_razorpay_webhook_event_id: paymentLink.id,
                payment_confirmed_at: new Date().toISOString()
              }
            })

          if (insertError) {
            console.error(`[Razorpay Webhook] Error creating job:`, insertError)
            return res.status(500).json({ error: 'Failed to create job' })
          }

          console.log(`[Razorpay Webhook] Successfully created job for chart ${chartId}`)
        }
      } else {
        // Neither lamp purchase nor report generation
        console.error(`[Razorpay Webhook] Unknown payment link type. Missing chart_id and lamp_key/purchase_type in notes`)
        return res.status(400).json({ error: 'Invalid payment link metadata' })
      }

      // Return success response quickly
      return res.status(200).json({ received: true })
    }

    // Handle payment_link.partially_paid event (optional, for future use)
    if (event.event === 'payment_link.partially_paid') {
      console.log(`[Razorpay Webhook] Payment link partially paid: ${event.payload.payment_link.entity.id}`)
      return res.status(200).json({ received: true })
    }

    // For other event types, just acknowledge receipt
    console.log(`[Razorpay Webhook] Event type ${event.event} not handled, acknowledging`)
    return res.status(200).json({ received: true })

  } catch (err: any) {
    console.error('[Razorpay Webhook] Unexpected error:', err)
    return res.status(500).json({ error: `Webhook error: ${err.message || 'Unknown error'}` })
  }
}