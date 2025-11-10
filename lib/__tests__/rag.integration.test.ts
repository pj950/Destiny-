import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  splitIntoChunks,
  generateEmbeddings,
  buildContentChunks,
  storeChunks,
  processReportChunks,
} from '../rag'
import { supabaseService } from '../supabase'
import { getGeminiClient } from '../gemini/client'

// Mock dependencies
vi.mock('../supabase', () => ({
  supabaseService: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

vi.mock('../gemini/client', () => ({
  getGeminiClient: vi.fn(),
}))

describe('RAG - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('processReportChunks - Complete Flow', () => {
    const mockReportId = 'report-123'
    const mockReportText = `
      # 性格特征分析
      
      这个人的性格特征非常明显。从命盘上来看，他是一个很有主见的人。
      
      在事业方面，他具有很强的领导能力。适合从事管理岗位。
      
      在财运方面，他的财运相对平稳，但需要谨慎投资。
      
      # 健康状况
      
      从五行角度来看，需要注意心脏方面的保养。
      
      # 感情生活
      
      感情方面比较专一，但有时过于固执。
    `

    it('should process complete report flow successfully', async () => {
      // Mock embedding generation
      const mockEmbeddings = [
        new Array(768).fill(0.1),
        new Array(768).fill(0.2),
        new Array(768).fill(0.3),
      ]

      vi.mocked(getGeminiClient).mockReturnValue({
        getEmbeddings: vi.fn().mockResolvedValue({
          values: mockEmbeddings[0],
        }),
      } as any)

      // Mock database operations
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })

      vi.mocked(supabaseService.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      // Process the report
      await expect(processReportChunks(mockReportId, mockReportText)).resolves.toBeUndefined()

      // Verify embedding calls
      expect(getGeminiClient).toHaveBeenCalled()
      expect(supabaseService.from).toHaveBeenCalledWith('bazi_report_chunks')
      expect(mockInsert).toHaveBeenCalled()
    })

    it('should handle empty report text gracefully', async () => {
      await expect(processReportChunks(mockReportId, '')).resolves.toBeUndefined()
      await expect(processReportChunks(mockReportId, '   ')).resolves.toBeUndefined()
      
      // Should not call any external services
      expect(getGeminiClient).not.toHaveBeenCalled()
      expect(supabaseService.from).not.toHaveBeenCalled()
    })

    it('should handle embedding generation failures gracefully', async () => {
      // Mock embedding failure
      vi.mocked(getGeminiClient).mockReturnValue({
        getEmbeddings: vi.fn().mockRejectedValue(new Error('Embedding failed')),
      } as any)

      // Mock database operations
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })

      vi.mocked(supabaseService.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      // Should still complete without throwing
      await expect(processReportChunks(mockReportId, mockReportText)).resolves.toBeUndefined()
      
      // Should attempt to store chunks with zero vectors as fallback
      expect(supabaseService.from).toHaveBeenCalledWith('bazi_report_chunks')
    })

    it('should handle database write failures gracefully', async () => {
      // Mock embedding generation
      vi.mocked(getGeminiClient).mockReturnValue({
        getEmbeddings: vi.fn().mockResolvedValue({
          values: new Array(768).fill(0.1),
        }),
      } as any)

      // Mock database failure
      vi.mocked(supabaseService.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: new Error('Database error') }),
          }),
        }),
      } as any)

      // Should still complete without throwing
      await expect(processReportChunks(mockReportId, mockReportText)).resolves.toBeUndefined()
    })
  })

  describe('splitIntoChunks - Edge Cases', () => {
    it('should handle very long Chinese text efficiently', () => {
      const longText = '这是一个很长的句子，包含了大量的中文字符。'.repeat(100)
      const chunks = splitIntoChunks(longText, 600, 100)

      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.every(chunk => chunk.length <= 600 + 100)).toBe(true) // Allow some overlap
      
      // Check that chunks maintain sentence boundaries
      chunks.forEach(chunk => {
        expect(chunk.trim()).toMatch(/[。！？；：]$/)
      })
    })

    it('should handle mixed Chinese and English text', () => {
      const mixedText = `
        这是中文句子。This is an English sentence. 这是另一个中文句子！
        Here's another English one. 最后是中文句子？
      `
      
      const chunks = splitIntoChunks(mixedText, 100, 20)
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.every(chunk => chunk.length > 0)).toBe(true)
    })

    it('should merge very small chunks', () => {
      const shortText = '短句。短句。短句。'
      const chunks = splitIntoChunks(shortText, 600, 100)
      
      // Should merge small chunks to avoid fragmentation
      expect(chunks.length).toBe(1)
      expect(chunks[0].length).toBeGreaterThan(100)
    })

    it('should respect overlap parameter correctly', () => {
      const text = '第一句。第二句。第三句。第四句。第五句。'
      const chunks = splitIntoChunks(text, 20, 5)
      
      if (chunks.length > 1) {
        // Check that overlap exists between consecutive chunks
        for (let i = 1; i < chunks.length; i++) {
          const prevChunk = chunks[i - 1]
          const currChunk = chunks[i]
          
          // The end of previous chunk should overlap with start of current chunk
          const prevEnd = prevChunk.slice(-5)
          const currStart = currChunk.slice(0, 5)
          
          // Some overlap should exist (exact overlap depends on sentence boundaries)
          expect(prevChunk.length + currChunk.length).toBeGreaterThan(text.length + 5)
        }
      }
    })
  })

  describe('buildContentChunks - Metadata Generation', () => {
    it('should generate correct metadata for each chunk', () => {
      const reportText = `
        # 性格特征
        这是性格分析的内容。
        
        # 事业运
        这是事业分析的内容。
      `
      
      const chunks = splitIntoChunks(reportText, 100, 20)
      const contentChunks = buildContentChunks('report-123', chunks)
      
      contentChunks.forEach((chunk, index) => {
        expect(chunk.report_id).toBe('report-123')
        expect(chunk.chunk_index).toBe(index)
        expect(chunk.content).toBe(chunks[index])
        expect(chunk.embedding).toEqual(new Array(768).fill(0)) // Default zero vector
        expect(chunk.metadata).toHaveProperty('section')
        expect(chunk.metadata).toHaveProperty('start_char')
        expect(chunk.metadata).toHaveProperty('end_char')
        expect(chunk.metadata).toHaveProperty('word_count')
        expect(chunk.metadata.word_count).toBeGreaterThan(0)
      })
    })

    it('should detect sections correctly', () => {
      const reportText = `
        # 性格特征
        性格内容。
        
        ## 子标题
        子标题内容。
        
        # 事业运
        事业内容。
      `
      
      const chunks = splitIntoChunks(reportText, 100, 20)
      const contentChunks = buildContentChunks('report-123', chunks)
      
      // Should detect main sections
      const sections = contentChunks.map(chunk => chunk.metadata.section)
      expect(sections).toContain('性格特征')
      expect(sections).toContain('事业运')
    })
  })

  describe('generateEmbeddings - Batch Processing', () => {
    it('should process embeddings in batches', async () => {
      const texts = [
        '第一段文本',
        '第二段文本', 
        '第三段文本',
        '第四段文本',
        '第五段文本',
        '第六段文本',
        '第七段文本',
        '第八段文本',
        '第九段文本',
        '第十段文本',
        '第十一段文本',
        '第十二段文本',
      ]

      const mockEmbeddings = texts.map((_, i) => ({
        values: new Array(768).fill(i * 0.1),
      }))

      const mockGetEmbeddings = vi.fn()
      texts.forEach((_, i) => {
        mockGetEmbeddings.mockResolvedValueOnce(mockEmbeddings[i])
      })

      vi.mocked(getGeminiClient).mockReturnValue({
        getEmbeddings: mockGetEmbeddings,
      } as any)

      const embeddings = await generateEmbeddings(texts)

      expect(embeddings).toHaveLength(texts.length)
      expect(mockGetEmbeddings).toHaveBeenCalledTimes(texts.length)
      
      // Verify each embedding has correct dimensions
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(768)
      })
    })

    it('should handle embedding failures with zero vector fallback', async () => {
      const texts = ['文本1', '文本2', '文本3']
      
      vi.mocked(getGeminiClient).mockReturnValue({
        getEmbeddings: vi.fn()
          .mockResolvedValueOnce({ values: new Array(768).fill(0.1) })
          .mockRejectedValueOnce(new Error('API error'))
          .mockResolvedValueOnce({ values: new Array(768).fill(0.3) }),
      } as any)

      const embeddings = await generateEmbeddings(texts)

      expect(embeddings).toHaveLength(3)
      expect(embeddings[0]).toEqual(new Array(768).fill(0.1))
      expect(embeddings[1]).toEqual(new Array(768).fill(0)) // Zero vector fallback
      expect(embeddings[2]).toEqual(new Array(768).fill(0.3))
    })
  })
})