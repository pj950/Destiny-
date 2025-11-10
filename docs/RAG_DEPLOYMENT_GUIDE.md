# RAG System Deployment Guide

## Pre-Deployment Checklist

### 1. Database Migration

Ensure the following migrations are applied in order:

```bash
# Main schema with bazi_report_chunks table
supabase/migrations/20241110000001_extend_schema_reports_subscriptions.sql

# RPC functions for vector search
supabase/migrations/20241110000002_add_rag_search_functions.sql
```

### 2. Environment Variables

Ensure your `.env.local` or environment has:

```env
GOOGLE_API_KEY=<your-gemini-api-key>
GEMINI_MODEL_EMBEDDING=text-embedding-004
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
```

### 3. Dependencies

All required dependencies are in `package.json`:

```bash
npm install
```

Key dependencies:
- `@google/generative-ai` - For Gemini API
- `@supabase/supabase-js` - For database operations
- `vitest` - For testing

## Deployment Steps

### Step 1: Apply Database Migrations

Connect to your Supabase database and run the migrations:

```bash
# Using Supabase CLI
supabase db push

# Or manually via Supabase dashboard:
# 1. Go to SQL Editor
# 2. Run migration 20241110000001_extend_schema_reports_subscriptions.sql
# 3. Run migration 20241110000002_add_rag_search_functions.sql
```

### Step 2: Verify Vector Extension

Check that pgvector is enabled:

```sql
-- This should return 'vector'
SELECT extname FROM pg_extension WHERE extname = 'vector';
```

### Step 3: Test Vector Index Creation

Verify the HNSW index is properly configured:

```sql
-- Check index exists
SELECT indexname FROM pg_indexes 
WHERE tablename = 'bazi_report_chunks' 
AND indexname LIKE '%embedding%';

-- Output should include:
-- idx_bazi_report_chunks_embedding_hnsw
```

### Step 4: Deploy Application Code

Push the updated code to your repository:

```bash
# Files modified:
# - lib/rag.ts (new)
# - lib/rag.test.ts (new)
# - worker/worker.ts (modified - added RAG processing)
# - docs/RAG_IMPLEMENTATION.md (new)
# - docs/RAG_DEPLOYMENT_GUIDE.md (new)
# - supabase/migrations/20241110000002_add_rag_search_functions.sql (new)

git add -A
git commit -m "feat: implement RAG text chunking and vectorization"
git push origin feat/rag-text-chunking-embeddings-bazi-report
```

### Step 5: Verify Worker Integration

Check that the worker processes reports with RAG:

```bash
# Check worker logs for "RAG chunks processed successfully" messages
# Look for Stage 6 in yearly_flow_report and deep_report processing

# Expected log output:
# [Stage 6/6] Processing text chunks and generating embeddings for RAG...
# [RAG] Processing report {id}: {char_count} characters
# [RAG] Created {chunk_count} chunks (avg {avg_size} chars each)
# [RAG] Generating embeddings for {chunk_count} chunks...
# [RAG] Storing {chunk_count} chunks to database...
# [RAG] Successfully stored {chunk_count} chunks for report {id}
```

### Step 6: Test RAG Functionality

Create a test report and verify chunks are stored:

```sql
-- Count chunks for a report
SELECT COUNT(*) as chunk_count, 
       AVG(LENGTH(content)) as avg_size,
       COUNT(DISTINCT (metadata->>'section')) as sections
FROM bazi_report_chunks
WHERE report_id = '<test-report-uuid>';

-- Search for similar chunks
WITH test_embedding AS (
  SELECT ARRAY(SELECT 0.5) AS emb
)
SELECT * FROM search_chunks(
  '<test-report-uuid>',
  (SELECT emb FROM test_embedding)::vector(768),
  0.3,
  5
);
```

## Monitoring and Troubleshooting

### Monitor Chunk Processing

```sql
-- Get recent chunk processing stats
SELECT 
  b.id as report_id,
  b.report_type,
  COUNT(c.id) as chunk_count,
  AVG(LENGTH(c.content)) as avg_chunk_size,
  COUNT(CASE WHEN c.embedding IS NOT NULL THEN 1 END) as embedded_chunks,
  COUNT(CASE WHEN c.embedding IS NULL THEN 1 END) as missing_embeddings,
  MAX(c.created_at) as last_chunk_created
FROM bazi_reports b
LEFT JOIN bazi_report_chunks c ON b.id = c.report_id
WHERE b.created_at > NOW() - INTERVAL '24 hours'
GROUP BY b.id, b.report_type
ORDER BY b.created_at DESC;
```

### Check for Failed Embeddings

```sql
-- Find chunks with missing embeddings
SELECT 
  report_id,
  chunk_index,
  SUBSTRING(content, 1, 50) as content_preview,
  created_at
FROM bazi_report_chunks
WHERE embedding IS NULL
ORDER BY created_at DESC
LIMIT 10;
```

### Monitor Index Health

```sql
-- Check index size and bloat
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
WHERE tablename = 'bazi_report_chunks'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Test Vector Search Performance

```sql
-- Measure search performance
EXPLAIN ANALYZE
SELECT * FROM search_chunks(
  '<report-uuid>',
  ARRAY[0.5]::vector(768),
  0.5,
  5
);
```

## Common Issues and Solutions

### Issue: "pgvector extension not installed"

**Error Message**:
```
ERROR: function search_chunks does not exist
```

**Solution**:
```sql
-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Re-run migration 20241110000001
```

### Issue: Chunks have NULL embeddings

**Possible Causes**:
1. Gemini API key is invalid
2. Rate limiting is occurring
3. Embedding model is not available
4. Network timeout

**Debugging**:
```bash
# Check worker logs for embedding errors
# Look for: "[RAG] Error generating embedding for chunk..."

