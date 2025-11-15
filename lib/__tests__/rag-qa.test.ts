/**
 * RAG QA Extension Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  searchQaContextChunks,
  formatCitations,
  extractQaContextChunks,
  generateFollowUpQuestions,
  validateSearchResults,
  searchAcrossReports
} from '../rag'
import { getGeminiClient } from '../gemini/client'
import { supabaseService } from '../supabase'

// Mock dependencies
vi.mock('../gemini/client')
vi.mock('../supabase')

const mockGetGeminiClient = vi.mocked(getGeminiClient)
const mockSupabaseService = vi.mocked(supabaseService)

describe('RAG QA Extensions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('searchQaContextChunks', () => {
    it('should search and return context chunks', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3]
      const mockSearchResults = [
        { id: 1, content: 'Chunk 1 content', similarity: 0.85, metadata: { section: '性格特征' } },
        { id: 2, content: 'Chunk 2 content', similarity: 0.75, metadata: { section: '事业运' } },
      ]

      const mockClient = {
        generateEmbedding: vi.fn().mockResolvedValue(mockEmbedding),
      }

      mockGetGeminiClient.mockReturnValue(mockClient)

      mockSupabaseService.rpc = vi.fn().mockResolvedValueOnce({
        data: mockSearchResults,
        error: null,
      })

      const result = await searchQaContextChunks('report123', 'test question', 5, 0.5)

      expect(result).toEqual(mockSearchResults)
      expect(mockClient.generateEmbedding).toHaveBeenCalledWith({
        input: 'test question',
        model: 'text-embedding-004',
        timeoutMs: 30000,
      })
      expect(mockSupabaseService.rpc).toHaveBeenCalledWith('search_chunks', {
        report_id: 'report123',
        query_embedding: mockEmbedding,
        similarity_threshold: 0.5,
        match_count: 5,
      })
    })

    it('should handle search errors gracefully', async () => {
      const mockClient = {
        generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      }

      mockGetGeminiClient.mockReturnValue(mockClient)

      mockSupabaseService.rpc = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Search failed' },
      })

      const result = await searchQaContextChunks('report123', 'test question')

      expect(result).toEqual([])
    })

    it('should handle embedding generation errors', async () => {
      const mockClient = {
        generateEmbedding: vi.fn().mockRejectedValue(new Error('Embedding failed')),
      }

      mockGetGeminiClient.mockReturnValue(mockClient)

      const result = await searchQaContextChunks('report123', 'test question')

      expect(result).toEqual([])
    })
  })

  describe('formatCitations', () => {
    it('should format citations from chunks', () => {
      const chunks = [
        { id: 1, similarity: 0.9 },
        { id: 3, similarity: 0.8 },
        { id: 1, similarity: 0.7 }, // Duplicate
        { id: 2, similarity: 0.6 },
      ]

      const result = formatCitations(chunks)

      expect(result).toEqual([1, 3, 2]) // Unique IDs in order of appearance
    })

    it('should handle empty chunks', () => {
      const result = formatCitations([])

      expect(result).toEqual([])
    })

    it('should handle chunks without IDs', () => {
      const chunks = [
        { similarity: 0.9 },
        { id: 2, similarity: 0.8 },
        { similarity: 0.7 },
      ]

      const result = formatCitations(chunks)

      expect(result).toEqual([2])
    })
  })

  describe('extractQaContextChunks', () => {
    it('should extract and sort context chunks', () => {
      const searchResults = [
        { id: 3, content: 'Chunk 3', similarity: 0.6, metadata: { section: '健康' } },
        { id: 1, content: 'Chunk 1', similarity: 0.9, metadata: { section: '性格' } },
        { id: 2, content: 'Chunk 2', similarity: 0.8, metadata: { section: '事业' } },
        { id: 4, content: 'Chunk 4', similarity: 0.7, metadata: { section: '财运' } },
      ]

      const result = extractQaContextChunks(searchResults, 3)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        id: 1,
        content: 'Chunk 1',
        metadata: { section: '性格' },
        similarity: 0.9,
      })
      expect(result[1]).toEqual({
        id: 2,
        content: 'Chunk 2',
        metadata: { section: '事业' },
        similarity: 0.8,
      })
      expect(result[2]).toEqual({
        id: 4,
        content: 'Chunk 4',
        metadata: { section: '财运' },
        similarity: 0.7,
      })
    })

    it('should handle empty search results', () => {
      const result = extractQaContextChunks([])

      expect(result).toEqual([])
    })

    it('should handle missing similarity scores', () => {
      const searchResults = [
        { id: 1, content: 'Chunk 1', metadata: {} },
        { id: 2, content: 'Chunk 2', similarity: 0.8, metadata: {} },
      ]

      const result = extractQaContextChunks(searchResults)

      expect(result[0].similarity).toBe(0) // Default for missing similarity
      expect(result[1].similarity).toBe(0.8)
    })
  })

  describe('generateFollowUpQuestions', () => {
    it('should generate relevant follow-ups based on career content', () => {
      const question = '我的事业发展如何？'
      const answer = '根据您的命盘分析，您的事业运势整体向好，特别是在下半年有机会获得晋升。'

      const result = generateFollowUpQuestions(question, answer)

      expect(result).toContain('关于我的事业发展，有什么具体的建议吗？')
      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result.length).toBeLessThanOrEqual(3)
    })

    it('should generate relevant follow-ups based on wealth content', () => {
      const question = '我的财运怎么样？'
      const answer = '您的财运显示有稳步增长的趋势，但需要注意投资风险。'

      const result = generateFollowUpQuestions(question, answer)

      expect(result).toContain('我的财运状况如何？如何改善？')
    })

    it('should generate generic follow-ups for unknown topics', () => {
      const question = '今天天气怎么样？'
      const answer = '抱歉，我无法回答天气相关的问题。'

      const result = generateFollowUpQuestions(question, answer)

      expect(result).toContain('能详细解释一下刚才提到的内容吗？')
      expect(result).toContain('基于这个分析，我有什么需要注意的地方吗？')
    })

    it('should use provided context topics', () => {
      const question = '我的命盘如何？'
      const answer = '您的命盘显示五行平衡。'
      const contextTopics = ['五行', '平衡']

      const result = generateFollowUpQuestions(question, answer, contextTopics)

      expect(result).toContain('我的五行平衡情况如何？该如何调理？')
    })
  })

  describe('validateSearchResults', () => {
    it('should validate and normalize search results', () => {
      const results = [
        { id: 1, content: 'Valid content', similarity: 0.9, metadata: { section: 'test' } },
        { id: 2, content: 'Another valid content', similarity: 0.8, metadata: {} },
        { id: 3, content: '', similarity: 0.7, metadata: {} }, // Invalid: empty content
        { content: 'Missing ID', similarity: 0.6, metadata: {} }, // Invalid: no ID
        { id: 4, content: 'No similarity', metadata: {} }, // Missing similarity
        null, // Invalid: null
        'invalid', // Invalid: not object
      ]

      const result = validateSearchResults(results)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        id: 1,
        content: 'Valid content',
        similarity: 0.9,
        metadata: { section: 'test' },
      })
      expect(result[1]).toEqual({
        id: 2,
        content: 'Another valid content',
        similarity: 0.8,
        metadata: {},
      })
      expect(result[2]).toEqual({
        id: 4,
        content: 'No similarity',
        similarity: 0.5, // Default similarity
        metadata: {},
      })

      // Should be sorted by similarity (descending)
      expect(result[0].similarity).toBeGreaterThanOrEqual(result[1].similarity)
      expect(result[1].similarity).toBeGreaterThanOrEqual(result[2].similarity)
    })

    it('should handle null input', () => {
      const result = validateSearchResults(null as any)

      expect(result).toEqual([])
    })

    it('should handle non-array input', () => {
      const result = validateSearchResults('not an array' as any)

      expect(result).toEqual([])
    })
  })

  describe('searchAcrossReports', () => {
    it('should search across multiple reports', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3]
      const mockCrossReportResults = [
        { 
          report_id: 'report1', 
          chunk_id: 1, 
          content: 'Content from report 1', 
          similarity: 0.9, 
          metadata: {} 
        },
        { 
          report_id: 'report2', 
          chunk_id: 2, 
          content: 'Content from report 2', 
          similarity: 0.8, 
          metadata: {} 
        },
      ]

      const mockClient = {
        generateEmbedding: vi.fn().mockResolvedValue(mockEmbedding),
      }

      mockGetGeminiClient.mockReturnValue(mockClient)

      mockSupabaseService.rpc = vi.fn().mockResolvedValueOnce({
        data: mockCrossReportResults,
        error: null,
      })

      const result = await searchAcrossReports(['report1', 'report2'], 'test question')

      expect(result).toEqual(mockCrossReportResults)
      expect(mockClient.generateEmbedding).toHaveBeenCalledWith({
        input: 'test question',
        model: 'text-embedding-004',
        timeoutMs: 30000,
      })
      expect(mockSupabaseService.rpc).toHaveBeenCalledWith('search_chunks_across_reports', {
        user_id: null,
        query_embedding: mockEmbedding,
        similarity_threshold: 0.5,
        match_count: 10,
        report_ids: ['report1', 'report2'],
      })
    })

    it('should handle cross-report search errors', async () => {
      const mockClient = {
        generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      }

      mockGetGeminiClient.mockReturnValue(mockClient)

      mockSupabaseService.rpc = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Cross-report search failed' },
      })

      const result = await searchAcrossReports(['report1'], 'test question')

      expect(result).toEqual([])
    })
  })
})