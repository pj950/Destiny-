import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { supabaseService } from '../../lib/supabase'
import { getGeminiClient } from '../../lib/gemini/client'
import { analyzeBaziInsights } from '../../lib/bazi-insights'
import { buildYearlyFlowPrompt, parseGeminiJsonResponse } from '../../lib/gemini'
import { processReportChunks } from '../../lib/rag'
import type { Chart, BaziReport } from '../../types/database'
import type { BaziChart } from '../../lib/bazi'

// Mock dependencies before importing worker
vi.mock('../../lib/supabase', () => ({
  supabaseService: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}))

vi.mock('../../lib/gemini/client', () => ({
  getGeminiClient: vi.fn(),
}))

vi.mock('../../lib/gemini', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    buildYearlyFlowPrompt: vi.fn(),
    parseGeminiJsonResponse: vi.fn(),
  }
})

vi.mock('../../lib/bazi-insights', () => ({
  analyzeBaziInsights: vi.fn(),
}))

vi.mock('../../lib/rag', () => ({
  processReportChunks: vi.fn(),
}))

// Mock GoogleGenerativeAI for deep report tests
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    constructor() {
      // Mock constructor
    }
    getGenerativeModel() {
      return {
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => 'Generated deep report text',
          },
        }),
      }
    }
  },
}))

// Mock process.exit to prevent test from exiting
const mockProcessExit = vi.fn()
vi.mock('process', () => ({
  exit: mockProcessExit,
}))

// Now import worker functions after mocking
const { processJob, processYearlyFlowReport, processDeepReport } = await import('../worker')

