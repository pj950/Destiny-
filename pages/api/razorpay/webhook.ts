import type { NextApiRequest, NextApiResponse } from 'next'
import { razorpayHelpers } from '@/features/payments/razorpay'

/**
 * POST /api/razorpay/webhook
 * 
 * Handle Razorpay webhook events
 * 
 * NOTE: Razorpay has been replaced by Stripe as the primary payment provider.
 * This endpoint is maintained for backward compatibility and testing purposes.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const signature = req.headers['x-razorpay-signature'] as string
    
    if (!signature) {
      return res.status(400).json({ error: 'Missing signature header' })
    }

    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET not configured')
      return res.status(500).json({ error: 'Webhook secret not configured' })
    }

    const body = JSON.stringify(req.body)
    const isValid = razorpayHelpers.verifyWebhookSignature(body, signature, webhookSecret)

    if (!isValid) {
      console.error('[Razorpay Webhook] Invalid signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // NOTE: Full webhook processing logic has been moved to Stripe.
    // This is a stub implementation for backward compatibility.
    
    console.log('[Razorpay Webhook] Received event (stub):', req.body.event)
    
    return res.status(200).json({ 
      ok: true, 
      message: 'Webhook received (Razorpay integration is deprecated, use Stripe instead)' 
    })
  } catch (error) {
    console.error('[Razorpay Webhook] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
