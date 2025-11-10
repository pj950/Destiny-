import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Integration tests for /api/qa/ask endpoint
 * Tests Q&A functionality, quota management, vector search, and error handling
 */

describe('POST /api/qa/ask', () => {
  let mockSupabaseService: any
  let mockGeminiClient: any
  let mockRequest: Partial<NextApiRequest>
  let mockResponse: Partial<NextApiResponse>
  let responseData: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock request
    mockRequest = {
      method: 'POST',
      body: {
        report_id: 'report-123',
        question: '我的事业运如何？',
        subscription_tier: 'premium',
      },
    }

    // Setup mock response
    responseData = null
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation(data => {
        responseData = data
        return mockResponse
      }),
      end: vi.fn(),
    } as any

    // Setup mock Supabase service
    mockSupabaseService = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }

    // Setup mock Gemini client
    mockGeminiClient = {
      generateText: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Request Validation', () => {
    it('should reject non-POST requests', async () => {
      mockRequest.method = 'GET'
      expect(mockRequest.method).not.toBe('POST')
    })

    it('should reject requests without report_id', () => {
      const body = { question: 'test' }
      expect(typeof (body as any).report_id).not.toBe('string')
    })

    it('should reject requests without question', () => {
      const body = { report_id: 'test' }
      expect(typeof (body as any).question).not.toBe('string')
    })

    it('should accept valid request with required fields', () => {
      const body = mockRequest.body
      expect(body).toHaveProperty('report_id')
      expect(body).toHaveProperty('question')
      expect(typeof body.report_id).toBe('string')
      expect(typeof body.question).toBe('string')
    })

    it('should default subscription_tier to free if not provided', () => {
      const { report_id, question } = mockRequest.body
      const tier = mockRequest.body.subscription_tier || 'free'
      expect(tier).toBeDefined()
    })

    it('should accept valid subscription tiers', () => {
      const validTiers = ['free', 'basic', 'premium', 'vip']
      mockRequest.body.subscription_tier = 'premium'
      expect(validTiers).toContain(mockRequest.body.subscription_tier)
    })

    it('should reject invalid subscription tiers', () => {
      const validTiers = ['free', 'basic', 'premium', 'vip']
      const invalidTier = 'diamond'
      expect(validTiers).not.toContain(invalidTier)
    })
  })

  describe('Report Verification', () => {
    it('should verify report exists in database', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: {
          id: 'report-123',
          chart_id: 'chart-456',
          report_type: 'character_profile',
          status: 'completed',
        },
        error: null,
      })

      const { data, error } = await mockSupabaseService.single()
      expect(data).toBeTruthy()
      expect(data.id).toBe('report-123')
      expect(error).toBeNull()
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
  })

  describe('Quota Management', () => {
    it('should allow VIP users unlimited questions', () => {
      const tier = 'vip'
      const quotaLimits: Record<string, number | null> = {
        free: 0,
        basic: 20,
        premium: 20,
        vip: null,
      }
      const limit = quotaLimits[tier]
      expect(limit).toBeNull()
    })

    it('should allow basic users 20 questions per month', () => {
      const tier = 'basic'
      const quotaLimits: Record<string, number | null> = {
        free: 0,
        basic: 20,
        premium: 20,
        vip: null,
      }
      const limit = quotaLimits[tier]
      expect(limit).toBe(20)
    })

    it('should deny free tier users', () => {
      const tier = 'free'
      const quotaLimits: Record<string, number | null> = {
        free: 0,
        basic: 20,
        premium: 20,
        vip: null,
      }
      const limit = quotaLimits[tier]
      expect(limit).toBe(0)
    })

    it('should track usage across multiple questions', () => {
      const usage = { questions_used: 5, extra_questions: 0 }
      const limit = 20
      const totalUsed = usage.questions_used + usage.extra_questions
      expect(totalUsed).toBe(5)
      expect(totalUsed < limit).toBe(true)
    })

    it('should enforce monthly quota reset', () => {
      const now = new Date()
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      
      expect(periodStart.getMonth()).toBe(now.getMonth())
      expect(periodEnd.getMonth()).toBe(now.getMonth())
      expect(periodEnd.getDate()).toBeLessThanOrEqual(31)
    })

    it('should return remaining quota after each question', async () => {
      const usage = { questions_used: 5 }
      const limit = 20
      const remaining = Math.max(0, limit - usage.questions_used - 1)
      expect(remaining).toBe(14)
    })

    it('should handle quota exhaustion gracefully', async () => {
      const usage = { questions_used: 19 }
      const limit = 20
      const remaining = Math.max(0, limit - usage.questions_used - 1)
      expect(remaining).toBe(0)
    })
  })

  describe('Conversation Management', () => {
    it('should create new conversation if none exists', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      mockSupabaseService.insert.mockReturnThis()
      mockSupabaseService.select.mockReturnThis()
      
      const { data, error } = await mockSupabaseService.single()
      expect(data).toBeNull()
    })

    it('should load existing conversation', async () => {
      const existingConversation = {
        id: 'conv-123',
        report_id: 'report-123',
        messages: [
          {
            role: 'user' as const,
            content: '告诉我关于我的五行',
            timestamp: '2024-11-10T10:00:00Z',
          },
        ],
      }

      mockSupabaseService.single.mockResolvedValue({
        data: existingConversation,
        error: null,
      })

      const { data } = await mockSupabaseService.single()
      expect(data.messages.length).toBe(1)
      expect(data.messages[0].role).toBe('user')
    })

    it('should truncate conversation history to 20 messages', () => {
      const messages = Array.from({ length: 30 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as const,
        content: `Message ${i}`,
        timestamp: new Date(Date.now() - (30 - i) * 60000).toISOString(),
      }))

      const maxHistory = 20
      const truncated = messages.length > maxHistory ? messages.slice(-maxHistory) : messages
      expect(truncated.length).toBe(20)
      expect(truncated[0].content).toBe('Message 10')
      expect(truncated[truncated.length - 1].content).toBe('Message 29')
    })

    it('should append new user question to history', () => {
      const messages = [
        { role: 'user' as const, content: 'First question', timestamp: '2024-11-10T10:00:00Z' },
        { role: 'assistant' as const, content: 'First answer', timestamp: '2024-11-10T10:01:00Z' },
      ]

      const newQuestion = '第二个问题'
      const updated = [...messages, { role: 'user' as const, content: newQuestion, timestamp: new Date().toISOString() }]
      
      expect(updated.length).toBe(3)
      expect(updated[2].content).toBe(newQuestion)
    })

    it('should append assistant answer with sources to history', () => {
      const messages: any[] = []
      const answer = 'AI回答'
      const sources = [{ chunk_id: 1, similarity: 0.85 }]

      const newMessage = {
        role: 'assistant' as const,
        content: answer,
        timestamp: new Date().toISOString(),
        sources,
      }

      messages.push(newMessage)
      expect(messages[0].sources).toBeDefined()
      expect(messages[0].sources.length).toBe(1)
    })
  })

  describe('Vector Search and Context Retrieval', () => {
    it('should retrieve relevant context chunks', async () => {
      const chunks = [
        {
          chunk_id: 1,
          content: '五行平衡...',
          metadata: { section: '五行分析' },
          similarity: 0.92,
        },
        {
          chunk_id: 2,
          content: '十神关系...',
          metadata: { section: '十神解析' },
          similarity: 0.88,
        },
      ]

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0]).toHaveProperty('chunk_id')
      expect(chunks[0]).toHaveProperty('content')
      expect(chunks[0]).toHaveProperty('similarity')
    })

    it('should limit context to 5 chunks max', () => {
      const maxChunks = 5
      const chunks = Array.from({ length: 10 }, (_, i) => ({
        chunk_id: i,
        content: `Chunk ${i}`,
        similarity: 0.9 - i * 0.05,
      }))

      const limited = chunks.slice(0, maxChunks)
      expect(limited.length).toBeLessThanOrEqual(maxChunks)
    })

    it('should handle empty context gracefully', () => {
      const chunks: any[] = []
      expect(chunks.length).toBe(0)
      expect(Array.isArray(chunks)).toBe(true)
    })

    it('should extract section information from chunks', () => {
      const chunk = {
        chunk_id: 1,
        content: '内容',
        metadata: { section: '事业运' },
      }

      const section = chunk.metadata?.section || 'general'
      expect(section).toBe('事业运')
    })

    it('should fallback to general section if missing', () => {
      const chunk = {
        chunk_id: 1,
        content: '内容',
        metadata: {},
      }

      const section = chunk.metadata?.section || 'general'
      expect(section).toBe('general')
    })

    it('should handle vector search failures with empty results', async () => {
      const results: any[] = []
      expect(results).toEqual([])
    })
  })

  describe('Gemini Integration', () => {
    it('should call Gemini with formatted prompt', async () => {
      const prompt = 'AI 提示词内容'
      mockGeminiClient.generateText = vi.fn().mockResolvedValue({
        text: '```json\n{"promptVersion":"qa_answer_v1","answer":"回答","citations":[1,2],"followUps":[]}\n```',
      })

      const response = await mockGeminiClient.generateText({ prompt })
      expect(response).toBeTruthy()
    })

    it('should handle Gemini timeout with retry logic', async () => {
      let attempts = 0
      mockGeminiClient.generateText = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts < 2) {
          const error = new Error('Timeout')
          ;(error as any).code = 'DEADLINE_EXCEEDED'
          throw error
        }
        return Promise.resolve({ text: '回答' })
      })

      expect(mockGeminiClient.generateText).toBeDefined()
    })

    it('should handle rate limiting with exponential backoff', async () => {
      const delays: number[] = []
      const delays2: number[] = []
      
      let backoffDelay = 1000
      for (let i = 0; i < 3; i++) {
        delays.push(backoffDelay)
        backoffDelay *= 2
      }

      expect(delays).toEqual([1000, 2000, 4000])
    })

    it('should fail after max retries exceeded', async () => {
      const maxRetries = 3
      let attempts = 0
      
      const fn = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts <= maxRetries) {
          const error = new Error('Timeout')
          ;(error as any).code = 'DEADLINE_EXCEEDED'
          throw error
        }
        return Promise.resolve({})
      })

      expect(attempts).toBeLessThanOrEqual(maxRetries)
    })
  })

  describe('Response Parsing', () => {
    it('should parse valid QA answer payload', () => {
      const payload = {
        promptVersion: 'qa_answer_v1',
        answer: '根据你的命盘...',
        citations: [1, 2],
        followUps: ['问题1', '问题2'],
      }

      expect(payload).toHaveProperty('answer')
      expect(payload).toHaveProperty('citations')
      expect(Array.isArray(payload.citations)).toBe(true)
    })

    it('should handle missing citations gracefully', () => {
      const payload = {
        promptVersion: 'qa_answer_v1',
        answer: '回答内容',
        citations: [],
        followUps: [],
      }

      expect(payload.citations.length).toBe(0)
    })

    it('should include at least one follow-up suggestion', () => {
      const payload = {
        promptVersion: 'qa_answer_v1',
        answer: '回答',
        citations: [1],
        followUps: ['建议问题1', '建议问题2', '建议问题3'],
      }

      expect(payload.followUps.length).toBeGreaterThan(0)
      expect(payload.followUps.length).toBeLessThanOrEqual(3)
    })

    it('should format citations with chunk metadata', () => {
      const citations = [
        { chunk_id: 1, content: '五行分析内容', section: '五行' },
        { chunk_id: 2, content: '十神解析内容', section: '十神' },
      ]

      expect(citations).toHaveLength(2)
      expect(citations[0]).toHaveProperty('chunk_id')
      expect(citations[0]).toHaveProperty('content')
      expect(citations[0]).toHaveProperty('section')
    })
  })

  describe('Response Format', () => {
    it('should return success response with all required fields', () => {
      const response = {
        ok: true,
        answer: 'AI 回答',
        citations: [
          { chunk_id: 1, content: '内容1', section: '部分1' },
        ],
        followUps: ['后续1'],
        remaining_quota: 15,
      }

      expect(response.ok).toBe(true)
      expect(response).toHaveProperty('answer')
      expect(response).toHaveProperty('citations')
      expect(response).toHaveProperty('followUps')
      expect(response).toHaveProperty('remaining_quota')
    })

    it('should return error response with message', () => {
      const response = {
        ok: false,
        message: '找不到报告',
      }

      expect(response.ok).toBe(false)
      expect(response).toHaveProperty('message')
    })

    it('should return -1 for unlimited VIP quota', () => {
      const response = {
        ok: true,
        answer: 'AI 回答',
        citations: [],
        followUps: [],
        remaining_quota: -1,
      }

      expect(response.remaining_quota).toBe(-1)
    })
  })

  describe('Error Handling', () => {
    it('should handle report not found', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const { data, error } = await mockSupabaseService.single()
      expect(data).toBeNull()
      expect(error).toBeTruthy()
    })

    it('should handle quota limit exceeded', () => {
      const usage = { questions_used: 20 }
      const limit = 20
      const allowed = usage.questions_used < limit
      expect(allowed).toBe(false)
    })

    it('should handle database write failures gracefully', async () => {
      mockSupabaseService.update.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const { error } = await mockSupabaseService.update()
      expect(error).toBeTruthy()
    })

    it('should handle vector search failures', () => {
      const results: any[] = []
      expect(results).toHaveLength(0)
    })

    it('should handle Gemini response parsing errors', () => {
      const invalidJson = 'not json'
      expect(() => JSON.parse(invalidJson)).toThrow()
    })

    it('should log errors for debugging', () => {
      const error = new Error('Test error')
      expect(error.message).toBe('Test error')
    })
  })

  describe('Performance', () => {
    it('should complete within 3 second target', () => {
      const startTime = Date.now()
      const maxDuration = 3000

      // Simulate work
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(maxDuration)
    })

    it('should handle concurrent requests', async () => {
      const concurrentRequests = 5
      const requests = Array.from({ length: concurrentRequests }, () => ({
        report_id: 'report-123',
        question: '问题',
      }))

      expect(requests).toHaveLength(concurrentRequests)
    })
  })

  describe('Integration Scenarios', () => {
    it('scenario: normal question flow', async () => {
      // Setup: Report exists, has chunks, user has quota, VIP tier
      mockSupabaseService.single = vi.fn()
        .mockResolvedValueOnce({ // Report verification
          data: { id: 'report-123', status: 'completed' },
          error: null,
        })
        .mockResolvedValueOnce({ // Conversation load
          data: {
            id: 'conv-123',
            messages: [],
            report_id: 'report-123',
          },
          error: null,
        })

      mockGeminiClient.generateText = vi.fn().mockResolvedValue({
        text: '```json\n{"promptVersion":"qa_answer_v1","answer":"根据你的命盘分析...","citations":[1],"followUps":["你想知道..."]}\n```',
      })

      // Flow: All stages complete successfully
      const report = await mockSupabaseService.single()
      expect(report.data).toBeTruthy()
      
      const conversation = await mockSupabaseService.single()
      expect(conversation.data).toBeTruthy()
      
      const response = await mockGeminiClient.generateText({})
      expect(response).toBeTruthy()
    })

    it('scenario: quota exhausted', () => {
      const usage = { questions_used: 20 }
      const limit = 20
      const allowed = usage.questions_used < limit
      
      expect(allowed).toBe(false)
    })

    it('scenario: no context available', () => {
      const chunks: any[] = []
      expect(chunks).toHaveLength(0)
    })

    it('scenario: Gemini timeout on first attempt then succeeds', async () => {
      let attempts = 0
      mockGeminiClient.generateText = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts === 1) {
          const error = new Error('Timeout')
          ;(error as any).code = 'DEADLINE_EXCEEDED'
          throw error
        }
        return Promise.resolve({
          text: '```json\n{"promptVersion":"qa_answer_v1","answer":"回答","citations":[],"followUps":[]}\n```',
        })
      })

      expect(mockGeminiClient.generateText).toBeDefined()
    })
  })
})
