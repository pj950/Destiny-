import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'

interface ConfirmRequest {
  razorpay_payment_link_id?: string
  razorpay_payment_id?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean } | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { razorpay_payment_link_id, razorpay_payment_id }: ConfirmRequest = req.body

    // At least one of the payment identifiers is required
    if (!razorpay_payment_link_id && !razorpay_payment_id) {
      return res.status(400).json({ error: 'razorpay_payment_link_id or razorpay_payment_id is required' })
    }

    console.log('[Lamp Confirm] Confirming payment with link ID:', razorpay_payment_link_id)

    // Find lamp by payment link ID
    let query = supabaseService.from('lamps').select('id, lamp_key, status')
    
    if (razorpay_payment_link_id) {
      query = query.eq('razorpay_payment_link_id', razorpay_payment_link_id)
    }
    
    const { data: lamp, error: lampError } = await query.single()

    if (lampError || !lamp) {
      console.error('[Lamp Confirm] Lamp not found by payment link ID:', lampError)
      return res.status(404).json({ error: 'Payment not found or already processed' })
    }

    console.log(`[Lamp Confirm] Found lamp ${lamp.lamp_key} for payment`)

    if (lamp.status === 'lit') {
      console.log(`[Lamp Confirm] Lamp ${lamp.lamp_key} is already lit`)
      return res.status(200).json({ success: true })
    }

    // Mark lamp as lit
    const { error: updateError } = await supabaseService
      .from('lamps')
      .update({
        status: 'lit',
        razorpay_payment_id: razorpay_payment_id || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', lamp.id)

    if (updateError) {
      console.error(`[Lamp Confirm] Error updating lamp ${lamp.lamp_key}:`, updateError)
      return res.status(500).json({ error: 'Failed to confirm lamp payment' })
    }

    console.log(`[Lamp Confirm] Successfully marked lamp ${lamp.lamp_key} as lit`)
    return res.status(200).json({ success: true })

  } catch (error: any) {
    console.error('[Lamp Confirm] Unexpected error:', error)
    return res.status(500).json({ 
      error: error.message || 'An unexpected error occurred while confirming payment' 
    })
  }
}
