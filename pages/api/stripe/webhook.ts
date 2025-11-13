import type { NextApiRequest, NextApiResponse } from 'next'
import { buffer } from 'stream/consumers'
import Stripe from 'stripe'
import { supabaseService } from '../../../lib/supabase'
import { stripeHelpers } from '../../../lib/stripe'
import { createOrUpdateSubscription } from '../../../lib/subscription'

// Guard: Check for required environment variables
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn('[Stripe Webhook] STRIPE_WEBHOOK_SECRET environment variable is not configured. Webhook signature verification will be skipped in development.')
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

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
      console.error('[Stripe Webhook] Missing stripe-signature header')
      return res.status(400).json({ error: 'Missing stripe-signature header' })
    }

    // Verify webhook signature
    if (webhookSecret) {
      try {
        event = stripeHelpers.verifyWebhookSignature(
          rawBody,
          signature as string,
          webhookSecret
        )
      } catch (err: any) {
        console.error('[Stripe Webhook] Signature verification failed:', err.message)
        return res.status(401).json({ error: 'Webhook signature verification failed' })
      }
    } else {
      // Development mode: parse body without verification
      event = JSON.parse(rawBody.toString()) as Stripe.Event
      console.warn('[Stripe Webhook] Processing webhook without signature verification (development mode)')
    }

    // Log the event
    console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`)

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event)
        break

      default:
        console.log(`[Stripe Webhook] Event ${event.id}: Unhandled event type ${event.type}`)
    }

    return res.status(200).json({ received: true })

  } catch (err: any) {
    console.error('[Stripe Webhook] Unexpected error:', err)
    return res.status(500).json({ error: `Webhook error: ${err.message || 'Unknown error'}` })
  }
}

/**
 * Handle checkout.session.completed event
 * This is fired when a customer successfully completes a checkout
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session

  console.log(`[Stripe Webhook] Event ${event.id}: Processing checkout.session.completed for session ${session.id}`)

  // Extract metadata
  const userId = session.metadata?.user_id
  const planId = session.metadata?.plan_id
  const billingCycle = session.metadata?.billing_cycle
  const purchaseType = session.metadata?.purchase_type

  // Handle lamp purchase
  if (planId === 'lamp') {
    await handleLampPurchase(event, session)
    return
  }

  // Handle deep report purchase
  if (planId === 'deep_report') {
    await handleDeepReportPurchase(event, session)
    return
  }

  // Handle subscription purchase
  if (!userId || !planId || purchaseType !== 'subscription') {
    console.error(`[Stripe Webhook] Event ${event.id}: Missing required metadata for subscription`, session.metadata)
    return
  }

  // Check if we've already processed this event
  const { data: existingSubscription, error: searchError } = await supabaseService
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (searchError) {
    console.error(`[Stripe Webhook] Event ${event.id}: Error searching for subscription:`, searchError)
    return
  }

  // Check if we've already processed this exact webhook event (idempotency)
  if (existingSubscription?.metadata?.last_webhook_event_id === event.id) {
    console.log(`[Stripe Webhook] Event ${event.id}: Already processed for user ${userId}, returning success`)
    return
  }

  // Create or update subscription
  const subscription = await createOrUpdateSubscription(
    userId,
    planId as any,
    session.id,
    'stripe'
  )

  if (!subscription) {
    console.error(`[Stripe Webhook] Event ${event.id}: Failed to create/update subscription for user ${userId}`)
    return
  }

  // Update subscription with Stripe-specific data
  const updateData: any = {
    stripe_customer_id: session.customer as string,
    external_payment_id: session.payment_intent as string,
    metadata: {
      ...(existingSubscription?.metadata || {}),
      last_webhook_event_id: event.id,
      checkout_session_id: session.id,
      billing_cycle: billingCycle,
      payment_confirmed_at: new Date().toISOString(),
      payment_status: session.payment_status,
    },
  }

  // If this is a recurring subscription (not one-time payment), store subscription ID
  if (session.subscription) {
    updateData.stripe_subscription_id = session.subscription as string
    updateData.external_subscription_id = session.subscription as string
  }

  const { error: updateError } = await supabaseService
    .from('user_subscriptions')
    .update(updateData)
    .eq('id', subscription.id)

  if (updateError) {
    console.error(`[Stripe Webhook] Event ${event.id}: Error updating subscription metadata:`, updateError)
    return
  }

  console.log(`[Stripe Webhook] Event ${event.id}: Successfully activated subscription for user ${userId}`)
}

/**
 * Handle customer.subscription.updated event
 * This is fired when a subscription is updated (e.g., plan change, payment method update)
 */
async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription

  console.log(`[Stripe Webhook] Event ${event.id}: Processing subscription.updated for subscription ${subscription.id}`)

  // Find the user subscription by Stripe subscription ID
  const { data: userSubscription, error: searchError } = await supabaseService
    .from('user_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (searchError || !userSubscription) {
    console.error(`[Stripe Webhook] Event ${event.id}: Subscription ${subscription.id} not found in database`)
    return
  }

  // Update subscription status based on Stripe status
  let status: 'active' | 'past_due' | 'canceled' | 'expired' = 'active'
  if (subscription.status === 'past_due') {
    status = 'past_due'
  } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    status = 'canceled'
  } else if (subscription.status === 'incomplete_expired') {
    status = 'expired'
  }

  const { error: updateError } = await supabaseService
    .from('user_subscriptions')
    .update({
      status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      metadata: {
        ...(userSubscription.metadata || {}),
        last_webhook_event_id: event.id,
        stripe_status: subscription.status,
      },
    })
    .eq('id', userSubscription.id)

  if (updateError) {
    console.error(`[Stripe Webhook] Event ${event.id}: Error updating subscription:`, updateError)
    return
  }

  console.log(`[Stripe Webhook] Event ${event.id}: Successfully updated subscription ${subscription.id}`)
}

/**
 * Handle customer.subscription.deleted event
 * This is fired when a subscription is canceled or expires
 */
async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription

  console.log(`[Stripe Webhook] Event ${event.id}: Processing subscription.deleted for subscription ${subscription.id}`)

  // Find the user subscription by Stripe subscription ID
  const { data: userSubscription, error: searchError } = await supabaseService
    .from('user_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (searchError || !userSubscription) {
    console.error(`[Stripe Webhook] Event ${event.id}: Subscription ${subscription.id} not found in database`)
    return
  }

  // Mark subscription as canceled
  const { error: updateError } = await supabaseService
    .from('user_subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      metadata: {
        ...(userSubscription.metadata || {}),
        last_webhook_event_id: event.id,
        stripe_status: 'canceled',
      },
    })
    .eq('id', userSubscription.id)

  if (updateError) {
    console.error(`[Stripe Webhook] Event ${event.id}: Error canceling subscription:`, updateError)
    return
  }

  console.log(`[Stripe Webhook] Event ${event.id}: Successfully canceled subscription ${subscription.id}`)
}

/**
 * Handle invoice.payment_failed event
 * This is fired when a payment attempt fails
 */
async function handlePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice

  console.log(`[Stripe Webhook] Event ${event.id}: Processing payment_failed for invoice ${invoice.id}`)

  if (!invoice.subscription) {
    console.log(`[Stripe Webhook] Event ${event.id}: Invoice has no subscription, skipping`)
    return
  }

  // Find the user subscription by Stripe subscription ID
  const { data: userSubscription, error: searchError } = await supabaseService
    .from('user_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', invoice.subscription as string)
    .maybeSingle()

  if (searchError || !userSubscription) {
    console.error(`[Stripe Webhook] Event ${event.id}: Subscription ${invoice.subscription} not found in database`)
    return
  }

  // Mark subscription as past_due
  const { error: updateError } = await supabaseService
    .from('user_subscriptions')
    .update({
      status: 'past_due',
      metadata: {
        ...(userSubscription.metadata || {}),
        last_webhook_event_id: event.id,
        last_payment_failed_at: new Date().toISOString(),
        failed_invoice_id: invoice.id,
      },
    })
    .eq('id', userSubscription.id)

  if (updateError) {
    console.error(`[Stripe Webhook] Event ${event.id}: Error updating subscription status:`, updateError)
    return
  }

  console.log(`[Stripe Webhook] Event ${event.id}: Marked subscription ${invoice.subscription} as past_due`)
}

/**
 * Handle lamp purchase
 * This is called when a lamp is purchased through Stripe
 */
async function handleLampPurchase(event: Stripe.Event, session: Stripe.Checkout.Session) {
  console.log(`[Stripe Webhook] Event ${event.id}: Processing lamp purchase for session ${session.id}`)

  // Find the lamp by checkout session ID
  const { data: lamp, error: searchError } = await supabaseService
    .from('lamps')
    .select('*')
    .eq('checkout_session_id', session.id)
    .maybeSingle()

  if (searchError || !lamp) {
    console.error(`[Stripe Webhook] Event ${event.id}: Lamp not found for session ${session.id}`)
    return
  }

  // Check if already processed (idempotency)
  if (lamp.last_webhook_event_id === event.id) {
    console.log(`[Stripe Webhook] Event ${event.id}: Already processed for lamp ${lamp.lamp_key}`)
    return
  }

  // Check if already lit
  if (lamp.status === 'lit') {
    console.log(`[Stripe Webhook] Event ${event.id}: Lamp ${lamp.lamp_key} is already lit`)
    return
  }

  // Update lamp to lit status
  const { error: updateError } = await supabaseService
    .from('lamps')
    .update({
      status: 'lit',
      last_webhook_event_id: event.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', lamp.id)

  if (updateError) {
    console.error(`[Stripe Webhook] Event ${event.id}: Error updating lamp ${lamp.lamp_key}:`, updateError)
    return
  }

  console.log(`[Stripe Webhook] Event ${event.id}: Successfully lit lamp ${lamp.lamp_key}`)
}

/**
 * Handle deep report purchase
 * This is called when a deep report is purchased through Stripe
 */
async function handleDeepReportPurchase(event: Stripe.Event, session: Stripe.Checkout.Session) {
  console.log(`[Stripe Webhook] Event ${event.id}: Processing deep report purchase for session ${session.id}`)

  // Find the job by checkout session ID in metadata
  const { data: job, error: searchError } = await supabaseService
    .from('jobs')
    .select('*')
    .eq('metadata->>stripe_checkout_session_id', session.id)
    .maybeSingle()

  if (searchError || !job) {
    console.error(`[Stripe Webhook] Event ${event.id}: Job not found for session ${session.id}`)
    return
  }

  // Check if already processed (idempotency)
  if (job.metadata?.last_webhook_event_id === event.id) {
    console.log(`[Stripe Webhook] Event ${event.id}: Already processed for job ${job.id}`)
    return
  }

  // Update job to mark payment as confirmed
  const { error: updateError } = await supabaseService
    .from('jobs')
    .update({
      status: 'pending',
      metadata: {
        ...job.metadata,
        payment_confirmed: true,
        last_webhook_event_id: event.id,
        payment_confirmed_at: new Date().toISOString(),
        stripe_payment_intent: session.payment_intent as string
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', job.id)

  if (updateError) {
    console.error(`[Stripe Webhook] Event ${event.id}: Error updating job ${job.id}:`, updateError)
    return
  }

  console.log(`[Stripe Webhook] Event ${event.id}: Successfully confirmed payment for deep report job ${job.id}`)
}
