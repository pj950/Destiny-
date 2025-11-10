/**
 * QA Conversation Management Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  getQuestionLimit,
  getRetentionDays,
  calculateRetentionUntil,
  checkQuestionQuota,
  incrementQuestionUsage,
  getOrCreateConversation,
  trimConversationMessages,
  addMessageToConversation,
  getConversationsForReport,
  cleanupExpiredConversations
} from '../qa-conversation'
import { supabaseService } from '../supabase'
import type { SubscriptionTier, QAConversation, ConversationMessage } from '../../types/database'

// Mock Supabase
vi.mock('../supabase', () => ({
  supabaseService: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          gt: vi.fn(),
          lt: vi.fn(),
          or: vi.fn(),
          order: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        lt: vi.fn(() => ({
          select: vi.fn(),
        })),
      })),
    })),
  },
}))

describe('QA Conversation Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getQuestionLimit', () => {
    it('should return correct limits for each tier', () => {
      expect(getQuestionLimit('free')).toBe(5)
      expect(getQuestionLimit('basic')).toBe(15)
      expect(getQuestionLimit('premium')).toBe(50)
      expect(getQuestionLimit('vip')).toBe(999)
      expect(getQuestionLimit('unknown' as SubscriptionTier)).toBe(5) // default
    })
  })

  describe('getRetentionDays', () => {
    it('should return correct retention days for each tier', () => {
      expect(getRetentionDays('free')).toBe(30)
      expect(getRetentionDays('basic')).toBe(90)
      expect(getRetentionDays('premium')).toBe(365)
      expect(getRetentionDays('vip')).toBe(999)
      expect(getRetentionDays('unknown' as SubscriptionTier)).toBe(30) // default
    })
  })

  describe('calculateRetentionUntil', () => {
    it('should calculate retention date correctly', () => {
      const fixedDate = new Date('2024-01-15T00:00:00.000Z')
      vi.setSystemTime(fixedDate)

      const retentionFree = calculateRetentionUntil('free')
      const retentionVip = calculateRetentionUntil('vip')

      expect(retentionFree).toBe('2024-02-14T00:00:00.000Z') // 30 days
      expect(retentionVip).toContain('2026') // ~2 years (999 days)
    })
  })

  describe('checkQuestionQuota', () => {
    it('should return quota information for existing usage', async () => {
      const mockUsage = {
        id: 1,
        user_id: 'user123',
        report_id: 'report123',
        plan_tier: 'free',
        questions_used: 3,
        extra_questions: 0,
        period_start: '2024-01-01T00:00:00.000Z',
        period_end: '2024-01-31T23:59:59.999Z',
      }

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({ data: mockUsage, error: null }),
              }),
            }),
          }),
        }),
      } as any)

      const result = await checkQuestionQuota('user123', 'report123', 'free')

      expect(result).toEqual({
        hasQuota: true,
        questionsUsed: 3,
        questionsLimit: 5,
        canPurchase: true,
      })
    })

    it('should create new usage record if none exists', async () => {
      vi.mocked(supabaseService.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
          }),
        }),
      } as any)

      const mockNewUsage = {
        id: 2,
        user_id: 'user123',
        report_id: 'report123',
        plan_tier: 'free',
        questions_used: 0,
        extra_questions: 0,
      }

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({ data: mockNewUsage, error: null }),
          }),
        }),
      } as any)

      const result = await checkQuestionQuota('user123', 'report123', 'free')

      expect(result).toEqual({
        hasQuota: true,
        questionsUsed: 0,
        questionsLimit: 5,
        canPurchase: true,
      })
    })

    it('should return no quota when limit exceeded', async () => {
      const mockUsage = {
        id: 1,
        user_id: 'user123',
        report_id: 'report123',
        plan_tier: 'free',
        questions_used: 5,
        extra_questions: 0,
        period_start: '2024-01-01T00:00:00.000Z',
        period_end: '2024-01-31T23:59:59.999Z',
      }

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({ data: mockUsage, error: null }),
              }),
            }),
          }),
        }),
      } as any)

      const result = await checkQuestionQuota('user123', 'report123', 'free')

      expect(result).toEqual({
        hasQuota: false,
        questionsUsed: 5,
        questionsLimit: 5,
        canPurchase: true,
      })
    })

    it('should handle VIP unlimited quota', async () => {
      const mockUsage = {
        id: 1,
        user_id: 'user123',
        report_id: 'report123',
        plan_tier: 'vip',
        questions_used: 100,
        extra_questions: 0,
        period_start: '2024-01-01T00:00:00.000Z',
        period_end: '2024-01-31T23:59:59.999Z',
      }

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({ data: mockUsage, error: null }),
              }),
            }),
          }),
        }),
      } as any)

      const result = await checkQuestionQuota('user123', 'report123', 'vip')

      expect(result).toEqual({
        hasQuota: true,
        questionsUsed: 100,
        questionsLimit: 999,
        canPurchase: false,
      })
    })
  })

  describe('incrementQuestionUsage', () => {
    it('should increment question usage successfully', async () => {
      const mockUsage = {
        id: 1,
        questions_used: 3,
      }

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({ data: mockUsage, error: null }),
              }),
            }),
          }),
        }),
      } as any)

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({ data: {}, error: null }),
        }),
      } as any)

      await expect(incrementQuestionUsage('user123', 'report123', 'free')).resolves.not.toThrow()
    })

    it('should throw error when increment fails', async () => {
      const mockUsage = {
        id: 1,
        questions_used: 3,
      }

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({ data: mockUsage, error: null }),
              }),
            }),
          }),
        }),
      } as any)

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'Database error' } }),
        }),
      } as any)

      await expect(incrementQuestionUsage('user123', 'report123', 'free')).rejects.toThrow('Failed to increment question usage')
    })
  })

  describe('getOrCreateConversation', () => {
    it('should return existing conversation', async () => {
      const mockConversation: QAConversation = {
        id: 'conv123',
        report_id: 'report123',
        user_id: 'user123',
        subscription_tier: 'free',
        messages: [],
        last_message_at: '2024-01-15T00:00:00.000Z',
        created_at: '2024-01-15T00:00:00.000Z',
        updated_at: '2024-01-15T00:00:00.000Z',
      }

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({ data: mockConversation, error: null }),
            }),
          }),
        }),
      } as any)

      const result = await getOrCreateConversation('user123', 'report123', 'free')

      expect(result).toEqual(mockConversation)
    })

    it('should create new conversation if none exists', async () => {
      vi.mocked(supabaseService.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }),
      } as any)

      const mockNewConversation: QAConversation = {
        id: 'conv456',
        report_id: 'report123',
        user_id: 'user123',
        subscription_tier: 'free',
        messages: [],
        last_message_at: '2024-01-15T00:00:00.000Z',
        created_at: '2024-01-15T00:00:00.000Z',
        updated_at: '2024-01-15T00:00:00.000Z',
      }

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        insert: vi.fn().mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({ data: mockNewConversation, error: null }),
          }),
        }),
      } as any)

      const result = await getOrCreateConversation('user123', 'report123', 'free')

      expect(result).toEqual(mockNewConversation)
    })
  })

  describe('trimConversationMessages', () => {
    it('should return all messages if under limit', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Question 1', timestamp: '2024-01-15T00:00:00.000Z' },
        { role: 'assistant', content: 'Answer 1', timestamp: '2024-01-15T00:01:00.000Z' },
      ]

      const result = trimConversationMessages(messages, 5)
      expect(result).toEqual(messages)
    })

    it('should trim to keep recent messages', () => {
      const messages: ConversationMessage[] = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i + 1}`,
        timestamp: new Date(Date.now() + i * 60000).toISOString(),
      }))

      const result = trimConversationMessages(messages, 10)
      expect(result).toHaveLength(10)
      // Implementation keeps last 9 messages, and if first is user, adds it
      expect(result[0].content).toBe('Message 1') // First message is user, so it's kept
      expect(result[9].content).toBe('Message 15') // Last 9 messages include 7-15
    })

    it('should keep first user message when trimming', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'First question', timestamp: '2024-01-15T00:00:00.000Z' },
        ...Array.from({ length: 12 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
          content: `Message ${i + 2}`,
          timestamp: new Date(Date.now() + (i + 1) * 60000).toISOString(),
        })),
      ]

      const result = trimConversationMessages(messages, 10)
      expect(result).toHaveLength(10)
      expect(result[0].content).toBe('First question') // First message preserved
      expect(result[1].content).toBe('Message 5') // Then recent messages
    })
  })

  describe('addMessageToConversation', () => {
    it('should add message to conversation successfully', async () => {
      const mockCurrentConversation = {
        messages: [
          { role: 'user', content: 'Question 1', timestamp: '2024-01-15T00:00:00.000Z' },
          { role: 'assistant', content: 'Answer 1', timestamp: '2024-01-15T00:01:00.000Z' },
        ],
      }

      const mockUpdatedConversation = {
        id: 'conv123',
        messages: [
          { role: 'user', content: 'Question 1', timestamp: '2024-01-15T00:00:00.000Z' },
          { role: 'assistant', content: 'Answer 1', timestamp: '2024-01-15T00:01:00.000Z' },
          { role: 'user', content: 'Question 2', timestamp: '2024-01-15T00:02:00.000Z' },
        ],
      }

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            single: vi.fn().mockResolvedValueOnce({ data: mockCurrentConversation, error: null }),
          }),
        }),
      } as any)

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockReturnValueOnce({
            select: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({ data: mockUpdatedConversation, error: null }),
            }),
          }),
        }),
      } as any)

      const newMessage: ConversationMessage = {
        role: 'user',
        content: 'Question 2',
        timestamp: '2024-01-15T00:02:00.000Z',
      }

      const result = await addMessageToConversation('conv123', newMessage, 'free')

      expect(result.messages).toHaveLength(3)
      expect(result.messages[2]).toEqual(newMessage)
    })
  })

  describe('getConversationsForReport', () => {
    it('should return conversations for report with retention filtering', async () => {
      const mockConversations: QAConversation[] = [
        {
          id: 'conv1',
          report_id: 'report123',
          user_id: 'user123',
          subscription_tier: 'free',
          messages: [],
          last_message_at: '2024-01-15T00:00:00.000Z',
          created_at: '2024-01-15T00:00:00.000Z',
          updated_at: '2024-01-15T00:00:00.000Z',
        },
      ]

      // Mock the query chain properly - need to handle reassignments
      const baseQuery = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({ data: mockConversations, error: null }),
      }
      
      const userQuery = {
        eq: vi.fn().mockReturnThis(),
      }
      
      const finalQuery = {
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({ data: mockConversations, error: null }),
      }
      
      // Mock the sequence: baseQuery -> userQuery -> finalQuery
      vi.mocked(supabaseService.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce(baseQuery),
      } as any)

      const result = await getConversationsForReport('user123', 'report123', 'free')

      expect(result).toEqual(mockConversations)
    })

    it('should handle null user_id for anonymous conversations', async () => {
      // Mock the query chain properly - need to handle reassignments
      const baseQuery = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
      }
      
      const anonQuery = {
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
      }
      
      vi.mocked(supabaseService.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce(baseQuery),
      } as any)

      const result = await getConversationsForReport(null, 'report123', 'free')

      expect(result).toEqual([])
    })
  })

  describe('cleanupExpiredConversations', () => {
    it('should cleanup expired conversations and return count', async () => {
      const mockDeleted = [
        { id: 'conv1' },
        { id: 'conv2' },
      ]

      vi.mocked(supabaseService.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnValueOnce({
          lt: vi.fn().mockReturnValueOnce({
            select: vi.fn().mockResolvedValueOnce({ data: mockDeleted, error: null }),
          }),
        }),
      } as any)

      const result = await cleanupExpiredConversations()

      expect(result).toBe(2)
    })

    it('should return 0 when no conversations to cleanup', async () => {
      vi.mocked(supabaseService.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnValueOnce({
          lt: vi.fn().mockReturnValueOnce({
            select: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
          }),
        }),
      } as any)

      const result = await cleanupExpiredConversations()

      expect(result).toBe(0)
    })
  })
})