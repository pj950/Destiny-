/**
 * Tests for POST /api/subscriptions/checkout
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from './checkout'

// Mock Supabase
vi.mock('../../../lib/supabase', () => ({
  supabaseService: {},
}))

// Mock Stripe
vi.mock('../../../lib/stripe', () => ({
  stripeHelpers: {
    createCheckoutSession: vi.fn(),
  },
}))

describe('/api/subscriptions/checkout', () => {
  const mockCheckoutSession = {
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/pay/cs_test_123',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 405 for non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
  })

  it('should reject without plan_id', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        billing_cycle: 'monthly',
        user_id: 'user-123',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    const data = JSON.parse(res._getData())
    expect(data.error).toContain('plan_id')
  })

  it('should reject with invalid plan_id', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        plan_id: 'invalid_plan',
        billing_cycle: 'monthly',
        user_id: 'user-123',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    const data = JSON.parse(res._getData())
    expect(data.error).toContain('Invalid')
  })

  it('should reject without user_id', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        plan_id: 'basic',
        billing_cycle: 'monthly',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    const data = JSON.parse(res._getData())
    expect(data.error).toContain('user_id')
  })

  it('should reject invalid billing_cycle', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        plan_id: 'basic',
        billing_cycle: 'daily',
        user_id: 'user-123',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    const data = JSON.parse(res._getData())
    expect(data.error).toContain('billing_cycle')
  })

  it('should reject free tier checkout', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        plan_id: 'free',
        billing_cycle: 'monthly',
        user_id: 'user-123',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    const data = JSON.parse(res._getData())
    expect(data.error.toLowerCase()).toContain('free')
  })

  it('should create checkout session for basic tier monthly', async () => {
    const { stripeHelpers } = await import('../../../lib/stripe')
    vi.mocked(stripeHelpers.createCheckoutSession).mockResolvedValue(mockCheckoutSession)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        plan_id: 'basic',
        billing_cycle: 'monthly',
        user_id: 'user-123',
        customer_email: 'user@example.com',
        customer_name: 'John Doe',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.ok).toBe(true)
    expect(data.url).toBe('https://checkout.stripe.com/pay/cs_test_123')
    expect(data.session_id).toBe('cs_test_123')
  })

  it('should create checkout session for premium tier yearly', async () => {
    const { stripeHelpers } = await import('../../../lib/stripe')
    vi.mocked(stripeHelpers.createCheckoutSession).mockResolvedValue(mockCheckoutSession)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        plan_id: 'premium',
        billing_cycle: 'yearly',
        user_id: 'user-123',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.ok).toBe(true)
    expect(data.url).toBe('https://checkout.stripe.com/pay/cs_test_123')
    expect(data.session_id).toBe('cs_test_123')
  })

  it('should include metadata in checkout session', async () => {
    const { stripeHelpers } = await import('../../../lib/stripe')
    const mockCall = vi.fn().mockResolvedValue(mockCheckoutSession)
    vi.mocked(stripeHelpers.createCheckoutSession).mockImplementation(mockCall)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        plan_id: 'vip',
        billing_cycle: 'monthly',
        user_id: 'user-456',
      },
    })

    await handler(req, res)

    expect(mockCall).toHaveBeenCalled()
    const callArgs = mockCall.mock.calls[0][0]
    expect(callArgs.planId).toBe('vip')
    expect(callArgs.userId).toBe('user-456')
    expect(callArgs.billingCycle).toBe('monthly')
  })
})
