import Razorpay from 'razorpay'

// Guard: Check for required environment variables (server-side only)
if (typeof window !== 'undefined') {
  throw new Error('Razorpay client can only be used on the server side')
}

if (!process.env.RAZORPAY_KEY_ID) {
  throw new Error('RAZORPAY_KEY_ID environment variable is not configured. Please set it in your .env.local file.')
}

if (!process.env.RAZORPAY_KEY_SECRET) {
  throw new Error('RAZORPAY_KEY_SECRET environment variable is not configured. Please set it in your .env.local file.')
}

// Create and export singleton Razorpay instance
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// Helper wrapper functions for common operations
export const razorpayHelpers = {
  /**
   * Create a payment link
   */
  async createPaymentLink(options: {
    amount: number
    currency?: string
    accept_partial?: boolean
    description?: string
    customer?: {
      email?: string
      name?: string
      contact?: string
    }
    notes?: Record<string, string>
    callback_url?: string
    callback_method?: string
    reference_id?: string
    expire_by?: number
  }) {
    const createOptions: any = {
      amount: options.amount,
      currency: options.currency || 'INR',
      accept_partial: options.accept_partial || false,
    }
    
    if (options.description) createOptions.description = options.description
    if (options.customer) createOptions.customer = options.customer
    if (options.notes) createOptions.notes = options.notes
    if (options.callback_url) createOptions.callback_url = options.callback_url
    if (options.callback_method) createOptions.callback_method = options.callback_method
    if (options.reference_id) createOptions.reference_id = options.reference_id
    if (options.expire_by) createOptions.expire_by = options.expire_by

    return await razorpay.paymentLink.create(createOptions)
  },

  /**
   * Fetch a payment link by ID
   */
  async fetchPaymentLink(paymentLinkId: string) {
    return await razorpay.paymentLink.fetch(paymentLinkId)
  },

  /**
   * Create a Razorpay order
   */
  async createOrder(options: {
    amount: number
    currency?: string
    receipt?: string
    notes?: Record<string, string>
    partial_payment?: boolean
    first_payment_min_amount?: number
    expires_at?: number
  }) {
    const createOptions: any = {
      amount: options.amount,
      currency: options.currency || 'INR',
    }
    
    if (options.receipt) createOptions.receipt = options.receipt
    if (options.notes) createOptions.notes = options.notes
    if (options.partial_payment !== undefined) createOptions.partial_payment = options.partial_payment
    if (options.first_payment_min_amount) createOptions.first_payment_min_amount = options.first_payment_min_amount
    if (options.expires_at) createOptions.expires_at = options.expires_at

    return await razorpay.orders.create(createOptions)
  },

  /**
   * Fetch an order by ID
   */
  async fetchOrder(orderId: string) {
    return await razorpay.orders.fetch(orderId)
  },

  /**
   * Fetch payments for an order
   */
  async fetchOrderPayments(orderId: string) {
    return await razorpay.orders.fetchPayments(orderId)
  },

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    webhookBody: string,
    webhookSignature: string,
    webhookSecret: string
  ): boolean {
    return Razorpay.validateWebhookSignature(
      webhookBody,
      webhookSignature,
      webhookSecret
    )
  },
}

export default razorpay