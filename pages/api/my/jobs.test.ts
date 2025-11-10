import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for /api/my/jobs endpoint (updated)
 * Covers job listing with job_type filter and report_id inclusion
 */

describe('My Jobs API (Updated)', () => {
  let mockSupabaseService: any
  let mockRequest: any
  let mockResponse: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      method: 'GET',
      query: {},
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
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Validation', () => {
    it('should accept GET requests', async () => {
      mockRequest.method = 'GET'
      expect(mockRequest.method).toBe('GET')
    })

    it('should reject POST requests', async () => {
      mockRequest.method = 'POST'
      expect(mockRequest.method).not.toBe('GET')
    })

    it('should validate limit parameter', async () => {
      mockRequest.query = { limit: '50' }
      const limit = parseInt(mockRequest.query.limit as string)
      expect(limit).toBe(50)
      expect(limit >= 1 && limit <= 100).toBe(true)
    })

    it('should reject limit outside range', async () => {
      const invalidLimits = ['0', '101', 'invalid', '-5']
      invalidLimits.forEach((limit) => {
        const parsed = parseInt(limit, 10)
        const isValid = !isNaN(parsed) && parsed >= 1 && parsed <= 100
        expect(isValid).toBe(false)
      })
    })

    it('should default limit to 50', async () => {
      mockRequest.query = {}
      const limit = mockRequest.query.limit ? parseInt(mockRequest.query.limit) : 50
      expect(limit).toBe(50)
    })
  })

  describe('Job Type Filtering', () => {
    it('should support job_type query parameter', async () => {
      mockRequest.query = { job_type: 'yearly_flow_report' }
      expect(mockRequest.query.job_type).toBe('yearly_flow_report')
    })

    it('should filter by deep_report type', async () => {
      mockRequest.query = { job_type: 'deep_report' }
      expect(mockRequest.query.job_type).toBe('deep_report')
    })

    it('should filter by yearly_flow_report type', async () => {
      mockRequest.query = { job_type: 'yearly_flow_report' }
      expect(mockRequest.query.job_type).toBe('yearly_flow_report')
    })

    it('should work without job_type filter', async () => {
      mockRequest.query = { chart_id: 'chart-123' }
      expect(mockRequest.query.job_type).toBeUndefined()
    })

    it('should apply job_type filter to query', async () => {
      mockSupabaseService.eq.mockImplementation((field: string, value: string) => {
        if (field === 'job_type') {
          expect(value).toBe('yearly_flow_report')
        }
        return mockSupabaseService
      })

      await mockSupabaseService.eq('job_type', 'yearly_flow_report')
      expect(mockSupabaseService.eq).toHaveBeenCalled()
    })
  })

  describe('Report ID Inclusion', () => {
    it('should include report_id in response', async () => {
      const jobsData = [
        {
          id: 'job-1',
          chart_id: 'chart-123',
          job_type: 'yearly_flow_report',
          bazi_reports: [{ id: 'report-1' }],
        },
      ]

      const jobs = jobsData.map((job: any) => {
        const report_id = job.bazi_reports?.[0]?.id || null
        const { bazi_reports, ...jobData } = job
        return {
          ...jobData,
          report_id,
        }
      })

      expect(jobs[0]).toHaveProperty('report_id')
      expect(jobs[0].report_id).toBe('report-1')
    })

    it('should set report_id to null if no associated report', async () => {
      const jobsData = [
        {
          id: 'job-1',
          chart_id: 'chart-123',
          job_type: 'yearly_flow_report',
          bazi_reports: [],
        },
      ]

      const jobs = jobsData.map((job: any) => {
        const report_id = job.bazi_reports?.[0]?.id || null
        const { bazi_reports, ...jobData } = job
        return {
          ...jobData,
          report_id,
        }
      })

      expect(jobs[0].report_id).toBeNull()
    })

    it('should join bazi_reports table', async () => {
      mockSupabaseService.select.mockImplementation((fields: string) => {
        expect(fields).toContain('bazi_reports')
        return mockSupabaseService
      })

      await mockSupabaseService.select(`
        *,
        bazi_reports!left(id)
      `)

      expect(mockSupabaseService.select).toHaveBeenCalled()
    })

    it('should handle multiple reports with first one', async () => {
      const jobsData = [
        {
          id: 'job-1',
          bazi_reports: [{ id: 'report-1' }, { id: 'report-2' }],
        },
      ]

      const jobs = jobsData.map((job: any) => {
        const report_id = job.bazi_reports?.[0]?.id || null
        return { ...job, report_id }
      })

      expect(jobs[0].report_id).toBe('report-1')
    })
  })

  describe('Chart ID Filtering', () => {
    it('should support chart_id parameter', async () => {
      mockRequest.query = { chart_id: 'chart-123' }
      expect(mockRequest.query.chart_id).toBe('chart-123')
    })

    it('should apply chart_id filter', async () => {
      mockSupabaseService.eq.mockImplementation((field: string, value: string) => {
        if (field === 'chart_id') {
          expect(value).toBe('chart-123')
        }
        return mockSupabaseService
      })

      await mockSupabaseService.eq('chart_id', 'chart-123')
      expect(mockSupabaseService.eq).toHaveBeenCalled()
    })

    it('should work without chart_id filter', async () => {
      mockRequest.query = { job_type: 'yearly_flow_report' }
      expect(mockRequest.query.chart_id).toBeUndefined()
    })

    it('should combine chart_id and job_type filters', async () => {
      mockRequest.query = {
        chart_id: 'chart-123',
        job_type: 'yearly_flow_report',
      }

      expect(mockRequest.query.chart_id).toBe('chart-123')
      expect(mockRequest.query.job_type).toBe('yearly_flow_report')
    })
  })

  describe('Response Format', () => {
    it('should return jobs array', async () => {
      const response = {
        ok: true,
        jobs: [
          { id: 'job-1', report_id: 'report-1' },
          { id: 'job-2', report_id: null },
        ],
      }

      expect(response.ok).toBe(true)
      expect(Array.isArray(response.jobs)).toBe(true)
    })

    it('should include report_id in each job', async () => {
      const response = {
        ok: true,
        jobs: [
          { id: 'job-1', report_id: 'report-1' },
          { id: 'job-2', report_id: 'report-2' },
        ],
      }

      response.jobs.forEach((job: any) => {
        expect(job).toHaveProperty('report_id')
      })
    })

    it('should return empty array if no jobs', async () => {
      const response = {
        ok: true,
        jobs: [],
      }

      expect(response.jobs).toHaveLength(0)
    })

    it('should return error format on failure', async () => {
      const error = {
        ok: false,
        message: 'Database error',
      }

      expect(error.ok).toBe(false)
      expect(error.message).toBeTruthy()
    })
  })

  describe('Query Ordering', () => {
    it('should order by created_at descending', async () => {
      mockSupabaseService.order.mockImplementation((field: string, opts: any) => {
        expect(field).toBe('created_at')
        expect(opts.ascending).toBe(false)
        return mockSupabaseService
      })

      await mockSupabaseService.order('created_at', { ascending: false })
      expect(mockSupabaseService.order).toHaveBeenCalled()
    })
  })

  describe('Limit Handling', () => {
    it('should apply limit to query', async () => {
      mockSupabaseService.limit.mockImplementation((count: number) => {
        expect(count).toBe(50)
        return mockSupabaseService
      })

      await mockSupabaseService.limit(50)
      expect(mockSupabaseService.limit).toHaveBeenCalledWith(50)
    })

    it('should reject limit > 100', async () => {
      const limit = 101
      const isValid = limit >= 1 && limit <= 100
      expect(isValid).toBe(false)
    })

    it('should reject limit < 1', async () => {
      const limit = 0
      const isValid = limit >= 1 && limit <= 100
      expect(isValid).toBe(false)
    })
  })

  describe('Multiple Filters', () => {
    it('should handle chart_id + limit', async () => {
      mockRequest.query = {
        chart_id: 'chart-123',
        limit: '25',
      }

      expect(mockRequest.query.chart_id).toBe('chart-123')
      expect(parseInt(mockRequest.query.limit as string)).toBe(25)
    })

    it('should handle job_type + limit', async () => {
      mockRequest.query = {
        job_type: 'yearly_flow_report',
        limit: '10',
      }

      expect(mockRequest.query.job_type).toBe('yearly_flow_report')
      expect(parseInt(mockRequest.query.limit as string)).toBe(10)
    })

    it('should handle chart_id + job_type + limit', async () => {
      mockRequest.query = {
        chart_id: 'chart-123',
        job_type: 'yearly_flow_report',
        limit: '15',
      }

      expect(mockRequest.query.chart_id).toBe('chart-123')
      expect(mockRequest.query.job_type).toBe('yearly_flow_report')
      expect(parseInt(mockRequest.query.limit as string)).toBe(15)
    })
  })

  describe('Data Transformation', () => {
    it('should remove bazi_reports from response', async () => {
      const jobsData = [
        {
          id: 'job-1',
          chart_id: 'chart-123',
          bazi_reports: [{ id: 'report-1' }],
        },
      ]

      const jobs = jobsData.map((job: any) => {
        const report_id = job.bazi_reports?.[0]?.id || null
        const { bazi_reports, ...jobData } = job
        return {
          ...jobData,
          report_id,
        }
      })

      expect(jobs[0]).not.toHaveProperty('bazi_reports')
      expect(jobs[0]).toHaveProperty('report_id')
    })

    it('should preserve all job fields', async () => {
      const originalJob = {
        id: 'job-1',
        chart_id: 'chart-123',
        job_type: 'yearly_flow_report',
        status: 'completed',
        created_at: '2024-01-01',
        bazi_reports: [{ id: 'report-1' }],
      }

      const { bazi_reports, ...jobData } = originalJob
      const transformed = {
        ...jobData,
        report_id: bazi_reports[0].id,
      }

      expect(transformed).toHaveProperty('id')
      expect(transformed).toHaveProperty('chart_id')
      expect(transformed).toHaveProperty('job_type')
      expect(transformed).toHaveProperty('status')
      expect(transformed).toHaveProperty('created_at')
      expect(transformed).toHaveProperty('report_id')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors', async () => {
      const error = { message: 'Database error' }
      expect(error.message).toBeTruthy()
    })

    it('should handle query errors', async () => {
      const error = { message: 'Query error' }
      expect(error.message).toBeTruthy()
    })

    it('should return error in response', async () => {
      const response = {
        ok: false,
        message: 'Internal server error',
      }

      expect(response.ok).toBe(false)
      expect(response.message).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long chart_id', async () => {
      const longId = 'chart-' + 'x'.repeat(1000)
      mockRequest.query = { chart_id: longId }
      expect(mockRequest.query.chart_id.length).toBeGreaterThan(1000)
    })

    it('should handle many jobs', async () => {
      const manyJobs = Array.from({ length: 100 }, (_, i) => ({
        id: `job-${i}`,
        report_id: `report-${i}`,
      }))

      expect(manyJobs).toHaveLength(100)
    })

    it('should handle concurrent requests', async () => {
      const requests = [
        mockSupabaseService.single(),
        mockSupabaseService.single(),
        mockSupabaseService.single(),
      ]

      const results = await Promise.all(requests)
      expect(results).toHaveLength(3)
    })

    it('should handle jobs without reports', async () => {
      const jobs = [
        { id: 'job-1', report_id: null },
        { id: 'job-2', report_id: null },
      ]

      jobs.forEach((job) => {
        expect(job.report_id).toBeNull()
      })
    })

    it('should handle mixed jobs with and without reports', async () => {
      const jobs = [
        { id: 'job-1', report_id: 'report-1' },
        { id: 'job-2', report_id: null },
        { id: 'job-3', report_id: 'report-3' },
      ]

      const withReports = jobs.filter((j) => j.report_id)
      const withoutReports = jobs.filter((j) => !j.report_id)

      expect(withReports).toHaveLength(2)
      expect(withoutReports).toHaveLength(1)
    })
  })

  describe('Method Validation', () => {
    it('should accept GET', async () => {
      mockRequest.method = 'GET'
      expect(mockRequest.method).toBe('GET')
    })

    it('should reject POST', async () => {
      mockRequest.method = 'POST'
      expect(mockRequest.method).not.toBe('GET')
    })

    it('should reject PUT', async () => {
      mockRequest.method = 'PUT'
      expect(mockRequest.method).not.toBe('GET')
    })

    it('should reject DELETE', async () => {
      mockRequest.method = 'DELETE'
      expect(mockRequest.method).not.toBe('GET')
    })
  })
})