# Test Gemini API connectivity
curl -X POST https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $GOOGLE_API_KEY" \
  -d '{"text": "test"}' | jq .
```

### Issue: Vector search returns no results

**Cause**: Similarity threshold too high or query embedding different from stored embeddings

**Solution**:
```sql
-- Test with lower threshold
SELECT * FROM search_chunks(
  '<report-uuid>',
  query_embedding,
  0.3,  -- Lower threshold
  10    -- Get more results
);

-- Check actual similarity scores
SELECT 
  id,
  (1 - (embedding <=> query_embedding)) as similarity
FROM bazi_report_chunks
WHERE report_id = '<report-uuid>'
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

### Issue: High memory usage during chunk processing

**Cause**: Large reports with many chunks causing memory spike

**Solution**:
1. Increase worker memory limit
2. Reduce EMBEDDING_BATCH_SIZE in lib/rag.ts
3. Increase batch delay to reduce concurrent processing

### Issue: RAG processing taking too long

**Cause**: Network delays, rate limiting, or large number of chunks

**Solution**:
```typescript
// In lib/rag.ts, adjust these parameters:
const EMBEDDING_BATCH_SIZE = 5  // Reduce from 10
const EMBEDDING_MODEL_TIMEOUT = 45000  // Increase timeout
```

## Performance Tuning

### Optimize Vector Index

```sql
-- For production with large datasets, consider IVFFlat index
-- (HNSW is default and good for most cases)

-- Drop existing index
DROP INDEX IF EXISTS idx_bazi_report_chunks_embedding_hnsw;

-- Create IVFFlat index (good for <1M rows)
CREATE INDEX IF NOT EXISTS idx_bazi_report_chunks_embedding_ivfflat 
ON bazi_report_chunks USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- For very large datasets (>1M rows), adjust lists:
-- lists = sqrt(rows) is a good starting point
```

### Enable Parallel Processing

```typescript
// In worker/worker.ts, increase parallel batch processing:
const BATCH_SIZE = 10  // Process more jobs concurrently
const EMBEDDING_BATCH_SIZE = 20  // More embeddings per batch
```

### Cache Recent Embeddings

Consider implementing a caching layer for frequently queried embeddings:

```typescript
// Example implementation (not in current code)
const embeddingCache = new Map<string, number[]>()

async function getCachedEmbedding(text: string): Promise<number[]> {
  const key = createHash('sha256').update(text).digest('hex')
  
  if (embeddingCache.has(key)) {
    return embeddingCache.get(key)!
  }
  
  const embedding = await client.generateEmbedding({ input: text })
  embeddingCache.set(key, embedding)
  
  return embedding
}
```

## Rollback Procedures

### If Issues Occur

1. **Check Job Status**:
   ```sql
   SELECT * FROM jobs 
   WHERE status = 'failed' 
   AND created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

2. **View Worker Logs**:
   ```bash
   # Check for errors in Stage 6
   grep "Stage 6\|RAG\|error" /var/log/worker.log
   ```

3. **Revert Code Changes** (if critical issues):
   ```bash
   git revert <commit-hash>
   git push origin feat/rag-text-chunking-embeddings-bazi-report
   ```

4. **Keep Chunks Intact**:
   ```sql
   -- Chunks are safe to keep even if reverting code
   -- They won't be used if RAG processing is disabled
   SELECT COUNT(*) FROM bazi_report_chunks;
   ```

5. **Disable RAG Temporarily**:
   ```typescript
   // In worker/worker.ts, comment out RAG processing
   // logJobProgress(job.id, `[Stage 6/6] Processing text chunks...`)
   // try {
   //   await processReportChunks(report.id, reportBodyForChunking)
   // }
   ```

## Post-Deployment Tasks

### 1. Run Full Test Suite

```bash
npm test

# Expected: All tests passing (25 RAG tests)
# Some pre-existing failures may occur in other tests
```

### 2. Generate Reports and Verify

```bash
# Create a test report via API
# Check that chunks are created:
SELECT COUNT(*) FROM bazi_report_chunks 
WHERE report_id = '<new-report-id>';

# Should return number > 0
```

### 3. Test Vector Search

```bash
# Generate query embedding and search
SELECT * FROM search_chunks_across_reports(
  '<test-user-uuid>',
  ARRAY[...768 floats...]::vector(768),
  0.5,
  5
);
```

### 4. Monitor for 24 Hours

- Watch for worker errors
- Monitor database performance
- Check Gemini API quota usage
- Verify no embedding generation failures

### 5. Document Results

- Record baseline performance metrics
- Note any adjustments made
- Update runbooks with new procedures

## Success Criteria

✅ Database migrations applied successfully
✅ All 25 RAG tests passing
✅ No TypeScript errors
✅ Worker processes reports with Stage 6 RAG processing
✅ Chunks stored in database with embeddings
✅ Vector search queries return results
✅ No critical errors in logs
✅ Performance within acceptable limits (<2s per report)
✅ Memory usage stable
✅ Gemini API quota not exceeded

## Support

For issues or questions:

1. Check logs: `worker.log`, `app.log`, database logs
2. Review: `docs/RAG_IMPLEMENTATION.md` for technical details
3. Run tests: `npm test -- lib/rag.test.ts`
4. Consult: Gemini API documentation if embedding issues occur
5. Contact: Development team with specific error messages and logs
