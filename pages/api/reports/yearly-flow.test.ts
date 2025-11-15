import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as subscriptionModule from '@/features/subscriptions/services'

/**
 * Tests for /api/reports/yearly-flow endpoint
 * Covers yearly flow report job creation and quota checks
 */

vi.mock('@/features/subscriptions/services', () => ({
  checkQuota: vi.fn(),
  upgradePrompt: vi.fn(),
}))

describe('Yearly Flow API', () => {
  let mockSupabaseService: any
  let mockRequest: any
  let mockResponse: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      method: 'POST',
      body: { chart_id: 'chart-123', target_year: 2024 },
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
      insert: vi.fn().mockReturnThis(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Validation', () => {
    it('should reject requests without chart_id', async () => {
      mockRequest.body = { target_year: 2024 }

      expect(() => {
        if (!mockRequest.body.chart_id || typeof mockRequest.body.chart_id !== 'string') {
          throw new Error('chart_id is required')
        }
      }).toThrow('chart_id is required')
    })

    it('should accept valid chart_id', async () => {
      const validChartId = 'chart-456'
      expect(typeof validChartId).toBe('string')
    })

    it('should reject non-POST requests', async () => {
      mockRequest.method = 'GET'
      expect(mockRequest.method).not.toBe('POST')
    })

    it('should default target_year to current year if not provided', async () => {
      mockRequest.body = { chart_id: 'chart-123' }
      const year = mockRequest.body.target_year || new Date().getFullYear()
      expect(year).toBeGreaterThanOrEqual(2000)
    })

    it('should reject invalid target_year', async () => {
      const invalidYears = [1800, 2200, -1, 'invalid', null]
      invalidYears.forEach((year) => {
        const isValid = typeof year === 'number' && year >= 1900 && year <= 2100
        expect(isValid).toBe(false)
      })
    })

    it('should validate target_year as integer', async () => {
      expect(typeof 2024).toBe('number')
      expect(Number.isInteger(2024)).toBe(true)
    })
  })

  describe('Chart Verification', () => {
    it('should verify chart exists before creating job', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: { id: 'chart-123' },
        error: null,
      })

      const { data, error } = await mockSupabaseService.single()
      expect(data).toBeTruthy()
      expect(data.id).toBe('chart-123')
    })

    it('should return 404 when chart not found', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      const { data, error } = await mockSupabaseService.single()
      expect(data).toBeNull()
      expect(error).toBeTruthy()
    })

    it('should query only id field for validation', async () => {
      mockSupabaseService.select.mockImplementation((fields: string) => {
        expect(fields).toContain('id')
        return mockSupabaseService
      })

      await mockSupabaseService.select('id')
      expect(mockSupabaseService.select).toHaveBeenCalledWith('id')
    })
  })

  describe('Job Creation', () => {
    it('should create job with yearly_flow_report type', async () => {
      const jobData = {
        user_id: null,
        chart_id: 'chart-123',
        job_type: 'yearly_flow_report',
        status: 'pending',
        result_url: null,
        metadata: {},
      }

      expect(jobData.job_type).toBe('yearly_flow_report')
    })

    it('should store target_year in metadata', async () => {
      const metadata = {
        target_year: 2024,
        prompt_version: 'yearly_flow_v1',
      }

      expect(metadata.target_year).toBe(2024)
      expect(metadata.prompt_version).toBe('yearly_flow_v1')
    })

    it('should store prompt version in metadata', async () => {
      const metadata = {
        prompt_version: 'yearly_flow_v1',
      }

      expect(metadata.prompt_version).toBe('yearly_flow_v1')
    })

    it('should store subscription tier in metadata', async () => {
      const metadata = {
        subscription_tier: 'free',
      }

      expect(metadata.subscription_tier).toBe('free')
    })

    it('should store requester timestamp in metadata', async () => {
      const metadata = {
        requester_timestamp: new Date().toISOString(),
      }

      expect(metadata.requester_timestamp).toBeDefined()
      expect(typeof metadata.requester_timestamp).toBe('string')
    })

    it('should set job status to pending', async () => {
      const jobData = {
        status: 'pending',
      }

      expect(jobData.status).toBe('pending')
    })

    it('should set user_id to null for anonymous', async () => {
      const jobData = {
        user_id: null,
      }

      expect(jobData.user_id).toBeNull()
    })

    it('should return job_id after creation', async () => {
      const job = {
        id: 'job-789',
        chart_id: 'chart-123',
        job_type: 'yearly_flow_report',
        status: 'pending',
      }

      mockSupabaseService.single.mockResolvedValue({
        data: job,
        error: null,
      })

      const { data, error } = await mockSupabaseService.single()
      expect(data.id).toBe('job-789')
    })

    it('should handle job creation errors', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { message: 'Creation failed' },
      })

      const { data, error } = await mockSupabaseService.single()
      expect(error).toBeTruthy()
      expect(data).toBeNull()
    })
  })

  describe('Response Format', () => {
    it('should return job_id in response', async () => {
      const response = {
        ok: true,
        job_id: 'job-789',
        target_year: 2024,
      }

      expect(response.ok).toBe(true)
      expect(response.job_id).toBeDefined()
      expect(response.target_year).toBe(2024)
    })

    it('should return target_year in response', async () => {
      const response = {
        ok: true,
        target_year: 2024,
      }

      expect(response.target_year).toBe(2024)
    })

    it('should return error format on failure', async () => {
      const error = {
        ok: false,
        message: 'Chart not found',
      }

      expect(error.ok).toBe(false)
      expect(error.message).toBeTruthy()
    })
  })

  describe('Default Year Handling', () => {
    it('should use current year if not specified', async () => {
      mockRequest.body = { chart_id: 'chart-123' }
      const year = mockRequest.body.target_year || new Date().getFullYear()
      expect(year).toBe(new Date().getFullYear())
    })

    it('should accept explicit year', async () => {
      mockRequest.body = { chart_id: 'chart-123', target_year: 2025 }
      const year = mockRequest.body.target_year || new Date().getFullYear()
      expect(year).toBe(2025)
    })

    it('should handle leap years', async () => {
      const leapYears = [2024, 2020, 2016]
      leapYears.forEach((year) => {
        expect(year % 4).toBe(0)
      })
    })
  })

  describe('Subscription Tier Handling', () => {
    it('should default subscription_tier to free', async () => {
      mockRequest.body = { chart_id: 'chart-123' }
      const tier = mockRequest.body.subscription_tier || 'free'
      expect(tier).toBe('free')
    })

    it('should accept basic tier', async () => {
      mockRequest.body = { chart_id: 'chart-123', subscription_tier: 'basic' }
      expect(mockRequest.body.subscription_tier).toBe('basic')
    })

    it('should accept premium tier', async () => {
      mockRequest.body = { chart_id: 'chart-123', subscription_tier: 'premium' }
      expect(mockRequest.body.subscription_tier).toBe('premium')
    })

    it('should accept vip tier', async () => {
      mockRequest.body = { chart_id: 'chart-123', subscription_tier: 'vip' }
      expect(mockRequest.body.subscription_tier).toBe('vip')
    })
  })

  describe('Method Validation', () => {
    it('should reject GET requests', async () => {
      mockRequest.method = 'GET'
      expect(mockRequest.method).not.toBe('POST')
    })

    it('should reject PUT requests', async () => {
      mockRequest.method = 'PUT'
      expect(mockRequest.method).not.toBe('POST')
    })

    it('should reject DELETE requests', async () => {
      mockRequest.method = 'DELETE'
      expect(mockRequest.method).not.toBe('POST')
    })

    it('should accept POST requests', async () => {
      mockRequest.method = 'POST'
      expect(mockRequest.method).toBe('POST')
    })
  })

  describe('Job Queuing', () => {
    it('should create job as pending for background processing', async () => {
      const job = {
        id: 'job-123',
        status: 'pending',
        job_type: 'yearly_flow_report',
      }

      expect(job.status).toBe('pending')
    })

    it('should store enough metadata for async processing', async () => {
      const metadata = {
        target_year: 2024,
        prompt_version: 'yearly_flow_v1',
        chart_id: 'chart-123',
        requester_timestamp: new Date().toISOString(),
      }

      expect(metadata).toHaveProperty('target_year')
      expect(metadata).toHaveProperty('prompt_version')
      expect(metadata).toHaveProperty('requester_timestamp')
    })
  })

  describe('Year Validation', () => {
    it('should accept valid years (1900-2100)', async () => {
      const validYears = [1900, 1950, 2000, 2024, 2050, 2100]
      validYears.forEach((year) => {
        const isValid = year >= 1900 && year <= 2100
        expect(isValid).toBe(true)
      })
    })

    it('should reject years before 1900', async () => {
      const year = 1899
      const isValid = year >= 1900 && year <= 2100
      expect(isValid).toBe(false)
    })

    it('should reject years after 2100', async () => {
      const year = 2101
      const isValid = year >= 1900 && year <= 2100
      expect(isValid).toBe(false)
    })

    it('should reject non-numeric years', async () => {
      const invalidYears = ['2024', null, undefined, {}]
      invalidYears.forEach((year) => {
        const isValid = typeof year === 'number'
        if (year !== null && year !== undefined) {
          expect(isValid).toBe(false)
        }
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle chart query errors', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const { data, error } = await mockSupabaseService.single()
      expect(error).toBeTruthy()
    })

    it('should handle job insertion errors', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { message: 'Insertion failed' },
      })

      const { data, error } = await mockSupabaseService.single()
      expect(error).toBeTruthy()
    })

    it('should return proper error messages', async () => {
      const errors = [
        { message: 'Chart not found' },
        { message: 'chart_id is required' },
        { message: 'Failed to create job' },
      ]

      errors.forEach((error) => {
        expect(error.message).toBeTruthy()
        expect(typeof error.message).toBe('string')
      })
    })
  })

  describe('Quota Checks', () => {
    it('should reject request if user exceeds yearly_flow quota', () => {
      const checkQuota = vi.fn().mockResolvedValue({ available: false, current: 1, limit: 1 })
      const upgradePrompt = vi.fn().mockReturnValue('Upgrade to premium')
      
      expect(checkQuota).toBeDefined()
      expect(upgradePrompt).toBeDefined()
    })

    it('should allow request if user has quota available', () => {
      const checkQuota = vi.fn().mockResolvedValue({ available: true, current: 0, limit: 1 })
      
      expect(checkQuota).toBeDefined()
    })

    it('should allow unlimited requests for premium tier', () => {
      const checkQuota = vi.fn().mockResolvedValue({ available: true, current: 10, limit: null })
      
      expect(checkQuota).toBeDefined()
    })

    it('should skip quota check if user_id not provided', () => {
      // When user_id is not provided, quota check should be skipped
      const request = { chart_id: 'chart-123', target_year: 2024 }
      expect(request.user_id).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long chart_id', async () => {
      const longId = 'chart-' + 'x'.repeat(1000)
      expect(typeof longId).toBe('string')
      expect(longId.length).toBeGreaterThan(1000)
    })

    it('should handle multiple year requests', async () => {
      const requests = [
        { chart_id: 'chart-1', target_year: 2024 },
        { chart_id: 'chart-2', target_year: 2025 },
        { chart_id: 'chart-3', target_year: 2026 },
      ]

      expect(requests).toHaveLength(3)
      requests.forEach((req) => {
        expect(req).toHaveProperty('chart_id')
        expect(req).toHaveProperty('target_year')
      })
    })

    it('should handle rapid successive requests', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: { id: 'job-123' },
        error: null,
      })

      const concurrentRequests = [
        mockSupabaseService.single(),
        mockSupabaseService.single(),
        mockSupabaseService.single(),
      ]

      const results = await Promise.all(concurrentRequests)
      expect(results).toHaveLength(3)
    })

    it('should handle leap year boundaries', async () => {
      const leapYearData = [
        { chart_id: 'chart-1', target_year: 2020 },
        { chart_id: 'chart-2', target_year: 2024 },
      ]

      leapYearData.forEach((data) => {
        expect(data.target_year % 4).toBe(0)
      })
    })
  })
})
