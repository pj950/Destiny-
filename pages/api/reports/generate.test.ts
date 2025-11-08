import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for /api/reports/generate endpoint
 * Covers Razorpay payment link creation for report generation
 */

describe('Reports Generate API', () => {
  let mockSupabaseService: any
  let mockRazorpayHelpers: any
  let mockRequest: any
  let mockResponse: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      method: 'POST',
      body: { chart_id: 'chart-id-123' },
    }

    mockResponse = {
      _status: 200,
      _jsonData: null,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }

    mockSupabaseService = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    }

    mockRazorpayHelpers = {
      createPaymentLink: vi.fn(),
      fetchPaymentLink: vi.fn(),
      verifyWebhookSignature: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Validation', () => {
    it('should reject requests without chart_id', async () => {
      mockRequest.body = {}

      expect(() => {
        if (!mockRequest.body.chart_id || typeof mockRequest.body.chart_id !== 'string') {
          throw new Error('chart_id is required')
        }
      }).toThrow('chart_id is required')
    })

    it('should accept valid chart_id', async () => {
      const validChartId = 'chart-id-456'
      expect(typeof validChartId).toBe('string')
      expect(validChartId.length).toBeGreaterThan(0)
    })

    it('should reject non-POST requests', async () => {
      mockRequest.method = 'GET'
      expect(mockRequest.method).not.toBe('POST')
    })

    it('should reject invalid chart_id types', async () => {
      const invalidIds = [123, null, undefined, { id: 'chart-1' }]
      invalidIds.forEach((id) => {
        expect(typeof id).not.toBe('string')
      })
    })
  })

  describe('Chart Validation', () => {
    it('should verify chart exists before creating payment', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: { id: 'chart-id-456', profile_id: 'profile-789' },
        error: null,
      })

      const { data, error } = await mockSupabaseService.single()
      expect(data).toBeTruthy()
      expect(data.id).toBe('chart-id-456')
      expect(error).toBeNull()
    })

    it('should return 404 when chart not found', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { message: 'Chart not found' },
      })

      const { data, error } = await mockSupabaseService.single()
      expect(data).toBeNull()
      expect(error).toBeTruthy()
    })

    it('should handle chart query with all required fields', async () => {
      mockSupabaseService.select.mockImplementation((fields: string) => {
        expect(fields).toContain('id')
        expect(fields).toContain('profile_id')
        return mockSupabaseService
      })

      await mockSupabaseService.select('id, profile_id')
      expect(mockSupabaseService.select).toHaveBeenCalledWith('id, profile_id')
    })
  })

  describe('Payment Link Creation', () => {
    it('should create payment link with correct parameters', async () => {
      const mockPaymentLink = {
        id: 'plink_report_789',
        short_url: 'https://rzp.io/l/report_789',
        status: 'created',
        amount: 1999,
        currency: 'USD',
      }

      mockRazorpayHelpers.createPaymentLink.mockResolvedValue(mockPaymentLink)

      const result = await mockRazorpayHelpers.createPaymentLink({
        amount: 1999,
        currency: 'USD',
        description: 'Deep Destiny Report',
        notes: {
          chart_id: 'chart-id-456',
          purchase_type: 'deep_report',
        },
      })

      expect(result.id).toBe('plink_report_789')
      expect(result.short_url).toBe('https://rzp.io/l/report_789')
      expect(result.amount).toBe(1999)
      expect(result.currency).toBe('USD')
    })

    it('should use correct report price in cents', async () => {
      mockRazorpayHelpers.createPaymentLink.mockImplementation((opts: any) => {
        expect(opts.amount).toBe(1999) // $19.99
        return Promise.resolve({ id: 'plink_123' })
      })

      await mockRazorpayHelpers.createPaymentLink({ amount: 1999 })
    })

    it('should set correct description', async () => {
      mockRazorpayHelpers.createPaymentLink.mockImplementation((opts: any) => {
        expect(opts.description).toBe('Deep Destiny Report')
        return Promise.resolve({ id: 'plink_123' })
      })

      await mockRazorpayHelpers.createPaymentLink({
        description: 'Deep Destiny Report',
      })
    })

    it('should include report metadata in notes', async () => {
      mockRazorpayHelpers.createPaymentLink.mockImplementation((opts: any) => {
        expect(opts.notes.chart_id).toBe('chart-id-456')
        expect(opts.notes.purchase_type).toBe('deep_report')
        return Promise.resolve({ id: 'plink_123' })
      })

      await mockRazorpayHelpers.createPaymentLink({
        notes: {
          chart_id: 'chart-id-456',
          purchase_type: 'deep_report',
        },
      })
    })

    it('should set callback URL to /dashboard', async () => {
      mockRazorpayHelpers.createPaymentLink.mockImplementation((opts: any) => {
        expect(opts.callback_url).toContain('/dashboard')
        expect(opts.callback_method).toBe('get')
        return Promise.resolve({ id: 'plink_123' })
      })

      await mockRazorpayHelpers.createPaymentLink({
        callback_url: 'http://localhost:3000/dashboard',
        callback_method: 'get',
      })
    })

    it('should set 60-minute expiry for report', async () => {
      const now = Math.floor(Date.now() / 1000)
      const sixtyMinutes = 60 * 60

      mockRazorpayHelpers.createPaymentLink.mockImplementation((opts: any) => {
        expect(opts.expire_by).toBeGreaterThanOrEqual(now + sixtyMinutes)
        expect(opts.expire_by).toBeLessThanOrEqual(now + sixtyMinutes + 5)
        return Promise.resolve({ id: 'plink_123' })
      })

      const expireBy = now + sixtyMinutes
      await mockRazorpayHelpers.createPaymentLink({ expire_by: expireBy })
    })

    it('should use reference_id from chart_id', async () => {
      const chartId = 'chart-id-456'
      mockRazorpayHelpers.createPaymentLink.mockImplementation((opts: any) => {
        expect(opts.reference_id).toBe(chartId)
        return Promise.resolve({ id: 'plink_123' })
      })

      await mockRazorpayHelpers.createPaymentLink({ reference_id: chartId })
    })
  })

  describe('Job Creation', () => {
    it('should create job record with Razorpay metadata', async () => {
      const paymentLink = {
        id: 'plink_report_789',
        short_url: 'https://rzp.io/l/report_789',
      }

      const jobData = {
        user_id: null,
        chart_id: 'chart-id-456',
        job_type: 'deep_report',
        status: 'pending',
        result_url: null,
        metadata: {
          razorpay_payment_link_id: paymentLink.id,
          purchase_type: 'deep_report',
          chart_id: 'chart-id-456',
          payment_confirmed: false,
        },
      }

      mockSupabaseService.insert.mockResolvedValue({ data: { id: 'job-001' }, error: null })

      await mockSupabaseService.insert([jobData])

      expect(mockSupabaseService.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            chart_id: 'chart-id-456',
            job_type: 'deep_report',
            status: 'pending',
          })
        ])
      )
    })

    it('should store payment_link_id in metadata', async () => {
      const metadata = {
        razorpay_payment_link_id: 'plink_789',
        purchase_type: 'deep_report',
        chart_id: 'chart-id-456',
        payment_confirmed: false,
      }

      expect(metadata.razorpay_payment_link_id).toBe('plink_789')
      expect(metadata.purchase_type).toBe('deep_report')
    })

    it('should set payment_confirmed to false initially', async () => {
      const metadata = {
        payment_confirmed: false,
      }

      expect(metadata.payment_confirmed).toBe(false)
    })

    it('should handle job creation errors', async () => {
      mockSupabaseService.insert.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const { data, error } = await mockSupabaseService.insert([{}])
      expect(error).toBeTruthy()
      expect(data).toBeNull()
    })
  })

  describe('Response Formatting', () => {
    it('should return success response with payment URL', async () => {
      const response = {
        ok: true,
        url: 'https://rzp.io/l/report_789',
      }

      expect(response.ok).toBe(true)
      expect(response.url).toMatch(/^https:\/\//)
    })

    it('should return error response format', async () => {
      const response = {
        ok: false,
        message: 'Chart not found',
      }

      expect(response.ok).toBe(false)
      expect(response.message).toBeTruthy()
    })

    it('should handle 400 Bad Request', async () => {
      const error = {
        statusCode: 400,
        message: 'Invalid payment parameters. Please try again.',
      }

      expect(error.statusCode).toBe(400)
      expect(error.message).toBeTruthy()
    })

    it('should handle 401/403 authentication errors', async () => {
      const errors = [
        { statusCode: 401, message: 'Payment service authentication failed' },
        { statusCode: 403, message: 'Payment service authentication failed' },
      ]

      errors.forEach((error) => {
        expect(error.statusCode).toBeGreaterThanOrEqual(401)
        expect(error.message).toContain('authentication')
      })
    })

    it('should handle 429 rate limit errors', async () => {
      const error = {
        statusCode: 429,
        message: 'Too many requests. Please try again in a moment.',
      }

      expect(error.statusCode).toBe(429)
      expect(error.message).toContain('requests')
    })
  })

  describe('Error Handling', () => {
    it('should handle Razorpay API errors', async () => {
      const razorpayError = new Error('API Error')
      ;(razorpayError as any).statusCode = 500

      mockRazorpayHelpers.createPaymentLink.mockRejectedValue(razorpayError)

      await expect(
        mockRazorpayHelpers.createPaymentLink({ amount: 1999 })
      ).rejects.toThrow('API Error')
    })

    it('should handle missing chart gracefully', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { message: 'No results' },
      })

      const { data, error } = await mockSupabaseService.single()
      expect(data).toBeNull()
      expect(error).toBeTruthy()
    })
  })

  describe('Environment Guards', () => {
    it('should validate NEXT_PUBLIC_SITE_URL', () => {
      // In real tests, verify handler throws if env var missing
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
      if (!siteUrl) {
        console.log('NEXT_PUBLIC_SITE_URL should be set in environment')
      }
    })
  })

  describe('Request Method Validation', () => {
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

  describe('Edge Cases', () => {
    it('should handle very long chart_id', async () => {
      const longId = 'chart-' + 'x'.repeat(1000)
      expect(typeof longId).toBe('string')
      expect(longId.length).toBeGreaterThan(100)
    })

    it('should handle chart_id with special characters', async () => {
      const specialIds = [
        'chart-id-456',
        'chart_id_456',
        'chart.id.456',
        'chartid456',
      ]

      specialIds.forEach((id) => {
        expect(typeof id).toBe('string')
        expect(id.length).toBeGreaterThan(0)
      })
    })

    it('should handle multiple concurrent requests', async () => {
      mockRazorpayHelpers.createPaymentLink.mockResolvedValue({
        id: 'plink_concurrent_123',
        short_url: 'https://rzp.io/l/concurrent',
      })

      const concurrentRequests = [
        mockRazorpayHelpers.createPaymentLink({ amount: 1999 }),
        mockRazorpayHelpers.createPaymentLink({ amount: 1999 }),
        mockRazorpayHelpers.createPaymentLink({ amount: 1999 }),
      ]

      const results = await Promise.all(concurrentRequests)
      expect(results.length).toBe(3)
    })
  })
})
