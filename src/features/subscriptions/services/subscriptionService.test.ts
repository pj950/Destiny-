/**
 * Tests for subscription system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SUBSCRIPTION_PLANS,
  getUserSubscription,
  getUserTier,
  hasFeature,
  checkQuota,
  getQuotaUsage,
  upgradePrompt,
  createOrUpdateSubscription,
  cancelSubscription,
} from './subscriptionService'
import { supabaseService } from '@/lib/supabase'

// Mock supabaseService
vi.mock('@/lib/supabase', () => ({
  supabaseService: {
    from: vi.fn(),
  },
}))

describe('Subscription System', () => {
  const mockUserId = 'test-user-123'
  const mockSubscription = {
    id: 'sub-123',
    user_id: mockUserId,
    tier: 'premium' as const,
    status: 'active' as const,
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    auto_renew: true,
    external_subscription_id: null,
    payment_method: null,
    cancel_at: null,
    canceled_at: null,
    metadata: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Plan Definitions', () => {
    it('should have all 4 subscription plans', () => {
      expect(Object.keys(SUBSCRIPTION_PLANS)).toHaveLength(4)
      expect(SUBSCRIPTION_PLANS.free).toBeDefined()
      expect(SUBSCRIPTION_PLANS.basic).toBeDefined()
      expect(SUBSCRIPTION_PLANS.premium).toBeDefined()
      expect(SUBSCRIPTION_PLANS.vip).toBeDefined()
    })

    it('should have free tier with no monthly cost', () => {
      expect(SUBSCRIPTION_PLANS.free.price.monthly).toBe(0)
      expect(SUBSCRIPTION_PLANS.free.price.yearly).toBe(0)
    })

    it('free tier should have limited yearly_flow quota', () => {
      expect(SUBSCRIPTION_PLANS.free.features.yearly_flow.limit).toBe(1)
      expect(SUBSCRIPTION_PLANS.free.features.yearly_flow.period).toBe('monthly')
    })

    it('free tier should not have QA access', () => {
      expect(SUBSCRIPTION_PLANS.free.features.qa.enabled).toBe(false)
      expect(SUBSCRIPTION_PLANS.free.features.qa.limit).toBe(0)
    })

    it('basic tier should have 20 QA questions per month', () => {
      expect(SUBSCRIPTION_PLANS.basic.features.qa.enabled).toBe(true)
      expect(SUBSCRIPTION_PLANS.basic.features.qa.limit).toBe(20)
    })

    it('premium tier should have 100 QA questions per month', () => {
      expect(SUBSCRIPTION_PLANS.premium.features.qa.enabled).toBe(true)
      expect(SUBSCRIPTION_PLANS.premium.features.qa.limit).toBe(100)
    })

    it('vip tier should have unlimited QA and yearly flow', () => {
      expect(SUBSCRIPTION_PLANS.vip.features.qa.limit).toBeNull()
      expect(SUBSCRIPTION_PLANS.vip.features.yearly_flow.limit).toBeNull()
    })

    it('premium tier should have family_comparison', () => {
      expect(SUBSCRIPTION_PLANS.premium.features.family_comparison).toBe(true)
      expect(SUBSCRIPTION_PLANS.free.features.family_comparison).toBe(false)
      expect(SUBSCRIPTION_PLANS.basic.features.family_comparison).toBe(false)
    })

    it('export formats should be correct for each tier', () => {
      expect(SUBSCRIPTION_PLANS.free.features.export.formats).toHaveLength(0)
      expect(SUBSCRIPTION_PLANS.basic.features.export.formats).toEqual(['pdf'])
      expect(SUBSCRIPTION_PLANS.premium.features.export.formats).toEqual(['pdf', 'excel'])
      expect(SUBSCRIPTION_PLANS.vip.features.export.formats).toEqual(['pdf', 'excel', 'csv', 'docx'])
    })
  })

  describe('Upgrade Prompt', () => {
    it('should generate upgrade prompt for QA feature', () => {
      const prompt = upgradePrompt('free', 'qa')
      expect(prompt.toLowerCase()).toContain('upgrade')
      expect(prompt).toContain('quota')
    })

    it('should suggest basic tier for QA access from free', () => {
      const prompt = upgradePrompt('free', 'qa')
      expect(prompt).toContain('Basic')
    })

    it('should suggest premium tier for family comparison', () => {
      const prompt = upgradePrompt('basic', 'family_comparison')
      expect(prompt).toContain('Premium')
    })

    it('should suggest VIP tier for advanced export', () => {
      const prompt = upgradePrompt('premium', 'export_advanced')
      expect(prompt).toContain('VIP')
    })
  })

  describe('getUserSubscription', () => {
    it('should return null if no active subscription exists', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      })

      vi.mocked(supabaseService.from).mockImplementation(mockFrom)

      const result = await getUserSubscription(mockUserId)
      expect(result).toBeNull()
    })

    it('should return subscription if active', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscription, error: null }),
            }),
          }),
        }),
      })

      vi.mocked(supabaseService.from).mockImplementation(mockFrom)

      const result = await getUserSubscription(mockUserId)
      expect(result).toEqual(mockSubscription)
    })
  })

  describe('getUserTier', () => {
    it('should return free tier if no subscription', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      })

      vi.mocked(supabaseService.from).mockImplementation(mockFrom)

      const result = await getUserTier(mockUserId)
      expect(result).toBe('free')
    })

    it('should return subscription tier', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscription, error: null }),
            }),
          }),
        }),
      })

      vi.mocked(supabaseService.from).mockImplementation(mockFrom)

      const result = await getUserTier(mockUserId)
      expect(result).toBe('premium')
    })
  })

  describe('hasFeature', () => {
    it('should return true for available feature', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscription, error: null }),
            }),
          }),
        }),
      })

      vi.mocked(supabaseService.from).mockImplementation(mockFrom)

      // Premium has family_comparison
      const result = await hasFeature(mockUserId, 'family_comparison')
      expect(result).toBe(true)
    })

    it('should return false for unavailable feature', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      })

      vi.mocked(supabaseService.from).mockImplementation(mockFrom)

      // Free tier doesn't have QA
      const result = await hasFeature(mockUserId, 'qa')
      expect(result).toBe(false)
    })
  })

  describe('checkQuota', () => {
    it('should return available for unlimited quota', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscription, error: null }),
            }),
          }),
        }),
      })

      vi.mocked(supabaseService.from).mockImplementation(mockFrom)

      const result = await checkQuota(mockUserId, 'yearly_flow')
      expect(result.available).toBe(true)
      expect(result.limit).toBeNull()
    })

    it('should return false for disabled feature', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      })

      vi.mocked(supabaseService.from).mockImplementation(mockFrom)

      const result = await checkQuota(mockUserId, 'qa')
      expect(result.available).toBe(false)
      expect(result.limit).toBe(0)
    })
  })

  describe('getQuotaUsage', () => {
    it('should return quota info for all features', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscription, error: null }),
            }),
          }),
        }),
      })

      vi.mocked(supabaseService.from).mockImplementation(mockFrom)

      const result = await getQuotaUsage(mockUserId)
      expect(result.yearly_flow).toBeDefined()
      expect(result.qa_questions).toBeDefined()
    })
  })

  describe('createOrUpdateSubscription', () => {
    it('should create subscription', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockSubscription, error: null }),
          }),
        }),
      })

      vi.mocked(supabaseService.from).mockImplementation(mockFrom)

      const result = await createOrUpdateSubscription(mockUserId, 'premium')
      expect(result).toEqual(mockSubscription)
    })
  })

  describe('cancelSubscription', () => {
    it('should cancel subscription at end of period', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscription, error: null }),
          }),
        }),
      })

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      const mockFrom = vi.fn((table: string) => {
        if (table === 'user_subscriptions') {
          return {
            select: mockSelect,
            update: mockUpdate,
          }
        }
      })

      vi.mocked(supabaseService.from).mockImplementation(mockFrom)

      const result = await cancelSubscription(mockUserId, true)
      expect(result).toBe(true)
    })

    it('should return false if no subscription exists', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      })

      vi.mocked(supabaseService.from).mockImplementation(mockFrom)

      const result = await cancelSubscription(mockUserId)
      expect(result).toBe(false)
    })
  })
})
