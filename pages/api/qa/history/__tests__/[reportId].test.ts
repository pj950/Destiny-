/**
 * QA History API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../[reportId]'
import { supabaseService } from '../../../../../lib/supabase'
import { getConversationsForReport, getRetentionDays } from '../../../../../lib/qa-conversation'

// Mock dependencies
vi.mock('../../../../../lib/supabase')
vi.mock('../../../../../lib/qa-conversation')

const mockSupabaseService = vi.mocked(supabaseService)
const mockGetConversationsForReport = vi.mocked(getConversationsForReport)
const mockGetRetentionDays = vi.mocked(getRetentionDays)

describe('/api/qa/history/[reportId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Method validation', () => {
    it('should reject non-GET requests', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        query: { reportId: 'report123' }
      })

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
        method: 'GET',
        query: {}
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        ok: false,
        message: 'report_id is required'
      })
    })

    it('should reject invalid limit', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { reportId: 'report123', limit: 'invalid' }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        ok: false,
        message: 'limit must be between 1 and 50'
      })
    })

    it('should reject limit too high', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { reportId: 'report123', limit: '51' }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        ok: false,
        message: 'limit must be between 1 and 50'
      })
    })

    it('should reject limit too low', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { reportId: 'report123', limit: '0' }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(400)
      expect(JSON.parse(res._getData())).toEqual({
        ok: false,
        message: 'limit must be between 1 and 50'
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
        method: 'GET',
        query: { reportId: 'nonexistent' }
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
        method: 'GET',
        query: { reportId: 'report123' }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(500)
    })
  })

  describe('History retrieval', () => {
    beforeEach(() => {
      // Mock successful report lookup
      mockSupabaseService.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({ 
              data: { id: 'report123', title: 'Test Report', report_type: 'character_profile' }, 
              error: null 
            })
          })
        })
      } as any)
    })

    it('should return conversation history for free user', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          messages: [
            { role: 'user', content: 'Question 1', timestamp: '2024-01-15T00:00:00.000Z' },
            { role: 'assistant', content: 'Answer 1', timestamp: '2024-01-15T00:01:00.000Z', sources: [{ chunk_id: 1, similarity: 0.9 }] }
          ],
          last_message_at: '2024-01-15T00:01:00.000Z',
          retention_until: '2024-02-14T00:00:00.000Z'
        },
        {
          id: 'conv2',
          messages: [
            { role: 'user', content: 'Question 2', timestamp: '2024-01-14T00:00:00.000Z' },
            { role: 'assistant', content: 'Answer 2', timestamp: '2024-01-14T00:01:00.000Z' }
          ],
          last_message_at: '2024-01-14T00:01:00.000Z',
          retention_until: '2024-02-13T00:00:00.000Z'
        }
      ]

      mockGetConversationsForReport.mockResolvedValueOnce(mockConversations)
      mockGetRetentionDays.mockReturnValueOnce(30)

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          reportId: 'report123',
          subscription_tier: 'free',
          user_id: 'user123'
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.ok).toBe(true)
      expect(response.conversations).toHaveLength(2)
      expect(response.report_id).toBe('report123')
      expect(response.retention_days).toBe(30)
      expect(response.message).toContain('历史记录保留 30 天')
      
      // Verify conversation formatting
      const conv1 = response.conversations[0]
      expect(conv1.id).toBe('conv1')
      expect(conv1.messages).toHaveLength(2)
      expect(conv1.total_questions).toBe(1)
      expect(conv1.retention_until).toBe('2024-02-14T00:00:00.000Z')
      
      const userMessage = conv1.messages[0]
      expect(userMessage.role).toBe('user')
      expect(userMessage.content).toBe('Question 1')
      expect(userMessage.timestamp).toBe('2024-01-15T00:00:00.000Z')
      
      const assistantMessage = conv1.messages[1]
      expect(assistantMessage.role).toBe('assistant')
      expect(assistantMessage.sources).toEqual([{ chunk_id: 1, similarity: 0.9 }])
    })

    it('should return conversation history for VIP user without retention message', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          messages: [
            { role: 'user', content: 'Question 1', timestamp: '2024-01-15T00:00:00.000Z' },
            { role: 'assistant', content: 'Answer 1', timestamp: '2024-01-15T00:01:00.000Z' }
          ],
          last_message_at: '2024-01-15T00:01:00.000Z',
          retention_until: null // VIP has no retention limit
        }
      ]

      mockGetConversationsForReport.mockResolvedValueOnce(mockConversations)
      mockGetRetentionDays.mockReturnValueOnce(999)

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          reportId: 'report123',
          subscription_tier: 'vip',
          user_id: 'user123'
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.ok).toBe(true)
      expect(response.retention_days).toBe(999)
      expect(response.message).toBeUndefined()
      
      const conv1 = response.conversations[0]
      expect(conv1.retention_until).toBeUndefined()
    })

    it('should apply limit correctly', async () => {
      const mockConversations = Array.from({ length: 15 }, (_, i) => ({
        id: `conv${i}`,
        messages: [
          { role: 'user', content: `Question ${i}`, timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` },
          { role: 'assistant', content: `Answer ${i}`, timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T00:01:00.000Z` }
        ],
        last_message_at: `2024-01-${String(i + 1).padStart(2, '0')}T00:01:00.000Z`,
      }))

      mockGetConversationsForReport.mockResolvedValueOnce(mockConversations)
      mockGetRetentionDays.mockReturnValueOnce(30)

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          reportId: 'report123',
          subscription_tier: 'free',
          limit: '5'
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.conversations).toHaveLength(5)
      expect(response.conversations[0].id).toBe('conv0') // Should be ordered by last_message_at DESC
    })

    it('should handle empty conversations', async () => {
      mockGetConversationsForReport.mockResolvedValueOnce([])
      mockGetRetentionDays.mockReturnValueOnce(30)

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          reportId: 'report123',
          subscription_tier: 'free'
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      const response = JSON.parse(res._getData())
      expect(response.ok).toBe(true)
      expect(response.conversations).toHaveLength(0)
    })

    it('should handle anonymous user conversations', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          messages: [
            { role: 'user', content: 'Anonymous question', timestamp: '2024-01-15T00:00:00.000Z' },
            { role: 'assistant', content: 'Answer', timestamp: '2024-01-15T00:01:00.000Z' }
          ],
          last_message_at: '2024-01-15T00:01:00.000Z',
        }
      ]

      mockGetConversationsForReport.mockResolvedValueOnce(mockConversations)
      mockGetRetentionDays.mockReturnValueOnce(30)

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          reportId: 'report123',
          subscription_tier: 'free'
          // No user_id provided
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      expect(mockGetConversationsForReport).toHaveBeenCalledWith(null, 'report123', 'free')
    })

    it('should use default values for optional parameters', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          messages: [
            { role: 'user', content: 'Question', timestamp: '2024-01-15T00:00:00.000Z' },
            { role: 'assistant', content: 'Answer', timestamp: '2024-01-15T00:01:00.000Z' }
          ],
          last_message_at: '2024-01-15T00:01:00.000Z',
        }
      ]

      mockGetConversationsForReport.mockResolvedValueOnce(mockConversations)
      mockGetRetentionDays.mockReturnValueOnce(30)

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          reportId: 'report123'
          // No subscription_tier, user_id, or limit provided
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(200)
      expect(mockGetConversationsForReport).toHaveBeenCalledWith(null, 'report123', 'free')
      expect(mockGetRetentionDays).toHaveBeenCalledWith('free')
    })
  })

  describe('Error handling', () => {
    beforeEach(() => {
      mockSupabaseService.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({ 
              data: { id: 'report123', title: 'Test Report', report_type: 'character_profile' }, 
              error: null 
            })
          })
        })
      } as any)
    })

    it('should handle getConversationsForReport errors', async () => {
      mockGetConversationsForReport.mockRejectedValueOnce(new Error('Failed to fetch conversations'))

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          reportId: 'report123',
          subscription_tier: 'free'
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(500)
      const response = JSON.parse(res._getData())
      expect(response.ok).toBe(false)
      expect(response.message).toContain('Failed to retrieve conversation history')
    })

    it('should handle unexpected errors', async () => {
      mockGetConversationsForReport.mockImplementationOnce(() => {
        throw new Error('Unexpected error')
      })

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          reportId: 'report123',
          subscription_tier: 'free'
        }
      })

      await handler(req, res)
      
      expect(res._getStatusCode()).toBe(500)
      const response = JSON.parse(res._getData())
      expect(response.ok).toBe(false)
      expect(response.message).toContain('Unexpected error')
    })
  })

  describe('Message formatting', () => {
    beforeEach(() => {
      mockSupabaseService.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({ 
              data: { id: 'report123', title: 'Test Report', report_type: 'character_profile' }, 
              error: null 
            })
          })
        })
      } as any)
    })

    it('should handle messages without sources', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          messages: [
            { role: 'user', content: 'Question', timestamp: '2024-01-15T00:00:00.000Z' },
            { role: 'assistant', content: 'Answer', timestamp: '2024-01-15T00:01:00.000Z' }
          ],
          last_message_at: '2024-01-15T00:01:00.000Z',
        }
      ]

      mockGetConversationsForReport.mockResolvedValueOnce(mockConversations)
      mockGetRetentionDays.mockReturnValueOnce(30)

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          reportId: 'report123',
          subscription_tier: 'free'
        }
      })

      await handler(req, res)
      
      const response = JSON.parse(res._getData())
      const assistantMessage = response.conversations[0].messages[1]
      expect(assistantMessage.sources).toBeUndefined()
    })

    it('should calculate total_questions correctly', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          messages: [
            { role: 'user', content: 'Question 1', timestamp: '2024-01-15T00:00:00.000Z' },
            { role: 'assistant', content: 'Answer 1', timestamp: '2024-01-15T00:01:00.000Z' },
            { role: 'user', content: 'Question 2', timestamp: '2024-01-15T00:02:00.000Z' },
            { role: 'assistant', content: 'Answer 2', timestamp: '2024-01-15T00:03:00.000Z' },
            { role: 'user', content: 'Question 3', timestamp: '2024-01-15T00:04:00.000Z' },
            { role: 'assistant', content: 'Answer 3', timestamp: '2024-01-15T00:05:00.000Z' }
          ],
          last_message_at: '2024-01-15T00:05:00.000Z',
        }
      ]

      mockGetConversationsForReport.mockResolvedValueOnce(mockConversations)
      mockGetRetentionDays.mockReturnValueOnce(30)

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          reportId: 'report123',
          subscription_tier: 'free'
        }
      })

      await handler(req, res)
      
      const response = JSON.parse(res._getData())
      expect(response.conversations[0].total_questions).toBe(3)
    })
  })
})