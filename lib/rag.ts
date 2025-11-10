/**
 * RAG (Retrieval Augmented Generation) utilities for text chunking and vectorization
 * 
 * Provides text splitting, embedding generation, and chunk persistence for
 * semantic search and Q&A functionality.
 */

import { getGeminiClient } from './gemini/client'
import { supabaseService } from './supabase'
import type { BaziReportChunkInsert, ChunkMetadata } from '../types/database'

// Configuration constants
const CHUNK_SIZE = 600 // Chinese characters per chunk
const CHUNK_OVERLAP = 100 // Character overlap between chunks
const MIN_CHUNK_SIZE = 100 // Minimum chunk size to avoid fragments
const EMBEDDING_BATCH_SIZE = 10 // Batch size for embedding generation
const EMBEDDING_MODEL = 'text-embedding-004'

/**
 * Chinese sentence boundaries (punctuation marks)
 */
const CHINESE_SENTENCE_BOUNDARIES = /[。！？；：]/g

/**
 * Split text into sentences, respecting Chinese punctuation and structural boundaries
 */
function splitIntoSentences(text: string): string[] {
  if (!text) return []

  // Split by Chinese punctuation marks while preserving them
  const sentences: string[] = []
  let currentSentence = ''

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    currentSentence += char

    // Check if current character is a sentence boundary
    if (CHINESE_SENTENCE_BOUNDARIES.test(char)) {
      if (currentSentence.trim().length > 0) {
        sentences.push(currentSentence.trim())
      }
      currentSentence = ''
    }
    // Also split on English punctuation
    else if (/[.!?;:]/.test(char)) {
      if (currentSentence.trim().length > 0) {
        sentences.push(currentSentence.trim())
      }
      currentSentence = ''
    }
  }

  // Add remaining text as last sentence
  if (currentSentence.trim().length > 0) {
    sentences.push(currentSentence.trim())
  }

  return sentences
}

/**
 * Split text into paragraph-like units
 */
function splitIntoParagraphs(text: string): string[] {
  if (!text) return []

  // Split by multiple newlines or common paragraph separators
  return text
    .split(/\n\n+|^\s*##\s+|^\s*###\s+/m)
    .map(p => p.trim())
    .filter(p => p.length > 0)
}

/**
 * Extract section name from content (looks for markdown headers or keywords)
 */
function extractSection(text: string): string {
  // Look for markdown headers
  const headerMatch = text.match(/^#+\s+(.+?)$/m)
  if (headerMatch) {
    return headerMatch[1].trim()
  }

  // Look for common Chinese BaZi section titles
  const sectionKeywords = [
    '性格特征',
    '事业运',
    '财运',
    '感情运',
    '健康运',
    '人际关系',
    '命理分析',
    '大运',
    '流年',
    '十神',
    '五行',
    '原局',
    '建议',
    '总结',
  ]

  for (const keyword of sectionKeywords) {
    if (text.includes(keyword)) {
      return keyword
    }
  }

  return 'general'
}

/**
 * Merge small chunks with adjacent ones to meet minimum size requirements
 */
function mergeSmallChunks(chunks: string[], minSize: number = MIN_CHUNK_SIZE): string[] {
  if (chunks.length === 0) return []

  const merged: string[] = []
  let current = ''

  for (const chunk of chunks) {
    if (!current) {
      current = chunk
    } else {
      // If current is too small, merge with next
      if (current.length < minSize) {
        current += ' ' + chunk
      } else if (chunk.length < minSize && merged.length > 0) {
        // Merge small chunk with previous
        merged[merged.length - 1] += ' ' + chunk
      } else {
        merged.push(current)
        current = chunk
      }
    }
  }

  if (current.length > 0) {
    merged.push(current)
  }

  return merged.filter(c => c.length > 0)
}

/**
 * Split text into semantic chunks with overlap
 * 
 * Strategy:
 * 1. Split by paragraph boundaries first
 * 2. Within paragraphs, split by sentences
 * 3. Combine sentences into chunks of target size
 * 4. Add overlap between chunks
 * 5. Merge small chunks to avoid fragmentation
 */
export function splitIntoChunks(
  text: string,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP,
): string[] {
  if (!text || text.trim().length === 0) {
    return []
  }

  // Step 1: Split into paragraphs
  const paragraphs = splitIntoParagraphs(text)

  // Step 2-3: Split paragraphs into sentences and combine into chunks
  const chunks: string[] = []

  for (const paragraph of paragraphs) {
    const sentences = splitIntoSentences(paragraph)

    let currentChunk = ''

    for (const sentence of sentences) {
      // Check if adding this sentence would exceed chunk size
      if (
        currentChunk.length > 0 &&
        (currentChunk.length + sentence.length) > chunkSize
      ) {
        // Save current chunk and start new one
        chunks.push(currentChunk)
        currentChunk = sentence
      } else {
        // Add sentence to current chunk
        if (currentChunk.length > 0) {
          currentChunk += ' ' + sentence
        } else {
          currentChunk = sentence
        }
      }
    }

    // Save remaining chunk from this paragraph
    if (currentChunk.length > 0) {
      chunks.push(currentChunk)
    }
  }

  // Step 4: Add overlap
  const chunksWithOverlap: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i]

    // Add overlap from previous chunk
    if (i > 0 && overlap > 0) {
      const prevChunk = chunks[i - 1]
      const overlapText = prevChunk.slice(-overlap)
      chunk = overlapText + ' ' + chunk
    }

    chunksWithOverlap.push(chunk)
  }

  // Step 5: Merge small chunks
  const finalChunks = mergeSmallChunks(chunksWithOverlap, MIN_CHUNK_SIZE)

  return finalChunks
}