describe('Worker - Job Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    mockProcessExit.mockReset()
  })

  describe('processJob', () => {
    it('should route yearly_flow_report jobs correctly', async () => {
      const mockJob = {
        id: 'test-job-1',
        user_id: 'user-123',
        chart_id: 'chart-123',
        job_type: 'yearly_flow_report',
        status: 'pending' as const,
        result_url: null,
        metadata: { target_year: 2026 },
        created_at: '2024-01-01T00:00:00Z',
      }

      // Mock successful processing - we'll expect it to fail due to missing chart
      vi.mocked(supabaseService.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any)

      // The job should be marked as processing first, then fail when chart not found
      await expect(processJob(mockJob)).rejects.toThrow()
      
      // Verify that job status was updated to 'processing'
      expect(supabaseService.from).toHaveBeenCalledWith('jobs')
    })

    it('should route deep_report jobs correctly', async () => {
      const mockJob = {
        id: 'test-job-2',
        user_id: 'user-123',
        chart_id: 'chart-123',
        job_type: 'deep_report',
        status: 'pending' as const,
        result_url: null,
        metadata: null,
        created_at: '2024-01-01T00:00:00Z',
      }

      vi.mocked(supabaseService.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any)

      await expect(processJob(mockJob)).rejects.toThrow()
      
      // Verify that job status was updated to 'processing'
      expect(supabaseService.from).toHaveBeenCalledWith('jobs')
    })

    it('should reject unknown job types', async () => {
      const mockJob = {
        id: 'test-job-3',
        user_id: 'user-123',
        chart_id: 'chart-123',
        job_type: 'unknown_job_type',
        status: 'pending' as const,
        result_url: null,
        metadata: null,
        created_at: '2024-01-01T00:00:00Z',
      }

      vi.mocked(supabaseService.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any)

      await expect(processJob(mockJob)).rejects.toThrow('Unknown job type: unknown_job_type')
    })
  })

  describe('processYearlyFlowReport', () => {
    const mockJob = {
      id: 'yearly-job-1',
      user_id: 'user-123',
      chart_id: 'chart-123',
      job_type: 'yearly_flow_report',
      status: 'pending' as const,
      result_url: null,
      metadata: { target_year: 2026, subscription_tier: 'premium' },
      created_at: '2024-01-01T00:00:00Z',
    }

    const mockChart: Chart = {
      id: 'chart-123',
      profile_id: 'profile-123',
      chart_json: {
        meta: { lunar: { cYear: 1990 } },
      } as BaziChart,
      wuxing_scores: {},
      ai_summary: null,
      created_at: '2024-01-01T00:00:00Z',
    }

    const mockInsights = {
      // Mock insights structure
      test: 'insights',
    }

    const mockGeminiResponse = JSON.stringify({
      targetYear: 2026,
      energyIndex: [],
      doList: ['Do this', 'Do that'],
      dontList: ['Avoid this'],
      natalAnalysis: 'Birth chart analysis',
      decadeLuckAnalysis: 'Decade luck analysis',
      annualFlowAnalysis: 'Annual flow analysis',
      scorecard: { career: 85, wealth: 75 },
      keyDomains: { career: { theme: 'Career theme' } },
    })

    beforeEach(() => {
      // Mock analyzeBaziInsights
      vi.mocked(analyzeBaziInsights).mockReturnValue(mockInsights as any)

      // Mock Gemini functions
      vi.mocked(buildYearlyFlowPrompt).mockReturnValue('mock prompt')
      vi.mocked(getGeminiClient).mockReturnValue({
        generateText: vi.fn().mockResolvedValue(mockGeminiResponse),
      } as any)
      vi.mocked(parseGeminiJsonResponse).mockReturnValue(JSON.parse(mockGeminiResponse))
      vi.mocked(processReportChunks).mockResolvedValue(undefined)
    })

    it('should process yearly flow report successfully', async () => {
      // Mock chart loading
      vi.mocked(supabaseService.from).mockImplementation((table: string) => {
        if (table === 'charts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockChart, error: null }),
              }),
            }),
          } as any
        }
        if (table === 'bazi_reports') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'report-123' } as BaziReport,
                  error: null,
                }),
              }),
            }),
          } as any
        }
        if (table === 'jobs') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          } as any
        }
        return {} as any
      })

      // This should complete without throwing
      await expect(processYearlyFlowReport(mockJob)).resolves.toBeUndefined()
      
      // Verify key function calls
      expect(buildYearlyFlowPrompt).toHaveBeenCalled()
      expect(getGeminiClient).toHaveBeenCalled()
      expect(parseGeminiJsonResponse).toHaveBeenCalled()
      expect(processReportChunks).toHaveBeenCalledWith('report-123', expect.any(String))
    })

    it('should handle missing chart correctly', async () => {
      // Mock chart not found
      vi.mocked(supabaseService.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'No rows found' } }),
          }),
        }),
      } as any)

      await expect(processYearlyFlowReport(mockJob)).rejects.toThrow('Failed to load chart: chart-123')
    })

    it('should use default year when not provided', async () => {
      const jobWithoutYear = {
        ...mockJob,
        metadata: { subscription_tier: 'free' }, // No target_year
      }

      // Mock chart loading and report creation
      vi.mocked(supabaseService.from).mockImplementation((table: string) => {
        if (table === 'charts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockChart, error: null }),
              }),
            }),
          } as any
        }
        if (table === 'bazi_reports') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'report-123' } as BaziReport,
                  error: null,
                }),
              }),
            }),
          } as any
        }
        if (table === 'jobs') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          } as any
        }
        return {} as any
      })

      await expect(processYearlyFlowReport(jobWithoutYear)).resolves.toBeUndefined()
      
      // Should use current year
      const currentYear = new Date().getFullYear()
      expect(buildYearlyFlowPrompt).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), currentYear)
    })

    it('should handle RAG processing errors gracefully', async () => {
      // Mock RAG processing to fail
      vi.mocked(processReportChunks).mockRejectedValue(new Error('RAG failed'))

      // Mock chart loading and report creation
      vi.mocked(supabaseService.from).mockImplementation((table: string) => {
        if (table === 'charts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockChart, error: null }),
              }),
            }),
          } as any
        }
        if (table === 'bazi_reports') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'report-123' } as BaziReport,
                  error: null,
                }),
              }),
            }),
          } as any
        }
        if (table === 'jobs') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          } as any
        }
        return {} as any
      })

      // Should still complete successfully even if RAG fails
      await expect(processYearlyFlowReport(mockJob)).resolves.toBeUndefined()
    })
  })

  describe('processDeepReport', () => {
    const mockJob = {
      id: 'deep-job-1',
      user_id: 'user-123',
      chart_id: 'chart-123',
      job_type: 'deep_report',
      status: 'pending' as const,
      result_url: null,
      metadata: null,
      created_at: '2024-01-01T00:00:00Z',
    }

    const mockChart: Chart = {
      id: 'chart-123',
      profile_id: 'profile-123',
      chart_json: { test: 'data' } as BaziChart,
      wuxing_scores: {},
      ai_summary: null,
      created_at: '2024-01-01T00:00:00Z',
    }

    beforeEach(() => {
      // Mock processReportChunks
      vi.mocked(processReportChunks).mockResolvedValue(undefined)
    })

    it('should process deep report successfully', async () => {
      // Mock chart loading
      vi.mocked(supabaseService.from).mockImplementation((table: string) => {
        if (table === 'charts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockChart, error: null }),
              }),
            }),
          } as any
        }
        if (table === 'bazi_reports') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'report-123' } as BaziReport,
                  error: null,
                }),
              }),
            }),
          } as any
        }
        if (table === 'jobs') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          } as any
        }
        return {} as any
      })

      // Mock storage upload
      vi.mocked(supabaseService.storage.from).mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
      } as any)

      // Mock Gemini client
      vi.mocked(getGeminiClient).mockReturnValue({
        generateText: vi.fn().mockResolvedValue('Generated deep report text'),
      } as any)

      await expect(processDeepReport(mockJob)).resolves.toBeUndefined()
      
      // Verify key function calls
      expect(processReportChunks).toHaveBeenCalledWith('report-123', 'Generated deep report text')
      expect(supabaseService.storage.from).toHaveBeenCalledWith('reports')
    })

    it('should handle missing chart correctly', async () => {
      // Mock chart not found
      vi.mocked(supabaseService.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'No rows found' } }),
          }),
        }),
      } as any)

      await expect(processDeepReport(mockJob)).rejects.toThrow('Chart not found: chart-123')
    })
  })
})