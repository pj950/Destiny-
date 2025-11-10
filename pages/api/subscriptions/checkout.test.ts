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

// Mock Razorpay
vi.mock('../../../lib/razorpay', () => ({
  razorpayHelpers: {
    createPaymentLink: vi.fn(),
  },
}))

describe('/api/subscriptions/checkout', () => {
  const mockPaymentLink = {
    id: 'plink_123',
    short_url: 'https://rzp.io/i/abc123',
    amount: 29900,
    currency: 'INR',
    expire_by: Math.floor(Date.now() / 1000) + 3600,
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

  it('should create payment link for basic tier monthly', async () => {
    const { razorpayHelpers } = await import('../../../lib/razorpay')
    vi.mocked(razorpayHelpers.createPaymentLink).mockResolvedValue(mockPaymentLink)

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
    expect(data.data.payment_link_id).toBe('plink_123')
    expect(data.data.payment_url).toBe('https://rzp.io/i/abc123')
    expect(data.data.amount).toBe(299)
    expect(data.data.plan).toBe('Basic')
  })

  it('should create payment link for premium tier yearly', async () => {
    const { razorpayHelpers } = await import('../../../lib/razorpay')
    vi.mocked(razorpayHelpers.createPaymentLink).mockResolvedValue(mockPaymentLink)

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
    expect(data.data.amount).toBe(6999)
    expect(data.data.billing_cycle).toBe('yearly')
  })

  it('should include metadata in payment link', async () => {
    const { razorpayHelpers } = await import('../../../lib/razorpay')
    const mockCall = vi.fn().mockResolvedValue(mockPaymentLink)
    vi.mocked(razorpayHelpers.createPaymentLink).mockImplementation(mockCall)

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
    expect(callArgs.notes).toBeDefined()
    expect(callArgs.notes.plan_id).toBe('vip')
    expect(callArgs.notes.user_id).toBe('user-456')
    expect(callArgs.notes.billing_cycle).toBe('monthly')
    expect(callArgs.notes.purchase_type).toBe('subscription')
  })
})
