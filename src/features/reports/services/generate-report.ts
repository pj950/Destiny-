import { stripeHelpers } from '@/lib/stripe'
import { supabaseService } from '@/lib/supabase'
import { ReportServiceError } from './errors'

const REPORT_PRICE_ID = process.env.STRIPE_PRICE_DEEP_REPORT || 'price_deep_report'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL

if (!SITE_URL) {
  throw new Error('NEXT_PUBLIC_SITE_URL environment variable is not configured. Please set it in your .env.local file.')
}

export async function createDeepReportCheckout(chartId: string): Promise<{ url: string }> {
  if (!chartId || typeof chartId !== 'string') {
    throw new ReportServiceError(400, 'chart_id is required')
  }

  const { data: chart, error: chartError } = await supabaseService
    .from('charts')
    .select('id, profile_id')
    .eq('id', chartId)
    .single()

  if (chartError || !chart) {
    throw new ReportServiceError(404, 'Chart not found')
  }

  const session = await stripeHelpers.createCheckoutSession({
    priceId: REPORT_PRICE_ID,
    userId: 'anonymous',
    planId: 'deep_report',
    billingCycle: 'monthly',
    successUrl: `${SITE_URL}/dashboard?payment=success`,
    cancelUrl: `${SITE_URL}/dashboard?payment=cancel`,
    customerEmail: undefined,
  })

  const { error: insertError } = await supabaseService
    .from('jobs')
    .insert([
      {
        user_id: null,
        chart_id: chartId,
        job_type: 'deep_report',
        status: 'pending',
        result_url: null,
        metadata: {
          stripe_checkout_session_id: session.id,
          purchase_type: 'deep_report',
          chart_id: chartId,
          payment_confirmed: false,
        },
      },
    ])

  if (insertError) {
    throw new ReportServiceError(500, 'Failed to create deep report job')
  }

  return { url: session.url! }
}