/**
 * Generate embeddings for multiple text chunks
 * 
 * Batch processing to improve efficiency while respecting rate limits
 */
export async function generateEmbeddings(chunks: string[]): Promise<number[][]> {
  if (!chunks || chunks.length === 0) {
    return []
  }

  const client = getGeminiClient()
  const embeddings: number[][] = []

  // Process in batches
  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)

    for (const chunk of batch) {
      try {
        const embedding = await client.generateEmbedding({
          input: chunk,
          model: EMBEDDING_MODEL,
          timeoutMs: 30000,
        })
        embeddings.push(embedding)
      } catch (error) {
        console.error(
          `[RAG] Error generating embedding for chunk starting with: "${chunk.slice(0, 50)}..."`,
          error,
        )
        // Fallback to zeros array with correct dimension (768 for text-embedding-004)
        embeddings.push(new Array(768).fill(0))
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + EMBEDDING_BATCH_SIZE < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return embeddings
}

/**
 * Content chunk structure for storage
 */
export interface ContentChunk {
  report_id: string
  chunk_index: number
  content: string
  section: string
  metadata: {
    start_char: number
    end_char: number
    word_count: number
  }
}

/**
 * Build content chunks from report text with metadata
 * 
 * Associates chunks with their source position in the original text
 * and extracts section information
 */
export function buildContentChunks(
  reportId: string,
  reportText: string,
): ContentChunk[] {
  const chunks = splitIntoChunks(reportText)
  const contentChunks: ContentChunk[] = []

  let charPos = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const startChar = reportText.indexOf(chunk, charPos)
    const endChar = startChar + chunk.length

    const chunkMetadata: ContentChunk['metadata'] = {
      start_char: startChar >= 0 ? startChar : charPos,
      end_char: endChar >= 0 ? endChar : charPos + chunk.length,
      word_count: chunk.length, // For Chinese, character count is word count
    }

    contentChunks.push({
      report_id: reportId,
      chunk_index: i,
      content: chunk,
      section: extractSection(chunk),
      metadata: chunkMetadata,
    })

    charPos = endChar >= 0 ? endChar : charPos + chunk.length
  }

  return contentChunks
}

/**
 * Store chunks with embeddings to database
 */
export async function storeChunks(
  reportId: string,
  chunks: ContentChunk[],
): Promise<void> {
  if (!reportId || chunks.length === 0) {
    console.log('[RAG] Skipping chunk storage: no report ID or chunks provided')
    return
  }

  try {
    // Extract content for embedding
    const contents = chunks.map(c => c.content)

    // Generate embeddings
    console.log(`[RAG] Generating embeddings for ${chunks.length} chunks...`)
    const embeddings = await generateEmbeddings(contents)

    // Prepare records for insertion
    const records: BaziReportChunkInsert[] = chunks.map((chunk, index) => ({
      report_id: reportId,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      embedding: embeddings[index] || null,
      metadata: {
        section: chunk.section,
        start_char: chunk.metadata.start_char,
        end_char: chunk.metadata.end_char,
        word_count: chunk.metadata.word_count,
      } as ChunkMetadata,
    }))

    // Batch insert to database
    console.log(`[RAG] Storing ${records.length} chunks to database...`)
    const { error: insertError } = await supabaseService
      .from('bazi_report_chunks')
      .insert(records)

    if (insertError) {
      console.error('[RAG] Error storing chunks:', insertError)
      throw insertError
    }

    console.log(`[RAG] Successfully stored ${records.length} chunks for report ${reportId}`)
  } catch (error) {
    console.error('[RAG] Error in storeChunks:', error)
    // Re-throw to allow caller to handle
    throw error
  }
}

/**
 * Main function to process report and store chunks with embeddings
 * 
 * This is the entry point called from worker after report generation
 */
export async function processReportChunks(
  reportId: string,
  reportText: string,
): Promise<void> {
  if (!reportText || reportText.trim().length === 0) {
    console.log('[RAG] Skipping chunk processing: report text is empty')
    return
  }

  try {
    console.log(
      `[RAG] Processing report ${reportId}: ${reportText.length} characters`,
    )

    // Build content chunks with metadata
    const contentChunks = buildContentChunks(reportId, reportText)
    console.log(
      `[RAG] Created ${contentChunks.length} chunks (avg ${Math.round(reportText.length / contentChunks.length)} chars each)`,
    )

    // Store chunks with embeddings
    await storeChunks(reportId, contentChunks)

    console.log(
      `[RAG] Report ${reportId} chunking completed successfully`,
    )
  } catch (error) {
    console.error(`[RAG] Error processing chunks for report ${reportId}:`, error)
    // Don't re-throw - chunking failure shouldn't fail the entire report generation
    // Just log for monitoring
  }
}

/**
 * Retrieve similar chunks for a query (semantic search)
 */
export async function searchSimilarChunks(
  reportId: string,
  query: string,
  limit: number = 5,
): Promise<Array<{ chunk_id: number; content: string; similarity: number }>> {
  try {
    // Generate query embedding
    const client = getGeminiClient()
    const queryEmbedding = await client.generateEmbedding({
      input: query,
      model: EMBEDDING_MODEL,
      timeoutMs: 30000,
    })

    // Use pgvector similarity search
    const { data, error } = await supabaseService.rpc('search_chunks', {
      report_id: reportId,
      query_embedding: queryEmbedding,
      similarity_threshold: 0.5,
      match_count: limit,
    })

    if (error) {
      console.error('[RAG] Error searching chunks:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[RAG] Error in searchSimilarChunks:', error)
    return []
  }
}
