-- Migration: Add RAG search functions for vector similarity search
-- Created: 2024-11-10
-- Description: Adds RPC functions for semantic search on report chunks

-- ============================================================================
-- PART 1: Create function for vector similarity search
-- ============================================================================

CREATE OR REPLACE FUNCTION search_chunks(
  report_id UUID,
  query_embedding vector(768),
  similarity_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  chunk_id BIGINT,
  content TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bazi_report_chunks.id,
    bazi_report_chunks.content,
    (1 - (bazi_report_chunks.embedding <=> query_embedding)) as similarity
  FROM bazi_report_chunks
  WHERE bazi_report_chunks.report_id = search_chunks.report_id
    AND bazi_report_chunks.embedding IS NOT NULL
    AND (1 - (bazi_report_chunks.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY bazi_report_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION search_chunks(UUID, vector, FLOAT, INT) IS 
'Search for similar chunks using cosine similarity. Returns chunk_id, content, and similarity score.';

-- ============================================================================
-- PART 2: Create function for multi-report chunk search
-- ============================================================================

CREATE OR REPLACE FUNCTION search_chunks_across_reports(
  user_id UUID,
  query_embedding vector(768),
  similarity_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  report_id UUID,
  chunk_id BIGINT,
  content TEXT,
  similarity FLOAT,
  section TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bazi_report_chunks.report_id,
    bazi_report_chunks.id,
    bazi_report_chunks.content,
    (1 - (bazi_report_chunks.embedding <=> query_embedding)) as similarity,
    COALESCE((bazi_report_chunks.metadata->>'section'), 'general') as section
  FROM bazi_report_chunks
  INNER JOIN bazi_reports ON bazi_report_chunks.report_id = bazi_reports.id
  WHERE bazi_reports.user_id = search_chunks_across_reports.user_id
    AND bazi_report_chunks.embedding IS NOT NULL
    AND (1 - (bazi_report_chunks.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY bazi_report_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION search_chunks_across_reports(UUID, vector, FLOAT, INT) IS 
'Search for similar chunks across all reports for a user. Returns report_id, chunk info, and similarity.';

-- ============================================================================
-- PART 3: Create function for chunk metadata search
-- ============================================================================

CREATE OR REPLACE FUNCTION search_chunks_by_section(
  report_id UUID,
  section_name TEXT
)
RETURNS TABLE (
  chunk_id BIGINT,
  chunk_index INT,
  content TEXT,
  section TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bazi_report_chunks.id,
    bazi_report_chunks.chunk_index,
    bazi_report_chunks.content,
    COALESCE((bazi_report_chunks.metadata->>'section'), 'general') as section
  FROM bazi_report_chunks
  WHERE bazi_report_chunks.report_id = search_chunks_by_section.report_id
    AND (bazi_report_chunks.metadata->>'section') = section_name
  ORDER BY bazi_report_chunks.chunk_index ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION search_chunks_by_section(UUID, TEXT) IS 
'Get all chunks from a report that belong to a specific section.';

-- ============================================================================
-- PART 4: Create function to get chunk statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_report_chunk_stats(report_id UUID)
RETURNS TABLE (
  total_chunks BIGINT,
  avg_chunk_size FLOAT,
  sections_count INT,
  embedding_coverage FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT,
    AVG(LENGTH(content))::FLOAT,
    COUNT(DISTINCT COALESCE((metadata->>'section'), 'general'))::INT,
    (CAST(SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*))::FLOAT
  FROM bazi_report_chunks
  WHERE bazi_report_chunks.report_id = get_report_chunk_stats.report_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION get_report_chunk_stats(UUID) IS 
'Get statistics about chunks for a report: total count, average size, section count, embedding coverage.';

-- ============================================================================
-- PART 5: Ensure proper vector index configuration
-- ============================================================================

-- Verify the HNSW index exists and is properly configured for cosine similarity
-- (This is idempotent - the index was created in the main migration)
-- The index should use: vector_cosine_ops for cosine similarity search

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Functions added:
-- 1. search_chunks - Vector similarity search within a single report
-- 2. search_chunks_across_reports - Cross-report semantic search for a user
-- 3. search_chunks_by_section - Filter chunks by section
-- 4. get_report_chunk_stats - Get chunk statistics for a report
