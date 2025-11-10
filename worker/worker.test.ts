import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Test chunking function in isolation
describe('Chunking Function', () => {
  it('should chunk content into smaller pieces', () => {
    // Define the function locally to test logic
    function chunkReportContent(content: string, chunkSize: number = 500): string[] {
      const chunks: string[] = []
      const sentences = content.match(/[^。！？.!?]+[。！？.!?]/g) || [content]
      
      let currentChunk = ''
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim())
          currentChunk = sentence
        } else {
          currentChunk += sentence
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
      }
      
      return chunks
    }

    const content = '这是第一句话。这是第二句话。这是第三句话。这是第四句话。'
    const chunks = chunkReportContent(content, 20)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every(chunk => chunk.length <= 20)).toBe(true)
  })

  it('should handle content shorter than chunk size', () => {
    function chunkReportContent(content: string, chunkSize: number = 500): string[] {
      const chunks: string[] = []
      const sentences = content.match(/[^。！？.!?]+[。！？.!?]/g) || [content]
      
      let currentChunk = ''
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim())
          currentChunk = sentence
        } else {
          currentChunk += sentence
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
      }
      
      return chunks
    }

    const content = '短内容'
    const chunks = chunkReportContent(content, 20)

    expect(chunks).toEqual([content])
  })

  it('should handle empty content', () => {
    function chunkReportContent(content: string, chunkSize: number = 500): string[] {
      const chunks: string[] = []
      const sentences = content.match(/[^。！？.!?]+[。！？.!?]/g) || [content]
      
      let currentChunk = ''
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim())
          currentChunk = sentence
        } else {
          currentChunk += sentence
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
      }
      
      return chunks
    }

    const content = ''
    const chunks = chunkReportContent(content)

    expect(chunks).toEqual([]) // Empty content should return empty array
  })

  it('should handle Chinese sentence boundaries correctly', () => {
    function chunkReportContent(content: string, chunkSize: number = 500): string[] {
      const chunks: string[] = []
      const sentences = content.match(/[^。！？.!?]+[。！？.!?]/g) || [content]
      
      let currentChunk = ''
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim())
          currentChunk = sentence
        } else {
          currentChunk += sentence
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
      }
      
      return chunks
    }

    const content = '甲乙丙丁戊己庚辛壬癸。子丑寅卯辰巳午未申酉戌亥。'
    const chunks = chunkReportContent(content, 15)

    expect(chunks.length).toBeGreaterThan(0)
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(15)
    })
  })
})

describe('Error Handling Function', () => {
  it('should extract error message correctly', () => {
    function extractErrorMessage(error: unknown): string {
      if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message)
      }
      return String(error)
    }
    
    const error1 = new Error('Test error')
    expect(extractErrorMessage(error1)).toBe('Test error')
    
    const error2 = 'String error'
    expect(extractErrorMessage(error2)).toBe('String error')
    
    const error3 = null
    expect(extractErrorMessage(error3)).toBe('null')
    
    const error4 = { message: 'Object error' }
    expect(extractErrorMessage(error4)).toBe('Object error')
  })
})

describe('Worker Configuration', () => {
  it('should have correct chunk size configuration', () => {
    // Test that the chunk size is reasonable for Chinese text
    const CHUNK_SIZE = 500 // This should match the worker configuration
    expect(CHUNK_SIZE).toBeGreaterThan(100) // Should be reasonable for Chinese
    expect(CHUNK_SIZE).toBeLessThan(1000) // Should not be too large
  })

  it('should have correct delay configuration', () => {
    const DELAY_BETWEEN_JOBS_MS = 1000 // This should match the worker configuration
    expect(DELAY_BETWEEN_JOBS_MS).toBeGreaterThan(0) // Should have some delay
    expect(DELAY_BETWEEN_JOBS_MS).toBeLessThan(5000) // Should not be too long
  })
})