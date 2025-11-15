/**
 * QA Ask API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../ask'
import { supabaseService } from '../../../../lib/supabase'
import { getGeminiClient } from '../../../../lib/gemini/client'
import { checkQuestionQuota, getOrCreateConversation, incrementQuestionUsage, addMessageToConversation } from '../../../../lib/qa-conversation'
import { searchQaContextChunks, validateSearchResults, extractQaContextChunks, formatCitations, generateFollowUpQuestions } from '../../../../lib/rag'

// Mock dependencies
vi.mock('../../../../lib/supabase')
vi.mock('../../../../lib/gemini/client')
vi.mock('../../../../lib/qa-conversation')
vi.mock('../../../../lib/rag')

const mockSupabaseService = vi.mocked(supabaseService)
const mockGetGeminiClient = vi.mocked(getGeminiClient)
const mockCheckQuestionQuota = vi.mocked(checkQuestionQuota)
const mockGetOrCreateConversation = vi.mocked(getOrCreateConversation)
const mockIncrementQuestionUsage = vi.mocked(incrementQuestionUsage)
const mockAddMessageToConversation = vi.mocked(addMessageToConversation)
const mockSearchQaContextChunks = vi.mocked(searchQaContextChunks)
const mockValidateSearchResults = vi.mocked(validateSearchResults)
const mockExtractQaContextChunks = vi.mocked(extractQaContextChunks)
const mockFormatCitations = vi.mocked(formatCitations)
const mockGenerateFollowUpQuestions = vi.mocked(generateFollowUpQuestions)

describe('/api/qa/ask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Method validation', () => {
    it('should reject non-POST requests', async () => {
      const { req, res } = createMocks({ method: 'GET' })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(405)
      expect(JSON.parse(res._getData())).toEqual({
        ok: false,
        message: 'Method not allowed'
      })
    })
  })

  describe('Request validation', () => {
    it('should reject missing report_id', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: { question: 'Test question' }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        ok: false,
        message: 'report_id is required'
      })
    })

    it('should reject missing question', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: { report_id: 'report123' }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        ok: false,
        message: 'question is required and cannot be empty'
      })
    })

    it('should reject empty question', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: { report_id: 'report123', question: '   ' }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        ok: false,
        message: 'question is required and cannot be empty'
      })
    })

    it('should reject too long question', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: { 
          report_id: 'report123', 
          question: 'a'.repeat(501) 
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        ok: false,
        message: 'question must be 500 characters or less'
      })
    })
  })

  describe('Report validation', () => {
    it('should reject non-existent report', async () => {
      mockSupabaseService.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
          })
        })
      } as any)

      const { req, res } = createMocks({
        method: 'POST',
        body: { report_id: 'nonexistent', question: 'Test question?' }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(404)
      expect(JSON.parse(res._getData())).toEqual({
        ok: false,
        message: 'Report not found'
      })
    })

    it('should handle database errors gracefully', async () => {
      mockSupabaseService.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockRejectedValueOnce(new Error('Database connection failed'))
          })
        })
      } as any)

      const { req, res } = createMocks({
        method: 'POST',
        body: { report_id: 'report123', question: 'Test question?' }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(500)
    })
  })

  describe('Quota checking', () => {
    beforeEach(() => {
      // Mock successful report lookup
      mockSupabaseService.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({ 
              data: { id: 'report123', title: 'Test Report' }, 
              error: null 
            })
          })
        })
      } as any)
    })

    it('should reject when quota exceeded', async () => {
      mockCheckQuestionQuota.mockResolvedValueOnce({
        hasQuota: false,
        questionsUsed: 5,
        questionsLimit: 5,
        canPurchase: true
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: { 
          report_id: 'report123', 
          question: 'Test question?',
          subscription_tier: 'free'
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(429)
      const response = JSON.parse(res._getData())
      expect(response.ok).toBe(false)
      expect(response.quotaUsed).toEqual({
        used: 5,
        limit: 5,
        remaining: 0
      })
      expect(response.upgradeHint).toContain('升级')
    })

    it('should allow questions when quota available', async () => {
      mockCheckQuestionQuota.mockResolvedValueOnce({
        hasQuota: true,
        questionsUsed: 2,
        questionsLimit: 5,
        canPurchase: true
      })

      // Mock the rest of the flow
      mockGetOrCreateConversation.mockResolvedValueOnce({
        id: 'conv123',
        messages: []
      })

      mockSearchQaContextChunks.mockResolvedValueOnce([])
      mockValidateSearchResults.mockReturnValueOnce([])
      mockExtractQaContextChunks.mockReturnValueOnce([])

      const { req, res } = createMocks({
        method: 'POST',
        body: { 
          report_id: 'report123', 
          question: 'Test question?',
          subscription_tier: 'free'
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      expect(mockCheckQuestionQuota).toHaveBeenCalledWith('anonymous', 'report123', 'free')
    })
  })

  describe('Question processing', () => {
    beforeEach(() => {
      // Mock successful setup
      mockSupabaseService.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({ 
              data: { id: 'report123', title: 'Test Report' }, 
              error: null 
            })
          })
        })
      } as any)

      mockCheckQuestionQuota.mockResolvedValueOnce({
        hasQuota: true,
        questionsUsed: 2,
        questionsLimit: 5,
        canPurchase: true
      })

      mockGetOrCreateConversation.mockResolvedValueOnce({
        id: 'conv123',
        messages: []
      })
    })

    it('should handle no relevant content found', async () => {
      mockSearchQaContextChunks.mockResolvedValueOnce([])
      mockValidateSearchResults.mockReturnValueOnce([])
      mockExtractQaContextChunks.mockReturnValueOnce([])

      const { req, res } = createMocks({
        method: 'POST',
        body: { 
          report_id: 'report123', 
          question: 'Test question?',
          subscription_tier: 'free'
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.ok).toBe(true)
      expect(response.answer).toContain('没有找到与您问题相关的内容')
      expect(response.citations).toEqual([])
      expect(response.followUps).toHaveLength(3)
      expect(mockIncrementQuestionUsage).toHaveBeenCalled()
      expect(mockAddMessageToConversation).toHaveBeenCalledTimes(2) // User + assistant messages
    })

    it('should process question with relevant content', async () => {
      const mockSearchResults = [
        { id: 1, content: 'Relevant content 1', similarity: 0.9, metadata: {} },
        { id: 2, content: 'Relevant content 2', similarity: 0.8, metadata: {} },
      ]

      const mockContextChunks = [
        { id: 1, content: 'Relevant content 1', metadata: {}, similarity: 0.9 },
        { id: 2, content: 'Relevant content 2', metadata: {}, similarity: 0.8 },
      ]

      const mockGeminiResponse = {
        text: () => JSON.stringify({
          promptVersion: 'qa_answer_v1',
          answer: '根据您的命盘分析，您的性格特点...',
          citations: [1, 2],
          followUps: ['能详细解释一下吗？', '有什么建议吗？']
        })
      }

      mockSearchQaContextChunks.mockResolvedValueOnce(mockSearchResults)
      mockValidateSearchResults.mockReturnValueOnce(mockSearchResults)
      mockExtractQaContextChunks.mockReturnValueOnce(mockContextChunks)
      mockFormatCitations.mockReturnValueOnce([1, 2])
      mockGenerateFollowUpQuestions.mockReturnValueOnce(['能详细解释一下吗？', '有什么建议吗？'])

      const mockClient = {
        generateContent: vi.fn().mockResolvedValue(mockGeminiResponse)
      }
      mockGetGeminiClient.mockReturnValue(mockClient)

      const { req, res } = createMocks({
        method: 'POST',
        body: { 
          report_id: 'report123', 
          question: '我的性格怎么样？',
          subscription_tier: 'free'
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.ok).toBe(true)
      expect(response.answer).toBe('根据您的命盘分析，您的性格特点...')
      expect(response.citations).toEqual([1, 2])
      expect(response.followUps).toHaveLength(2)
      expect(response.conversationId).toBe('conv123')
      expect(response.quotaUsed).toEqual({
        used: 3,
        limit: 5,
        remaining: 2
      })
      expect(mockIncrementQuestionUsage).toHaveBeenCalled()
      expect(mockAddMessageToConversation).toHaveBeenCalledTimes(2)
    })

    it('should include upgrade hint for free users approaching limit', async () => {
      mockSearchQaContextChunks.mockResolvedValueOnce([])
      mockValidateSearchResults.mockReturnValueOnce([])
      mockExtractQaContextChunks.mockReturnValueOnce([])

      mockCheckQuestionQuota.mockResolvedValueOnce({
        hasQuota: true,
        questionsUsed: 4, // Close to limit
        questionsLimit: 5,
        canPurchase: true
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: { 
          report_id: 'report123', 
          question: 'Test question?',
          subscription_tier: 'free'
        }
      })

      await handler(req, res)
      
      const response = JSON.parse(res._getData())
      expect(response.upgradeHint).toContain('免费提问次数即将用完')
    })

    it('should not include upgrade hint for premium users', async () => {
      mockSearchQaContextChunks.mockResolvedValueOnce([])
      mockValidateSearchResults.mockReturnValueOnce([])
      mockExtractQaContextChunks.mockReturnValueOnce([])

      mockCheckQuestionQuota.mockResolvedValueOnce({
        hasQuota: true,
        questionsUsed: 48, // Close to limit
        questionsLimit: 50,
        canPurchase: true
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: { 
          report_id: 'report123', 
          question: 'Test question?',
          subscription_tier: 'premium'
        }
      })

      await handler(req, res)
      
      const response = JSON.parse(res._getData())
      expect(response.upgradeHint).toBeUndefined()
    })
  })

  describe('Error handling', () => {
    beforeEach(() => {
      mockSupabaseService.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({ 
              data: { id: 'report123', title: 'Test Report' }, 
              error: null 
            })
          })
        })
      } as any)

      mockCheckQuestionQuota.mockResolvedValueOnce({
        hasQuota: true,
        questionsUsed: 2,
        questionsLimit: 5,
        canPurchase: true
      })

      mockGetOrCreateConversation.mockResolvedValueOnce({
        id: 'conv123',
        messages: []
      })
    })

    it('should handle Gemini API errors', async () => {
      mockSearchQaContextChunks.mockResolvedValueOnce([
        { id: 1, content: 'Content', similarity: 0.9, metadata: {} }
      ])
      mockValidateSearchResults.mockReturnValueOnce([
        { id: 1, content: 'Content', similarity: 0.9, metadata: {} }
      ])
      mockExtractQaContextChunks.mockReturnValueOnce([
        { id: 1, content: 'Content', metadata: {}, similarity: 0.9 }
      ])

      const mockClient = {
        generateContent: vi.fn().mockRejectedValue(new Error('Gemini API timeout'))
      }
      mockGetGeminiClient.mockReturnValue(mockClient)

      const { req, res } = createMocks({
        method: 'POST',
        body: { 
          report_id: 'report123', 
          question: 'Test question?',
          subscription_tier: 'free'
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(500)
    })

    it('should handle JSON parsing errors', async () => {
      mockSearchQaContextChunks.mockResolvedValueOnce([
        { id: 1, content: 'Content', similarity: 0.9, metadata: {} }
      ])
      mockValidateSearchResults.mockReturnValueOnce([
        { id: 1, content: 'Content', similarity: 0.9, metadata: {} }
      ])
      mockExtractQaContextChunks.mockReturnValueOnce([
        { id: 1, content: 'Content', metadata: {}, similarity: 0.9 }
      ])

      const mockGeminiResponse = {
        text: () => 'Invalid JSON response'
      }

      const mockClient = {
        generateContent: vi.fn().mockResolvedValue(mockGeminiResponse)
      }
      mockGetGeminiClient.mockReturnValue(mockClient)

      const { req, res } = createMocks({
        method: 'POST',
        body: { 
          report_id: 'report123', 
          question: 'Test question?',
          subscription_tier: 'free'
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(500)
    })
  })
})