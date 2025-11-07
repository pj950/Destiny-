import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Stripe webhook has been retired in favor of Razorpay
  // Return 410 Gone to indicate this endpoint is no longer available
  console.log('[Stripe Webhook] Stripe webhook endpoint retired - migrated to Razorpay')
  
  return res.status(410).json({ 
    error: 'Stripe webhook endpoint has been retired',
    message: 'Payment processing has been migrated to Razorpay. Please update your webhook configuration to use /api/razorpay/webhook instead.',
    documentation: 'See deployment documentation for new webhook URL and secret requirements'
  })
}
