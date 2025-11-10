# Migration 20241110000001: Database Schema Extension Summary

## Quick Reference

**Migration File**: `supabase/migrations/20241110000001_extend_schema_reports_subscriptions.sql`  
**Date**: 2024-11-10  
**Purpose**: Add support for AI reports, vector embeddings, Q&A, and subscriptions

## What Was Added

### 1. Vector Extension
- ✅ Enabled `pgvector` extension for 768-dimensional embeddings
- ✅ Supports cosine similarity search for RAG-based Q&A

### 2. Extended Charts Table
Added 3 new columns:
- `day_master` (TEXT) — Day Master (日主) for BaZi analysis
- `ten_gods` (JSONB) — Ten Gods relationships
- `luck_cycles` (JSONB) — 10-year luck periods (大运)

Plus 3 new indexes for efficient querying.

### 3. New Tables Created

| Table | Purpose | Records |
|-------|---------|---------|
| `bazi_reports` | AI-generated reports | UUID primary key |
| `bazi_report_chunks` | Chunked content with embeddings | BIGSERIAL primary key |
| `qa_conversations` | Q&A conversation sessions | UUID primary key |
| `qa_usage_tracking` | Usage limit enforcement | BIGSERIAL primary key |
| `user_subscriptions` | Subscription management | UUID primary key |

### 4. Indexes Created
Total: **23 indexes**
- 3 on extended `charts` table
- 5 on `bazi_reports`
- 3 on `bazi_report_chunks` (including HNSW vector index)
- 4 on `qa_conversations`
- 4 on `qa_usage_tracking`
- 4 on `user_subscriptions`

### 5. RLS Policies
Total: **16 policies**
- 4 on `bazi_reports` (view/insert/update/delete own)
- 3 on `bazi_report_chunks` (view own, service role insert/update)
- 4 on `qa_conversations` (view/insert/update/delete own)
- 2 on `qa_usage_tracking` (view own, service role manage)
- 3 on `user_subscriptions` (view/insert/update own)

### 6. Triggers
- `update_bazi_reports_updated_at` — Auto-update timestamp on reports
- `update_qa_conversations_updated_at` — Auto-update timestamp on conversations
- `update_qa_usage_tracking_updated_at` — Auto-update timestamp on usage tracking
- `update_user_subscriptions_updated_at` — Auto-update timestamp on subscriptions

## Environment Variables to Add

Add these to your `.env.local`:

```bash
# Gemini Embedding Model
GEMINI_MODEL_EMBEDDING=text-embedding-004

# Razorpay Subscription Plans
RAZORPAY_PLAN_BASIC=plan_basic_xxx
RAZORPAY_PLAN_PREMIUM=plan_premium_xxx
RAZORPAY_PLAN_VIP=plan_vip_xxx
```

## Pre-Migration Checklist

- [ ] Backup your database
- [ ] Verify `pgvector` extension is available
- [ ] Check Supabase project has sufficient resources
- [ ] Review RLS policies for your use case
- [ ] Update environment variables

## Running the Migration

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the entire migration file
5. Click **Run**
6. Verify success in the output panel

### Option 2: Supabase CLI
```bash
# If using local Supabase setup
supabase db reset  # Applies all migrations from scratch
# or
supabase migration up  # Applies pending migrations
```

## Post-Migration Verification

### 1. Check Extension
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```
Expected: 1 row with vector extension details

### 2. Verify New Columns
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'charts' 
  AND column_name IN ('day_master', 'ten_gods', 'luck_cycles');
```
Expected: 3 rows

### 3. Verify New Tables
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('bazi_reports', 'bazi_report_chunks', 'qa_conversations', 'qa_usage_tracking', 'user_subscriptions');
```
Expected: 5 rows

### 4. Check Indexes
```sql
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename LIKE 'bazi_%' OR tablename LIKE 'qa_%' OR tablename = 'user_subscriptions'
ORDER BY tablename, indexname;
```
Expected: 23 rows

### 5. Verify RLS
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('bazi_reports', 'bazi_report_chunks', 'qa_conversations', 'qa_usage_tracking', 'user_subscriptions')
ORDER BY tablename;
```
Expected: 16 rows

