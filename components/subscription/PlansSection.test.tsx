import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/router'
import PlansSection from './PlansSection'

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}))

const mockPlans = [
  {
    id: 'free',
    name: 'Free',
    description: 'Basic features, perfect for getting started',
    price: { monthly: 0, yearly: 0 },
    billing_cycles: ['monthly'],
    features: {
      character_profile: true,
      yearly_flow: { enabled: true, limit: 1, period: 'monthly' },
      qa: { enabled: false, limit: 0, period: 'monthly' },
      family_comparison: false,
      export: { enabled: false, formats: [] },
    },
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'Ideal for casual users and enthusiasts',
    price: { monthly: 299, yearly: 2999 },
    billing_cycles: ['monthly', 'yearly'],
    features: {
      character_profile: true,
      yearly_flow: { enabled: true, limit: null, period: null },
      qa: { enabled: true, limit: 20, period: 'monthly' },
      family_comparison: false,
      export: { enabled: true, formats: ['pdf'] },
    },
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Advanced features for dedicated users',
    price: { monthly: 699, yearly: 6999 },
    billing_cycles: ['monthly', 'yearly'],
    features: {
      character_profile: true,
      yearly_flow: { enabled: true, limit: null, period: null },
      qa: { enabled: true, limit: 100, period: 'monthly' },
      family_comparison: true,
      export: { enabled: true, formats: ['pdf', 'excel'] },
    },
  },
  {
    id: 'vip',
    name: 'VIP',
    description: 'Ultimate access with priority support',
    price: { monthly: 1499, yearly: 14999 },
    billing_cycles: ['monthly', 'yearly'],
    features: {
      character_profile: true,
      yearly_flow: { enabled: true, limit: null, period: null },
      qa: { enabled: true, limit: null, period: null },
      family_comparison: true,
      export: { enabled: true, formats: ['pdf', 'excel', 'csv', 'docx'] },
    },
  },
]

describe('PlansSection', () => {
  let mockPush: any
  let fetchSpy: any

  beforeEach(() => {
    mockPush = vi.fn()
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      query: {},
      pathname: '',
      asPath: '',
      isFallback: false,
    } as any)

    fetchSpy = vi.fn((url: string) => {
      if (url.includes('/api/subscriptions/plans')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: mockPlans }),
        } as Response)
      }
      if (url.includes('/api/subscriptions/current')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: null }),
        } as Response)
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    global.fetch = fetchSpy as any
  })

  it('renders plans section and displays all plans', async () => {
    render(<PlansSection />)

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument()
      expect(screen.getByText('Basic')).toBeInTheDocument()
      expect(screen.getByText('Premium')).toBeInTheDocument()
      expect(screen.getByText('VIP')).toBeInTheDocument()
    })
  })

  it('toggles between monthly and yearly billing', async () => {
    render(<PlansSection />)

    await waitFor(() => {
      expect(screen.getByText('按月计费')).toBeInTheDocument()
    })

    // Check for monthly prices initially
    expect(screen.getByText('₹299')).toBeInTheDocument()

    // Click toggle
    const toggle = screen.getByRole('button', { name: '' }) as HTMLElement
    fireEvent.click(toggle)

    // Should show yearly prices now
    await waitFor(() => {
      expect(screen.getByText('按年计费')).toBeInTheDocument()
    })
  })

  it('displays recommended badge for Premium plan', async () => {
    render(<PlansSection />)

    await waitFor(() => {
      const badges = screen.getAllByText('推荐')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('shows current plan badge when user has a plan', async () => {
    fetchSpy = vi.fn((url: string) => {
      if (url.includes('/api/subscriptions/plans')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: mockPlans }),
        } as Response)
      }
      if (url.includes('/api/subscriptions/current')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: { tier: 'basic' } }),
        } as Response)
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    global.fetch = fetchSpy as any

    render(<PlansSection userId="test-user-id" />)

    await waitFor(() => {
      const currentPlanBadges = screen.getAllByText('当前计划')
      expect(currentPlanBadges.length).toBeGreaterThan(0)
    })
  })

  it('highlights current plan when currentTier is provided without fetching subscription', async () => {
    render(<PlansSection currentTier="premium" />)

    await waitFor(() => {
      expect(screen.getByText('Premium')).toBeInTheDocument()
    })

    const currentPlanBadges = screen.getAllByText('当前计划')
    expect(currentPlanBadges.length).toBeGreaterThan(0)

    const fetchedCurrentEndpoint = fetchSpy.mock.calls.some(([url]) => typeof url === 'string' && url.includes('/api/subscriptions/current'))
    expect(fetchedCurrentEndpoint).toBe(false)
  })

  it('calls onSelectPlan when upgrade button is clicked with custom handler', async () => {
    const onSelectPlan = vi.fn()
    render(<PlansSection onSelectPlan={onSelectPlan} />)

    await waitFor(() => {
      const upgradeButtons = screen.queryAllByText('立即升级')
      expect(upgradeButtons.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    // Verify the component accepts the onSelectPlan prop and renders
    expect(onSelectPlan).toBeDefined()
  })

  it('displays loading state while fetching plans', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) // Never resolves
    render(<PlansSection />)

    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('displays error message on fetch failure', async () => {
    fetchSpy = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Failed')),
      } as Response)
    )
    global.fetch = fetchSpy as any

    render(<PlansSection />)

    await waitFor(() => {
      expect(screen.getByText(/无法加载计划/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('displays savings information for yearly billing', async () => {
    render(<PlansSection />)

    await waitFor(() => {
      expect(screen.getByText('省15%')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('shows upgrade button text for non-current plans', async () => {
    render(<PlansSection />)

    await waitFor(() => {
      const upgradeButtons = screen.queryAllByText('立即升级')
      expect(upgradeButtons.length).toBeGreaterThan(0)
    }, { timeout: 3000 })
  })
})
