import Stripe from 'stripe'

// Guard: Check for required environment variables (server-side only)
if (typeof window !== 'undefined') {
  throw new Error('Stripe client can only be used on the server side')
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not configured. Please set it in your .env.local file.')
}

// Create and export singleton Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})

// Helper wrapper functions for common operations
export const stripeHelpers = {
  /**
   * Create a Checkout Session for subscription payment
   */
  async createCheckoutSession(options: {
    priceId: string
    userId: string
    planId: string
    billingCycle: 'monthly' | 'yearly'
    successUrl: string
    cancelUrl: string
    customerEmail?: string
  }) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', // One-time payment (not recurring subscription)
      payment_method_types: ['card'],
      line_items: [
        {
          price: options.priceId,
          quantity: 1,
        },
      ],
      customer_email: options.customerEmail,
      metadata: {
        user_id: options.userId,
        plan_id: options.planId,
        billing_cycle: options.billingCycle,
        purchase_type: 'subscription',
      },
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
    })

    return session
  },

  /**
   * Create or retrieve a Stripe customer
   */
  async getOrCreateCustomer(options: {
    userId: string
    email?: string
    name?: string
  }) {
    // Search for existing customer by metadata
    const existingCustomers = await stripe.customers.list({
      limit: 1,
      email: options.email,
    })

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0]
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email: options.email,
      name: options.name,
      metadata: {
        user_id: options.userId,
      },
    })

    return customer
  },

  /**
   * Create a subscription for a customer
   */
  async createSubscription(options: {
    customerId: string
    priceId: string
    metadata?: Record<string, string>
  }) {
    const subscription = await stripe.subscriptions.create({
      customer: options.customerId,
      items: [{ price: options.priceId }],
      metadata: options.metadata,
    })

    return subscription
  },

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtEnd: boolean = true) {
    if (cancelAtEnd) {
      // Cancel at period end
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      })
      return subscription
    } else {
      // Cancel immediately
      const subscription = await stripe.subscriptions.cancel(subscriptionId)
      return subscription
    }
  },

  /**
   * Retrieve a subscription
   */
  async getSubscription(subscriptionId: string) {
    return await stripe.subscriptions.retrieve(subscriptionId)
  },

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): Stripe.Event {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  },
}

export default stripe