### 6. Test Vector Similarity
```sql
-- Generate a test embedding (random vector for testing)
SELECT id FROM bazi_report_chunks 
ORDER BY embedding <=> '[0.1,0.2,...]'::vector(768)  -- Replace with actual embedding
LIMIT 5;
```

## Usage Limits by Subscription Tier

| Tier | Questions/Month | Price | Extra Questions | Report Generation |
|------|-----------------|-------|-----------------|-------------------|
| Free | 3 | ¥0 | ¥5/question | 1 report/month |
| Basic | 10 | ¥29/month | ¥3/question | 3 reports/month |
| Premium | 50 | ¥99/month | ¥2/question | 10 reports/month |
| VIP | Unlimited | ¥299/month | N/A | Unlimited |

## Common Issues and Solutions

### Issue: Vector extension not available
**Solution**: 
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
If this fails, contact Supabase support (usually pre-installed).

### Issue: HNSW index creation fails
**Solution**: pgvector 0.5.0+ required. Check version:
```sql
SELECT * FROM pg_available_extensions WHERE name = 'vector';
```

### Issue: RLS blocking queries
**Solution**: Check if you're using the service role key for server-side operations:
```typescript
import { supabaseService } from '@/lib/supabase'
const { data } = await supabaseService.from('bazi_reports').select()
```

### Issue: Embedding dimension mismatch
**Solution**: Ensure you're using Gemini's `text-embedding-004` (768d). If using a different model:
```sql
ALTER TABLE bazi_report_chunks 
ALTER COLUMN embedding TYPE vector(1536);  -- For OpenAI ada-002
```

## Rollback Instructions

If you need to rollback this migration:

```sql
-- Drop new tables (cascades to indexes and policies)
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS qa_usage_tracking CASCADE;
DROP TABLE IF EXISTS qa_conversations CASCADE;
DROP TABLE IF EXISTS bazi_report_chunks CASCADE;
DROP TABLE IF EXISTS bazi_reports CASCADE;

-- Drop new columns from charts
ALTER TABLE charts DROP COLUMN IF EXISTS day_master;
ALTER TABLE charts DROP COLUMN IF EXISTS ten_gods;
ALTER TABLE charts DROP COLUMN IF EXISTS luck_cycles;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Note: Vector extension is NOT dropped as other tables may use it
```

## Performance Notes

### Vector Search Performance
- **HNSW Index**: ~5-10ms for queries on 10k vectors
- **Cosine Similarity**: Best for semantic search
- **Index Build Time**: ~1-2 minutes per 100k vectors

### Recommended Chunking
- **Size**: 500-1000 characters per chunk
- **Overlap**: 100-200 characters
- **Metadata**: Rich metadata for filtering

### Caching Strategy
- Cache embeddings for frequently accessed questions
- Use Redis for active conversation sessions
- Precompute popular query results

## Next Steps

After migration:

1. ✅ **Generate Test Report**: Create a sample BaZi report
2. ✅ **Generate Embeddings**: Chunk and embed the report
3. ✅ **Test Vector Search**: Query for similar chunks
4. ✅ **Test Q&A**: Create a conversation and ask questions
5. ✅ **Test Usage Tracking**: Verify limits are enforced
6. ✅ **Test Subscriptions**: Create test subscription records

## Documentation

- **Detailed Guide**: `docs/BAZI_REPORTS_AND_SUBSCRIPTIONS.md`
- **Schema Reference**: `supabase/README.md`
- **Setup Guide**: `SUPABASE_SETUP.md`
- **Environment Variables**: `.env.example`

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review `docs/BAZI_REPORTS_AND_SUBSCRIPTIONS.md`
3. Consult Supabase documentation for pgvector
4. Review RLS policies if access issues occur

---

**Migration Status**: ✅ Ready for production  
**Database Version**: PostgreSQL 15+ with pgvector  
**Last Updated**: 2024-11-10
