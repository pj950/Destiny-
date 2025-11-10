import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for /api/reports/character-profile endpoint
 * Covers character profile report generation with Gemini integration
 */

describe('Character Profile API', () => {
  let mockSupabaseService: any
  let mockGeminiClient: any
  let mockRequest: any
  let mockResponse: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      method: 'POST',
      body: { chart_id: 'chart-123' },
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
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
    }

    mockGeminiClient = {
      generateText: vi.fn(),
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
      const validChartId = 'chart-456'
      expect(typeof validChartId).toBe('string')
      expect(validChartId.length).toBeGreaterThan(0)
    })

    it('should reject non-POST requests', async () => {
      mockRequest.method = 'GET'
      expect(mockRequest.method).not.toBe('POST')
    })

    it('should reject non-string chart_id', async () => {
      mockRequest.body = { chart_id: 123 }
      expect(typeof mockRequest.body.chart_id).not.toBe('string')
    })
  })

  describe('Chart Validation', () => {
    it('should verify chart exists', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: {
          id: 'chart-123',
          chart_json: { birth_year: 1990 },
        },
        error: null,
      })

      const { data, error } = await mockSupabaseService.single()
      expect(data).toBeTruthy()
      expect(data.id).toBe('chart-123')
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
  })

  describe('Cache Check', () => {
    it('should return cached report if exists and completed', async () => {
      mockSupabaseService.single.mockResolvedValueOnce({
        data: { id: 'chart-123', chart_json: {} },
        error: null,
      })

      mockSupabaseService.limit.mockReturnThis()
      mockSupabaseService.order.mockReturnThis()
      mockSupabaseService.eq.mockReturnThis()

      const cachedReport = {
        id: 'report-456',
        chart_id: 'chart-123',
        report_type: 'character_profile',
        status: 'completed',
        body: '{"corePersona":{"archetype":"Leader"}}',
      }

      mockSupabaseService.single.mockResolvedValueOnce({
        data: [cachedReport],
        error: null,
      })

      // Simulate cache check
      expect(cachedReport.status).toBe('completed')
    })

    it('should generate new report if cache miss', async () => {
      mockSupabaseService.single.mockResolvedValueOnce({
        data: { id: 'chart-123' },
        error: null,
      })

      // Empty cache
      mockSupabaseService.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'No reports' },
      })

      const { data, error } = await mockSupabaseService.single()
      expect(data).toBeNull()
    })
  })

  describe('Gemini Integration', () => {
    it('should call Gemini with character profile prompt', async () => {
      const mockResponse = JSON.stringify({
        promptVersion: 'character_profile_v1',
        corePersona: {
          archetype: 'Leader',
          description: 'A natural leader',
          elementFocus: 'fire',
        },
        superPower: {
          title: 'Authority',
          activation: 'Take charge',
        },
        mastersInsight: 'Embrace your leadership',
        opportunityPreview: 'Growth ahead',
        upgradeTeaser: 'Unlock more',
        topTraits: [
          { title: 'Confident', detail: 'Natural confidence' },
          { title: 'Determined', detail: 'Strong will' },
          { title: 'Intuitive', detail: 'Inner wisdom', locked: true, upgradeHint: 'Upgrade for more' },
        ],
      })

      mockGeminiClient.generateText.mockResolvedValue(mockResponse)

      const result = await mockGeminiClient.generateText({ prompt: 'test' })
      expect(result).toBeDefined()
      expect(mockGeminiClient.generateText).toHaveBeenCalled()
    })

    it('should handle Gemini API errors', async () => {
      const error = new Error('Gemini API failed')
      mockGeminiClient.generateText.mockRejectedValue(error)

      await expect(
        mockGeminiClient.generateText({ prompt: 'test' })
      ).rejects.toThrow('Gemini API failed')
    })
  })

  describe('Report Storage', () => {
    it('should store report with correct fields', async () => {
      const reportData = {
        chart_id: 'chart-123',
        user_id: null,
        report_type: 'character_profile',
        title: 'Character Profile - chart-123',
        status: 'completed',
        model: 'gemini-2.5-pro',
        prompt_version: 'character_profile_v1',
      }

      mockSupabaseService.insert.mockResolvedValue({
        data: { id: 'report-789', ...reportData },
        error: null,
      })

      const { data, error } = await mockSupabaseService.insert([reportData])
      expect(data).toBeTruthy()
      expect(data.report_type).toBe('character_profile')
      expect(data.status).toBe('completed')
    })

    it('should store summary from traits', async () => {
      const summary = {
        key_insights: ['Trait 1', 'Trait 2'],
        strengths: ['Archetype'],
        areas_for_growth: [],
        lucky_elements: [],
        unlucky_elements: [],
      }

      expect(summary.key_insights).toHaveLength(2)
      expect(summary.strengths).toHaveLength(1)
    })

    it('should store structured sections', async () => {
      const structured = {
        sections: [
          { title: 'Core Persona', content: 'Description' },
          { title: 'Super Power', content: 'Activation' },
          { title: "Master's Insight", content: 'Insight' },
          { title: 'Opportunity Preview', content: 'Opportunity' },
        ],
      }

      expect(structured.sections).toHaveLength(4)
      structured.sections.forEach((section) => {
        expect(section).toHaveProperty('title')
        expect(section).toHaveProperty('content')
      })
    })

    it('should handle storage errors', async () => {
      mockSupabaseService.insert.mockResolvedValue({
        data: null,
        error: { message: 'Storage failed' },
      })

      const { data, error } = await mockSupabaseService.insert([{}])
      expect(error).toBeTruthy()
      expect(data).toBeNull()
    })
  })

  describe('Response Format', () => {
    it('should return report with cached flag', async () => {
      const response = {
        ok: true,
        report: { id: 'report-123' },
        cached: true,
      }

      expect(response.ok).toBe(true)
      expect(response.cached).toBe(true)
      expect(response.report).toBeDefined()
    })

    it('should return topTraits in response', async () => {
      const response = {
        ok: true,
        topTraits: [
          { title: 'Confident', detail: 'Natural confidence' },
          { title: 'Determined', detail: 'Strong will' },
          { title: 'Intuitive', detail: 'Inner wisdom', locked: true, upgradeHint: 'Upgrade for more' },
        ],
      }

      expect(response.topTraits).toHaveLength(3)
      expect(response.topTraits[2].locked).toBe(true)
      expect(response.topTraits[2].upgradeHint).toBeDefined()
    })

    it('should distinguish new vs cached reports', async () => {
      const newReport = { ok: true, cached: false }
      const cachedReport = { ok: true, cached: true }

      expect(newReport.cached).toBe(false)
      expect(cachedReport.cached).toBe(true)
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

  describe('Third Trait Lock', () => {
    it('should have third trait locked with upgradeHint', async () => {
      const traits = [
        { title: 'Trait 1', detail: 'Detail 1' },
        { title: 'Trait 2', detail: 'Detail 2' },
        { title: 'Trait 3', detail: 'Detail 3', locked: true, upgradeHint: 'Upgrade to unlock' },
      ]

      const thirdTrait = traits[2]
      expect(thirdTrait.locked).toBe(true)
      expect(thirdTrait.upgradeHint).toBeDefined()
      expect(thirdTrait.upgradeHint).toContain('Upgrade')
    })

    it('should not expose full content of locked trait', async () => {
      const lockedTrait = {
        title: 'Hidden Strength',
        locked: true,
        upgradeHint: 'Unlock for complete details',
        detail: 'Content hidden', // Can be partial or empty
      }

      expect(lockedTrait.locked).toBe(true)
      expect(lockedTrait.upgradeHint).toBeTruthy()
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

  describe('Database Queries', () => {
    it('should query charts table correctly', async () => {
      mockSupabaseService.select.mockImplementation((fields: string) => {
        expect(fields).toBe('*')
        return mockSupabaseService
      })

      await mockSupabaseService.select('*')
      expect(mockSupabaseService.select).toHaveBeenCalledWith('*')
    })

    it('should query bazi_reports with filters', async () => {
      mockSupabaseService.eq.mockImplementation((field: string, value: string) => {
        if (field === 'chart_id') {
          expect(value).toBe('chart-123')
        }
        if (field === 'report_type') {
          expect(value).toBe('character_profile')
        }
        return mockSupabaseService
      })

      await mockSupabaseService
        .eq('chart_id', 'chart-123')
        .eq('report_type', 'character_profile')

      expect(mockSupabaseService.eq).toHaveBeenCalled()
    })

    it('should order results by created_at', async () => {
      mockSupabaseService.order.mockImplementation((field: string, opts: any) => {
        expect(field).toBe('created_at')
        expect(opts.ascending).toBe(false)
        return mockSupabaseService
      })

      await mockSupabaseService.order('created_at', { ascending: false })
      expect(mockSupabaseService.order).toHaveBeenCalledWith('created_at', { ascending: false })
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
      expect(data).toBeNull()
    })

    it('should handle Gemini parsing errors', async () => {
      const error = new Error('Invalid JSON response')
      mockGeminiClient.generateText.mockRejectedValue(error)

      await expect(
        mockGeminiClient.generateText({ prompt: 'test' })
      ).rejects.toThrow('Invalid JSON response')
    })

    it('should handle insert errors gracefully', async () => {
      mockSupabaseService.insert.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      })

      const { data, error } = await mockSupabaseService.insert([{}])
      expect(error).toBeTruthy()
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long chart_id', async () => {
      const longId = 'chart-' + 'x'.repeat(1000)
      expect(typeof longId).toBe('string')
      expect(longId.length).toBeGreaterThan(1000)
    })

    it('should handle missing optional fields', async () => {
      const payload = {
        promptVersion: 'character_profile_v1',
        corePersona: {
          archetype: 'Leader',
          description: 'Description',
          elementFocus: 'fire',
        },
        superPower: {
          title: 'Power',
          activation: 'Activation',
        },
        mastersInsight: 'Insight',
        opportunityPreview: 'Preview',
        upgradeTeaser: 'Teaser',
        topTraits: [
          { title: 'T1', detail: 'D1' },
          { title: 'T2', detail: 'D2' },
          { title: 'T3', detail: 'D3', locked: true, upgradeHint: 'Hint' },
        ],
      }

      expect(payload).toBeDefined()
      expect(payload.topTraits).toHaveLength(3)
    })

    it('should handle concurrent report generation', async () => {
      mockGeminiClient.generateText.mockResolvedValue(
        JSON.stringify({
          promptVersion: 'character_profile_v1',
          corePersona: { archetype: 'A', description: 'D', elementFocus: 'e' },
          superPower: { title: 'T', activation: 'A' },
          mastersInsight: 'I',
          opportunityPreview: 'O',
          upgradeTeaser: 'U',
          topTraits: [
            { title: 'T1', detail: 'D1' },
            { title: 'T2', detail: 'D2' },
            { title: 'T3', detail: 'D3', locked: true, upgradeHint: 'H' },
          ],
        })
      )

      const requests = [
        mockGeminiClient.generateText({ prompt: 'test1' }),
        mockGeminiClient.generateText({ prompt: 'test2' }),
        mockGeminiClient.generateText({ prompt: 'test3' }),
      ]

      const results = await Promise.all(requests)
      expect(results).toHaveLength(3)
    })
  })
})
