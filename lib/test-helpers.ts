/**
 * Test helpers and fixtures for Razorpay payment tests
 */

export const RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret-12345'

/**
 * Sample Razorpay payment link for lamp purchases
 */
export const mockPaymentLinkLamp = {
  accept_partial: false,
  amount: 1990,
  amount_paid: 0,
  cancelled_at: null,
  created_at: 1699276800,
  currency: 'USD',
  customer: {},
  description: '祈福点灯 - P1',
  expire_by: 1699278600,
  expired_at: null,
  first_min_partial_amount: null,
  id: 'plink_test_lamp_123',
  notify: { email: true, sms: true },
  notes: {
    lamp_key: 'p1',
    purchase_type: 'lamp_purchase',
  },
  notified_at: null,
  payments: null,
  reference_id: 'lamp-id-123',
  reminders: false,
  reminder_enable: false,
  short_url: 'https://rzp.io/l/test_lamp_123',
  status: 'created',
  updated_at: 1699276800,
  upi_link: false,
  user_id: null,
}

/**
 * Sample Razorpay payment link for report purchases
 */
export const mockPaymentLinkReport = {
  accept_partial: false,
  amount: 1999,
  amount_paid: 0,
  cancelled_at: null,
  created_at: 1699276800,
  currency: 'USD',
  customer: {},
  description: 'Deep Destiny Report',
  expire_by: 1699280400,
  expired_at: null,
  first_min_partial_amount: null,
  id: 'plink_test_report_456',
  notify: { email: true, sms: true },
  notes: {
    chart_id: 'chart-id-456',
    purchase_type: 'deep_report',
  },
  notified_at: null,
  payments: null,
  reference_id: 'chart-id-456',
  reminders: false,
  reminder_enable: false,
  short_url: 'https://rzp.io/l/test_report_456',
  status: 'created',
  updated_at: 1699276800,
  upi_link: false,
  user_id: null,
}

/**
 * Sample Razorpay payment for webhook
 */
export const mockRazorpayPayment = {
  id: 'pay_test_123',
  entity: 'payment',
  amount: 1990,
  currency: 'USD',
  status: 'captured',
  method: 'upi',
  description: '祈福点灯 - P1',
  amount_refunded: 0,
  refund_status: null,
  captured: true,
  card_id: null,
  bank: null,
  wallet: null,
  vpa: 'user@upi',
  email: 'user@example.com',
  contact: '+919999999999',
  fee: 0,
  tax: 0,
  error_code: null,
  error_description: null,
  error_source: null,
  error_reason: null,
  error_step: null,
  error_field: null,
  acquirer_data: {
    rrn: '123456789012',
  },
  created_at: 1699276800,
}

/**
 * Sample webhook event for lamp purchase
 */
export function createLampWebhookEvent(
  paymentLinkId: string = mockPaymentLinkLamp.id,
  lampKey: string = 'p1',
  paymentId: string = mockRazorpayPayment.id,
  eventId: string = 'evt_test_lamp_001'
) {
  return {
    id: eventId,
    event: 'payment_link.paid',
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      payment_link: {
        entity: {
          id: paymentLinkId,
          amount: 1990,
          currency: 'USD',
          status: 'paid',
          notes: {
            lamp_key: lampKey,
            purchase_type: 'lamp_purchase',
          },
          reference_id: 'lamp-id-123',
          short_url: 'https://rzp.io/l/test_lamp_123',
        },
      },
      payment: {
        entity: {
          id: paymentId,
          status: 'captured',
          amount: 1990,
        },
      },
    },
  }
}

/**
 * Sample webhook event for report purchase
 */
export function createReportWebhookEvent(
  paymentLinkId: string = mockPaymentLinkReport.id,
  chartId: string = 'chart-id-456',
  paymentId: string = mockRazorpayPayment.id,
  eventId: string = 'evt_test_report_001'
) {
  return {
    id: eventId,
    event: 'payment_link.paid',
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      payment_link: {
        entity: {
          id: paymentLinkId,
          amount: 1999,
          currency: 'USD',
          status: 'paid',
          notes: {
            chart_id: chartId,
            purchase_type: 'deep_report',
          },
          reference_id: chartId,
          short_url: 'https://rzp.io/l/test_report_456',
        },
      },
      payment: {
        entity: {
          id: paymentId,
          status: 'captured',
          amount: 1999,
        },
      },
    },
  }
}

/**
 * Sample Lamp database record
 */
export const mockLampRecord = {
  id: 'lamp-id-123',
  lamp_key: 'p1',
  status: 'unlit',
  razorpay_payment_link_id: null,
  razorpay_payment_id: null,
  checkout_session_id: null,
  created_at: '2024-11-06T12:00:00Z',
  updated_at: '2024-11-06T12:00:00Z',
}

/**
 * Sample Chart database record
 */
export const mockChartRecord = {
  id: 'chart-id-456',
  profile_id: 'profile-id-789',
}

/**
 * Sample Job database record
 */
export const mockJobRecord = {
  id: 'job-id-001',
  user_id: null,
  chart_id: 'chart-id-456',
  job_type: 'deep_report',
  status: 'pending',
  result_url: null,
  metadata: {
    razorpay_payment_link_id: 'plink_test_report_456',
    purchase_type: 'deep_report',
    chart_id: 'chart-id-456',
    payment_confirmed: false,
  },
  created_at: '2024-11-06T12:00:00Z',
  updated_at: '2024-11-06T12:00:00Z',
}

/**
 * Generate a valid webhook signature using crypto
 */
export function generateWebhookSignature(
  webhookBody: string,
  webhookSecret: string
): string {
  const crypto = require('crypto')
  return crypto
    .createHmac('sha256', webhookSecret)
    .update(webhookBody)
    .digest('hex')
}

/**
 * Create mock NextApiRequest
 */
export function createMockRequest(options: any = {}) {
  return {
    method: options.method || 'POST',
    headers: options.headers || {
      'content-type': 'application/json',
    },
    body: options.body,
    query: options.query || {},
    ...options,
  }
}

/**
 * Create mock NextApiResponse
 */
export function createMockResponse() {
  const res: any = {
    _status: 200,
    _jsonData: null,
    _headers: {},
  }

  res.status = (code: number) => {
    res._status = code
    return res
  }

  res.json = (data: any) => {
    res._jsonData = data
    return res
  }

  res.end = (data?: any) => {
    if (data) res._jsonData = data
    return res
  }

  res.setHeader = (key: string, value: string) => {
    res._headers[key] = value
    return res
  }

  return res
}
