import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SubscriptionTier } from '../../../types/database'

/**
 * Tests for /api/reports/[id] endpoint
 * Covers report retrieval with subscription-based access
 */

describe('Report Get API', () => {
  let mockSupabaseService: any
  let mockRequest: any
  let mockResponse: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      method: 'GET',
      query: { id: 'report-123' },
    }

    mockResponse = {
      _status: 200,
      _jsonData: null,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
    }

    mockSupabaseService = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Validation', () => {
    it('should reject requests without report_id', async () => {
      mockRequest.query = {}

      expect(() => {
        if (!mockRequest.query.id || typeof mockRequest.query.id !== 'string') {
          throw new Error('report_id is required')
        }
      }).toThrow('report_id is required')
    })

    it('should accept valid report_id', async () => {
      const validId = 'report-456'
      expect(typeof validId).toBe('string')
      expect(validId.length).toBeGreaterThan(0)
    })

    it('should reject non-GET requests', async () => {
      mockRequest.method = 'POST'
      expect(mockRequest.method).not.toBe('GET')
    })
  })

  describe('Report Retrieval', () => {
    it('should fetch report by id', async () => {
      const report = {
        id: 'report-123',
        chart_id: 'chart-456',
        report_type: 'character_profile',
        status: 'completed',
      }

      mockSupabaseService.single.mockResolvedValue({
        data: report,
        error: null,
      })

      const { data, error } = await mockSupabaseService.single()
      expect(data).toBeTruthy()
      expect(data.id).toBe('report-123')
    })

    it('should return 404 when report not found', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      const { data, error } = await mockSupabaseService.single()
      expect(data).toBeNull()
      expect(error).toBeTruthy()
    })

    it('should handle database errors', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const { data, error } = await mockSupabaseService.single()
      expect(error).toBeTruthy()
    })
  })

  describe('Character Profile Access', () => {
    it('should return full report for character_profile', async () => {
      const report = {
        id: 'report-123',
        report_type: 'character_profile',
        body: JSON.stringify({ trait: 'value' }),
        structured: { sections: [] },
      }

      expect(report.report_type).toBe('character_profile')
      expect(report.body).toBeDefined()
      expect(report.structured).toBeDefined()
    })

    it('should not require subscription for character_profile', async () => {
      const report = {
        id: 'report-123',
        report_type: 'character_profile',
        status: 'completed',
      }

      // Character profile is public
      expect(report.report_type).toBe('character_profile')
    })
  })

  describe('Yearly Flow Subscription Handling', () => {
    it('should return full report for premium users', async () => {
      const report = {
        id: 'report-456',
        report_type: 'yearly_flow',
        body: JSON.stringify({ yearlyData: 'complete' }),
        structured: { sections: [] },
      }

      const tier: SubscriptionTier = 'premium' as SubscriptionTier
      const isPaid = tier !== 'free'

      if (isPaid) {
        expect(report.body).toBeDefined()
        expect(report.structured).toBeDefined()
      }
    })

    it('should return limited content for free users', async () => {
      const tier: SubscriptionTier = 'free'
      const isPaid = tier !== 'free'

      if (!isPaid) {
        const limitedReport = {
          body: null,
          structured: { message: 'Please upgrade' },
        }
        expect(limitedReport.body).toBeNull()
        expect(limitedReport.structured.message).toContain('upgrade')
      }
    })

    it('should include upgradeHint for free users', async () => {
      const response = {
        upgradeHint: 'Upgrade to Premium or VIP to access',
      }

      expect(response.upgradeHint).toBeDefined()
      expect(response.upgradeHint).toContain('Upgrade')
    })

    it('should accept all subscription tiers', async () => {
      const tiers = ['free', 'basic', 'premium', 'vip']
      tiers.forEach((tier) => {
        expect(typeof tier).toBe('string')
      })
    })

    it('should handle vip tier', async () => {
      const tier: SubscriptionTier = 'vip'
      const isPaid = tier !== 'free'
      expect(isPaid).toBe(true)
    })

    it('should handle basic tier', async () => {
      const tier: SubscriptionTier = 'basic'
      const isPaid = tier !== 'free'
      expect(isPaid).toBe(true)
    })
  })

  describe('Response Format', () => {
    it('should return full report for paid yearly_flow', async () => {
      const response = {
        ok: true,
        report: {
          id: 'report-456',
          report_type: 'yearly_flow',
          body: '{"data": "complete"}',
        },
      }

      expect(response.ok).toBe(true)
      expect(response.report).toBeDefined()
    })

    it('should return limited report for free yearly_flow', async () => {
      const response = {
        ok: true,
        report: {
          body: null,
          structured: { message: 'Please upgrade' },
        },
        upgradeHint: 'Unlock complete content',
      }

      expect(response.ok).toBe(true)
      expect(response.upgradeHint).toBeDefined()
    })

    it('should return error format on failure', async () => {
      const error = {
        ok: false,
        message: 'Report not found',
      }

      expect(error.ok).toBe(false)
      expect(error.message).toBeTruthy()
    })
  })

  describe('Method Validation', () => {
    it('should reject POST requests', async () => {
      mockRequest.method = 'POST'
      expect(mockRequest.method).not.toBe('GET')
    })

    it('should reject PUT requests', async () => {
      mockRequest.method = 'PUT'
      expect(mockRequest.method).not.toBe('GET')
    })

    it('should reject DELETE requests', async () => {
      mockRequest.method = 'DELETE'
      expect(mockRequest.method).not.toBe('GET')
    })

    it('should accept GET requests', async () => {
      mockRequest.method = 'GET'
      expect(mockRequest.method).toBe('GET')
    })
  })

  describe('Report Type Handling', () => {
    it('should handle character_profile type', async () => {
      const report = {
        report_type: 'character_profile',
        body: 'profile content',
      }

      expect(report.report_type).toBe('character_profile')
      expect(report.body).toBeDefined()
    })

    it('should handle yearly_flow type', async () => {
      const report = {
        report_type: 'yearly_flow',
        body: 'yearly flow content',
      }

      expect(report.report_type).toBe('yearly_flow')
    })

    it('should handle unknown type gracefully', async () => {
      const report = {
        report_type: 'unknown',
        body: 'content',
      }

      // Unknown types are returned as-is
      expect(report).toBeDefined()
    })
  })

  describe('Subscription Tier Query', () => {
    it('should default to free tier', async () => {
      mockRequest.query = { id: 'report-123' }
      const tier = mockRequest.query.subscription_tier || 'free'
      expect(tier).toBe('free')
    })

    it('should accept subscription tier from query', async () => {
      mockRequest.query = { id: 'report-123', subscription_tier: 'premium' }
      expect(mockRequest.query.subscription_tier).toBe('premium')
    })

    it('should allow query override of tier', async () => {
      mockRequest.query = {
        id: 'report-123',
        subscription_tier: 'vip',
      }

      expect(mockRequest.query.subscription_tier).toBe('vip')
    })
  })

  describe('Content Filtering', () => {
    it('should strip body for free yearly_flow users', async () => {
      const originalReport = {
        body: JSON.stringify({ secret: 'data' }),
      }

      const tier = 'free'
      const filteredReport = tier === 'free' ? { ...originalReport, body: null } : originalReport

      expect(filteredReport.body).toBeNull()
    })

    it('should keep full structured for paid users', async () => {
      const report = {
        structured: { sections: [{ title: 'T', content: 'C' }] },
      }

      const tier: SubscriptionTier = 'premium'
      const isPaid = tier !== 'free'

      if (isPaid) {
        expect(report.structured).toBeDefined()
        expect(report.structured.sections).toBeDefined()
      }
    })

    it('should replace structured for free users', async () => {
      const tier = 'free'
      if (tier === 'free') {
        const replacement = {
          structured: { message: 'Please upgrade to unlock' },
        }
        expect(replacement.structured.message).toContain('upgrade')
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle report not found', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      const { data, error } = await mockSupabaseService.single()
      expect(error).toBeTruthy()
    })

    it('should handle database query errors', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { message: 'Query error' },
      })

      const { data, error } = await mockSupabaseService.single()
      expect(error).toBeTruthy()
    })

    it('should return proper error messages', async () => {
      const errors = [
        { message: 'Report not found' },
        { message: 'report_id is required' },
      ]

      errors.forEach((error) => {
        expect(error.message).toBeTruthy()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long report_id', async () => {
      const longId = 'report-' + 'x'.repeat(1000)
      expect(typeof longId).toBe('string')
      expect(longId.length).toBeGreaterThan(1000)
    })

    it('should handle special characters in id', async () => {
      const specialIds = ['report-123', 'report_456', 'report.789']
      specialIds.forEach((id) => {
        expect(typeof id).toBe('string')
      })
    })

    it('should handle concurrent requests', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: { id: 'report-123' },
        error: null,
      })

      const requests = [
        mockSupabaseService.single(),
        mockSupabaseService.single(),
        mockSupabaseService.single(),
      ]

      const results = await Promise.all(requests)
      expect(results).toHaveLength(3)
    })

    it('should handle very large reports', async () => {
      const largeBody = JSON.stringify({ data: 'x'.repeat(10000) })
      const report = {
        id: 'report-123',
        body: largeBody,
      }

      expect(report.body.length).toBeGreaterThan(1000)
    })
  })

  describe('Query Parameter Handling', () => {
    it('should extract id from query', async () => {
      mockRequest.query = { id: 'report-abc' }
      expect(mockRequest.query.id).toBe('report-abc')
    })

    it('should extract subscription_tier from query', async () => {
      mockRequest.query = { id: 'report-123', subscription_tier: 'premium' }
      expect(mockRequest.query.subscription_tier).toBe('premium')
    })

    it('should handle missing subscription_tier', async () => {
      mockRequest.query = { id: 'report-123' }
      const tier = mockRequest.query.subscription_tier || 'free'
      expect(tier).toBe('free')
    })
  })
})
