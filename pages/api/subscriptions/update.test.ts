import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './update'
import * as subscription from '../../../lib/subscription'
import * as supabase from '../../../lib/supabase'

// Mock dependencies
vi.mock('../../../lib/subscription')
vi.mock('../../../lib/supabase')

describe('/api/subscriptions/update', () => {
  let req: Partial<NextApiRequest>
  let res: Partial<NextApiResponse>
  let statusMock: ReturnType<typeof vi.fn>
  let jsonMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    statusMock = vi.fn().mockReturnThis()
    jsonMock = vi.fn().mockReturnThis()

    req = {
      method: 'POST',
      query: {},
      body: {},
    }

    res = {
      status: statusMock,
      json: jsonMock,
    }

    vi.clearAllMocks()
  })

  it('returns 405 for non-POST requests', async () => {
    req.method = 'GET'

    await handler(req as NextApiRequest, res as NextApiResponse)

    expect(statusMock).toHaveBeenCalledWith(405)
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Method not allowed' })
  })

  it('returns 400 when user_id is missing', async () => {
    req.query = {}
    req.body = { auto_renew: true }

    await handler(req as NextApiRequest, res as NextApiResponse)

    expect(statusMock).toHaveBeenCalledWith(400)
    expect(jsonMock).toHaveBeenCalledWith({
      error: 'user_id query parameter is required',
    })
  })

  it('returns 400 when auto_renew is not a boolean', async () => {
    req.query = { user_id: 'user-1' }
    req.body = { auto_renew: 'yes' }

    await handler(req as NextApiRequest, res as NextApiResponse)

    expect(statusMock).toHaveBeenCalledWith(400)
    expect(jsonMock).toHaveBeenCalledWith({
      error: 'auto_renew must be a boolean',
    })
  })

  it('returns 404 when user has no active subscription', async () => {
    req.query = { user_id: 'user-1' }
    req.body = { auto_renew: true }

    vi.mocked(subscription.getUserSubscription).mockResolvedValue(null)

    await handler(req as NextApiRequest, res as NextApiResponse)

    expect(statusMock).toHaveBeenCalledWith(404)
    expect(jsonMock).toHaveBeenCalledWith({
      error: 'No active subscription found',
    })
  })

  it('updates auto_renew successfully', async () => {
    req.query = { user_id: 'user-1' }
    req.body = { auto_renew: false }

    const mockSubscription = {
      id: 'sub-1',
      user_id: 'user-1',
      tier: 'basic' as const,
      status: 'active' as const,
      current_period_start: '2024-01-01T00:00:00Z',
      current_period_end: '2024-02-01T00:00:00Z',
      auto_renew: true,
      external_subscription_id: 'razorpay-1',
      payment_method: 'razorpay',
      cancel_at: null,
      canceled_at: null,
      metadata: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    const updatedSubscription = {
      ...mockSubscription,
      auto_renew: false,
      updated_at: new Date().toISOString(),
    }

    vi.mocked(subscription.getUserSubscription).mockResolvedValue(mockSubscription)
    
    // Mock the entire Supabase chain
    const singleMock = vi.fn().mockResolvedValue({
      data: updatedSubscription,
      error: null,
    })
    const selectMock = vi.fn().mockReturnValue({ single: singleMock })
    const eqMock = vi.fn().mockReturnValue({ select: selectMock })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    
    vi.mocked(supabase.supabaseService).from = fromMock as any

    await handler(req as NextApiRequest, res as NextApiResponse)

    expect(fromMock).toHaveBeenCalledWith('user_subscriptions')
    expect(updateMock).toHaveBeenCalledWith({
      auto_renew: false,
      updated_at: expect.any(String),
    })
    expect(eqMock).toHaveBeenCalledWith('id', 'sub-1')

    expect(statusMock).toHaveBeenCalledWith(200)
    expect(jsonMock).toHaveBeenCalledWith({
      ok: true,
      data: updatedSubscription,
      message: 'Auto-renewal disabled successfully',
    })
  })

  it('returns correct message when enabling auto-renewal', async () => {
    req.query = { user_id: 'user-1' }
    req.body = { auto_renew: true }

    const mockSubscription = {
      id: 'sub-1',
      user_id: 'user-1',
      tier: 'basic' as const,
      status: 'active' as const,
      current_period_start: '2024-01-01T00:00:00Z',
      current_period_end: '2024-02-01T00:00:00Z',
      auto_renew: false,
      external_subscription_id: 'razorpay-1',
      payment_method: 'razorpay',
      cancel_at: null,
      canceled_at: null,
      metadata: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    vi.mocked(subscription.getUserSubscription).mockResolvedValue(mockSubscription)
    
    // Mock the entire Supabase chain
    const singleMock = vi.fn().mockResolvedValue({
      data: { ...mockSubscription, auto_renew: true },
      error: null,
    })
    const selectMock = vi.fn().mockReturnValue({ single: singleMock })
    const eqMock = vi.fn().mockReturnValue({ select: selectMock })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    
    vi.mocked(supabase.supabaseService).from = fromMock as any

    await handler(req as NextApiRequest, res as NextApiResponse)

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Auto-renewal enabled successfully',
      })
    )
  })

  it('returns 500 when database update fails', async () => {
    req.query = { user_id: 'user-1' }
    req.body = { auto_renew: true }

    const mockSubscription = {
      id: 'sub-1',
      user_id: 'user-1',
      tier: 'basic' as const,
      status: 'active' as const,
      current_period_start: '2024-01-01T00:00:00Z',
      current_period_end: '2024-02-01T00:00:00Z',
      auto_renew: false,
      external_subscription_id: null,
      payment_method: null,
      cancel_at: null,
      canceled_at: null,
      metadata: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    vi.mocked(subscription.getUserSubscription).mockResolvedValue(mockSubscription)
    
    // Mock the entire Supabase chain with error
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    })
    const selectMock = vi.fn().mockReturnValue({ single: singleMock })
    const eqMock = vi.fn().mockReturnValue({ select: selectMock })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    
    vi.mocked(supabase.supabaseService).from = fromMock as any

    await handler(req as NextApiRequest, res as NextApiResponse)

    expect(statusMock).toHaveBeenCalledWith(500)
    expect(jsonMock).toHaveBeenCalledWith({
      error: 'Failed to update subscription',
    })
  })

  it('handles unexpected errors gracefully', async () => {
    req.query = { user_id: 'user-1' }
    req.body = { auto_renew: true }

    vi.mocked(subscription.getUserSubscription).mockRejectedValue(
      new Error('Unexpected error')
    )

    await handler(req as NextApiRequest, res as NextApiResponse)

    expect(statusMock).toHaveBeenCalledWith(500)
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
})
