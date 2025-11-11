import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import SubscriptionStatusCard from './SubscriptionStatusCard'

// Mock fetch
global.fetch = vi.fn()

const mockSubscriptionData = {
  ok: true,
  data: {
    tier: 'premium',
    plan: 'Premium',
    subscription: {
      status: 'active',
      current_period_start: '2024-01-01T00:00:00Z',
      current_period_end: '2024-02-01T00:00:00Z',
      auto_renew: true,
      cancel_at: null,
    },
    quota: {
      yearly_flow: { used: 5, limit: 10 },
      qa: { used: 15, limit: 100 },
    },
  },
}

describe('SubscriptionStatusCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton initially', () => {
    // Mock fetch to delay response
    ;(global.fetch as any).mockImplementation(() => new Promise(() => {}))
    
    render(<SubscriptionStatusCard userId="test-user" />)
    
    // Check for skeleton loading elements (no text should be present yet)
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(document.querySelector('.bg-mystical-gold-700\\/20')).toBeInTheDocument()
  })

  it('displays subscription data when loaded successfully', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSubscriptionData),
    })

    render(<SubscriptionStatusCard userId="test-user" />)

    await waitFor(() => {
      expect(screen.getByText('Premium')).toBeInTheDocument()
      expect(screen.getByText('有效')).toBeInTheDocument()
      expect(screen.getByText('开启')).toBeInTheDocument()
    })

    // Check for quota information
    expect(screen.getByText('年度流年报告')).toBeInTheDocument()
    expect(screen.getByText('5/10')).toBeInTheDocument()
    expect(screen.getByText('问答次数')).toBeInTheDocument()
    expect(screen.getByText('15/100')).toBeInTheDocument()
  })

  it('displays error message when API fails', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

    render(<SubscriptionStatusCard userId="test-user" />)

    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeInTheDocument()
    })
  })

  it('displays free tier message when no subscription', async () => {
    const freeTierData = {
      ok: true,
      data: {
        tier: 'free',
        plan: 'Free',
        subscription: null,
        quota: {
          yearly_flow: { used: 1, limit: 1 },
          qa: { used: 0, limit: 0 },
        },
      },
    }

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(freeTierData),
    })

    render(<SubscriptionStatusCard userId="test-user" />)

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument()
      expect(screen.getByText('您正在使用免费版本')).toBeInTheDocument()
    })
  })

  it('displays cancelled subscription correctly', async () => {
    const cancelledData = {
      ok: true,
      data: {
        tier: 'basic',
        plan: 'Basic',
        subscription: {
          status: 'canceled',
          current_period_start: '2024-01-01T00:00:00Z',
          current_period_end: '2024-02-01T00:00:00Z',
          auto_renew: false,
          cancel_at: '2024-02-01T00:00:00Z',
        },
        quota: {
          yearly_flow: { used: 3, limit: null },
          qa: { used: 5, limit: 20 },
        },
      },
    }

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(cancelledData),
    })

    render(<SubscriptionStatusCard userId="test-user" />)

    await waitFor(() => {
      expect(screen.getByText('已取消')).toBeInTheDocument()
      expect(screen.getByText('关闭')).toBeInTheDocument()
      expect(screen.getByText('取消生效日期')).toBeInTheDocument()
    })
  })

  it('calls API with correct user_id parameter', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSubscriptionData),
    })

    render(<SubscriptionStatusCard userId="specific-user-123" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/subscriptions/current?user_id=specific-user-123'
      )
    })
  })

  it('displays unlimited quota correctly', async () => {
    const unlimitedData = {
      ok: true,
      data: {
        tier: 'vip',
        plan: 'VIP',
        subscription: {
          status: 'active',
          current_period_start: '2024-01-01T00:00:00Z',
          current_period_end: '2024-02-01T00:00:00Z',
          auto_renew: true,
          cancel_at: null,
        },
        quota: {
          yearly_flow: { used: 50, limit: null },
          qa: { used: 200, limit: null },
        },
      },
    }

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(unlimitedData),
    })

    render(<SubscriptionStatusCard userId="vip-user" />)

    await waitFor(() => {
      expect(screen.getByText('50/无限')).toBeInTheDocument()
      expect(screen.getByText('200/无限')).toBeInTheDocument()
    })
  })
})