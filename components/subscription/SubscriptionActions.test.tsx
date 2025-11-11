import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SubscriptionActions from './SubscriptionActions'
import { UserSubscription } from '../../types/database'

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    reload: vi.fn(),
  }),
}))

// Mock fetch
global.fetch = vi.fn()

describe('SubscriptionActions', () => {
  const mockSubscription: UserSubscription = {
    id: 'sub-1',
    user_id: 'user-1',
    tier: 'basic',
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    auto_renew: true,
    external_subscription_id: 'razorpay-sub-1',
    payment_method: 'razorpay',
    cancel_at: null,
    canceled_at: null,
    metadata: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders current plan information', () => {
    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
      />
    )

    expect(screen.getByText(/当前计划: Basic/i)).toBeInTheDocument()
    expect(screen.getByText(/₹299\/月/)).toBeInTheDocument()
  })

  it('displays auto-renew toggle', () => {
    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
      />
    )

    expect(screen.getByText('自动续费')).toBeInTheDocument()
    expect(screen.getByText('订阅到期时自动续订')).toBeInTheDocument()
  })

  it('shows upgrade options for current tier', () => {
    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
      />
    )

    expect(screen.getByText('升级到更高计划')).toBeInTheDocument()
    // Basic tier should show Premium and VIP as upgrade options
    expect(screen.getByText('Premium')).toBeInTheDocument()
    expect(screen.getByText('VIP')).toBeInTheDocument()
  })

  it('does not show upgrade options for VIP tier', () => {
    const vipSubscription = { ...mockSubscription, tier: 'vip' as const }
    render(
      <SubscriptionActions
        subscription={vipSubscription}
        userId="user-1"
      />
    )

    expect(screen.queryByText('升级到更高计划')).not.toBeInTheDocument()
  })

  it('shows cancel subscription button for paid plans', () => {
    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
      />
    )

    expect(screen.getByText('取消订阅')).toBeInTheDocument()
  })

  it('does not show cancel button for free tier', () => {
    const freeSubscription = { ...mockSubscription, tier: 'free' as const }
    render(
      <SubscriptionActions
        subscription={freeSubscription}
        userId="user-1"
      />
    )

    expect(screen.queryByText('取消订阅')).not.toBeInTheDocument()
  })

  it('opens upgrade modal when clicking upgrade option', async () => {
    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
      />
    )

    const premiumUpgradeButton = screen.getByText('Premium').closest('button')
    fireEvent.click(premiumUpgradeButton!)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '确认升级' })).toBeInTheDocument()
    })

    // Check for modal content
    expect(screen.getByText('当前价格:')).toBeInTheDocument()
    expect(screen.getByText('新价格:')).toBeInTheDocument()
    expect(screen.getByText('差价:')).toBeInTheDocument()
  })

  it('shows price difference in upgrade modal', async () => {
    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
      />
    )

    const premiumUpgradeButton = screen.getByText('Premium').closest('button')
    fireEvent.click(premiumUpgradeButton!)

    await waitFor(() => {
      expect(screen.getByText('差价:')).toBeInTheDocument()
    })

    // Premium (699) - Basic (299) = 400
    expect(screen.getByText(/\+₹400\/月/)).toBeInTheDocument()
  })

  it('handles upgrade confirmation successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: { payment_url: 'https://razorpay.com/pay/test' },
      }),
    })
    global.fetch = mockFetch

    // Mock window.location.href
    delete (window as any).location
    window.location = { href: '' } as any

    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
      />
    )

    // Click upgrade
    const premiumUpgradeButton = screen.getByText('Premium').closest('button')
    fireEvent.click(premiumUpgradeButton!)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '确认升级' })).toBeInTheDocument()
    })

    // Confirm upgrade - use getAllByText and find the button
    const confirmButtons = screen.getAllByText('确认升级')
    const confirmButton = confirmButtons.find(el => el.tagName === 'BUTTON')
    fireEvent.click(confirmButton!)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/subscriptions/checkout?user_id=user-1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            tier: 'premium',
            billing_cycle: 'monthly',
          }),
        })
      )
    })

    expect(window.location.href).toBe('https://razorpay.com/pay/test')
  })

  it('opens cancel modal when clicking cancel button', async () => {
    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
      />
    )

    const cancelButton = screen.getByText('取消订阅')
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.getByText('确认取消订阅')).toBeInTheDocument()
    })

    expect(screen.getByText('⚠️ 警告')).toBeInTheDocument()
    expect(screen.getByText(/取消订阅后，您将失去以下功能/)).toBeInTheDocument()
  })

  it('shows lost features in cancel modal', async () => {
    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
      />
    )

    const cancelButton = screen.getByText('取消订阅')
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.getByText(/无限流年分析/)).toBeInTheDocument()
    })

    expect(screen.getByText(/每月20条QA/)).toBeInTheDocument()
  })

  it('handles cancel confirmation successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        message: 'Subscription canceled',
      }),
    })
    global.fetch = mockFetch

    const onSubscriptionChange = vi.fn()

    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
        onSubscriptionChange={onSubscriptionChange}
      />
    )

    // Open cancel modal
    const cancelButton = screen.getByText('取消订阅')
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.getByText('确认取消订阅')).toBeInTheDocument()
    })

    // Confirm cancellation
    const confirmButton = screen.getByText('确认取消')
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/subscriptions/cancel?user_id=user-1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            cancel_at_end: true,
          }),
        })
      )
    })

    expect(onSubscriptionChange).toHaveBeenCalled()
  })

  it('allows choosing immediate cancellation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })
    global.fetch = mockFetch

    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
      />
    )

    // Open cancel modal
    const cancelButton = screen.getByText('取消订阅')
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.getByText('立即取消')).toBeInTheDocument()
    })

    // Select immediate cancellation
    const immediateOption = screen.getByText('立即取消').closest('label')!
    fireEvent.click(immediateOption)

    // Confirm
    const confirmButton = screen.getByText('确认取消')
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/subscriptions/cancel?user_id=user-1',
        expect.objectContaining({
          body: JSON.stringify({
            cancel_at_end: false,
          }),
        })
      )
    })
  })

  it('toggles auto-renew successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        message: 'Auto-renewal disabled',
      }),
    })
    global.fetch = mockFetch

    const onSubscriptionChange = vi.fn()

    const { container } = render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
        onSubscriptionChange={onSubscriptionChange}
      />
    )

    // Find and click the auto-renew toggle
    const autoRenewText = screen.getByText('自动续费')
    const autoRenewSection = autoRenewText.parentElement?.parentElement?.parentElement
    const toggleButton = autoRenewSection?.querySelector('button')

    expect(toggleButton).toBeTruthy()
    fireEvent.click(toggleButton!)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/subscriptions/update?user_id=user-1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            auto_renew: false, // Current is true, so toggle to false
          }),
        })
      )
    })

    expect(onSubscriptionChange).toHaveBeenCalled()
  })

  it('displays error message when API call fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        error: 'Payment failed',
      }),
    })
    global.fetch = mockFetch

    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
      />
    )

    // Try to upgrade
    const premiumUpgradeButton = screen.getByText('Premium').closest('button')
    fireEvent.click(premiumUpgradeButton!)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '确认升级' })).toBeInTheDocument()
    })

    const confirmButtons = screen.getAllByText('确认升级')
    const confirmButton = confirmButtons.find(el => el.tagName === 'BUTTON')
    fireEvent.click(confirmButton!)

    await waitFor(() => {
      expect(screen.getByText(/Payment failed/i)).toBeInTheDocument()
    })
  })

  it('closes modal when clicking cancel', async () => {
    render(
      <SubscriptionActions
        subscription={mockSubscription}
        userId="user-1"
      />
    )

    // Open upgrade modal
    const premiumUpgradeButton = screen.getByText('Premium').closest('button')
    fireEvent.click(premiumUpgradeButton!)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '确认升级' })).toBeInTheDocument()
    })

    // Click cancel
    const cancelButtons = screen.getAllByText('取消')
    fireEvent.click(cancelButtons[0]) // First cancel button is in modal footer

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '确认升级' })).not.toBeInTheDocument()
    })
  })
})
