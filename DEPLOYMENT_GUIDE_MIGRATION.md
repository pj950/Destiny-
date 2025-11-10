# Deployment Guide: Database Migration 20241110

This guide provides step-by-step instructions for deploying the database schema extension to production.

## 🔍 Pre-Deployment Checklist

### 1. Review Changes
- [ ] Read migration file: `supabase/migrations/20241110000001_extend_schema_reports_subscriptions.sql`
- [ ] Review documentation: `docs/BAZI_REPORTS_AND_SUBSCRIPTIONS.md`
- [ ] Check `MIGRATION_CHECKLIST.md` for detailed verification steps

### 2. Backup Database
```sql
-- In Supabase Dashboard > Database > Backups
-- Create manual backup with description: "Pre-migration backup 20241110"
```

### 3. Test in Staging
- [ ] Deploy to staging/development environment first
- [ ] Run all verification queries
- [ ] Test basic operations (insert, select, vector search)
- [ ] Verify RLS policies work correctly

### 4. Prepare Environment Variables

Add these to your production environment:

```bash
# In Vercel/Railway/etc. dashboard, add:
GEMINI_MODEL_EMBEDDING=text-embedding-004
RAZORPAY_PLAN_BASIC=plan_basic_xxx      # Replace with actual plan ID
RAZORPAY_PLAN_PREMIUM=plan_premium_xxx  # Replace with actual plan ID
RAZORPAY_PLAN_VIP=plan_vip_xxx          # Replace with actual plan ID
```

### 5. Razorpay Subscription Plans

Create subscription plans in Razorpay dashboard:

```bash
# Basic Plan
Name: Eastern Destiny Basic
Amount: ¥29/month
Period: Monthly
Description: 10 questions/month, 3 reports/month

# Premium Plan
Name: Eastern Destiny Premium
Amount: ¥99/month
Period: Monthly
Description: 50 questions/month, 10 reports/month

# VIP Plan
Name: Eastern Destiny VIP
Amount: ¥299/month
Period: Monthly
Description: Unlimited questions and reports
```

Copy the plan IDs and add them to environment variables.

---

## 🚀 Deployment Steps

### Option 1: Supabase Dashboard (Recommended)

#### Step 1: Access SQL Editor
1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** in left sidebar
4. Click **New query**

#### Step 2: Copy Migration Content
1. Open `supabase/migrations/20241110000001_extend_schema_reports_subscriptions.sql`
2. Copy **entire** file content (410 lines)
3. Paste into SQL Editor

#### Step 3: Execute Migration
1. Click **Run** button
2. Wait for execution (should take 1-2 seconds)
3. Check for success message: "Success. No rows returned"

#### Step 4: Verify Execution
Run these verification queries in SQL Editor:

```sql
-- 1. Check vector extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- 2. Count new tables (should be 5)
SELECT COUNT(*) as new_tables
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('bazi_reports', 'bazi_report_chunks', 'qa_conversations', 'qa_usage_tracking', 'user_subscriptions');

-- 3. Count new indexes (should be 23+)
SELECT COUNT(*) as new_indexes
FROM pg_indexes 
WHERE tablename IN ('charts', 'bazi_reports', 'bazi_report_chunks', 'qa_conversations', 'qa_usage_tracking', 'user_subscriptions');

-- 4. Count RLS policies (should be 16+)
SELECT COUNT(*) as new_policies
FROM pg_policies 
WHERE tablename IN ('bazi_reports', 'bazi_report_chunks', 'qa_conversations', 'qa_usage_tracking', 'user_subscriptions');
```

Expected results:
- Vector extension: 1 row (version 0.5.0+)
- New tables: 5
- New indexes: 23 or more
- RLS policies: 16 or more

### Option 2: Supabase CLI

If you have Supabase CLI installed and project linked:

```bash
# 1. Link to production project
supabase link --project-ref <your-production-project-ref>

# 2. Apply migration
supabase db push

# 3. Verify
supabase migration list
```

---

## ✅ Post-Deployment Verification

### 1. Quick Smoke Tests

Run these in Supabase SQL Editor:

```sql
-- Test 1: Insert a test report
INSERT INTO bazi_reports (chart_id, report_type, title, status)
SELECT id, 'character_profile', 'Test Report', 'pending'
FROM charts LIMIT 1
RETURNING id;

-- Test 2: Vector dimension check
SELECT '[0.1,0.2,0.3]'::vector(768);

-- Test 3: Test vector similarity operator
SELECT 1 - ('[0.1,0.2,0.3]'::vector(768) <=> '[0.1,0.2,0.3]'::vector(768));

-- Test 4: Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('bazi_reports', 'bazi_report_chunks', 'qa_conversations', 'user_subscriptions')
  AND schemaname = 'public';

-- Cleanup test data
DELETE FROM bazi_reports WHERE title = 'Test Report';
```

### 2. Application Health Check

1. Deploy code changes to production
2. Check application logs for errors
3. Test API endpoints that use new tables
4. Verify environment variables are loaded

### 3. Monitor for Issues

Check Supabase dashboard for:
- [ ] Database performance metrics
- [ ] Error logs
- [ ] Query performance
- [ ] Connection pool status

---

## 🔄 Rollback Procedure

If issues occur, follow these steps:

### 1. Immediate Rollback (If Needed)

```sql
-- WARNING: This will delete all data in new tables
BEGIN;

-- Drop new tables (cascades to indexes, policies, triggers)
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS qa_usage_tracking CASCADE;
DROP TABLE IF EXISTS qa_conversations CASCADE;
DROP TABLE IF EXISTS bazi_report_chunks CASCADE;
DROP TABLE IF EXISTS bazi_reports CASCADE;

-- Drop new columns from charts
ALTER TABLE charts DROP COLUMN IF EXISTS day_master;
ALTER TABLE charts DROP COLUMN IF EXISTS ten_gods;
ALTER TABLE charts DROP COLUMN IF EXISTS luck_cycles;

-- Drop indexes (if columns dropped successfully)
DROP INDEX IF EXISTS idx_charts_day_master;
DROP INDEX IF EXISTS idx_charts_ten_gods;
DROP INDEX IF EXISTS idx_charts_luck_cycles;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

COMMIT;
```

### 2. Restore from Backup

In Supabase Dashboard:
1. Go to **Database** > **Backups**
2. Find pre-migration backup
3. Click **Restore**
4. Confirm restoration

---

## 📊 Monitoring Post-Deployment

### Key Metrics to Watch

1. **Database Performance**
   - Query execution time
   - Vector search latency
   - Index hit rate

2. **Storage Usage**
   - Table sizes (especially `bazi_report_chunks`)
   - Index sizes
   - Total database size

3. **Application Performance**
   - API response times
   - Error rates
   - User-reported issues

### Queries for Monitoring

```sql
-- 1. Table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('bazi_reports', 'bazi_report_chunks', 'qa_conversations')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 2. Index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('bazi_reports', 'bazi_report_chunks', 'qa_conversations')
ORDER BY idx_scan DESC;

-- 3. Vector search performance
EXPLAIN ANALYZE
SELECT id, content, embedding <=> '[0.1,0.2,...]'::vector(768) as distance
FROM bazi_report_chunks
ORDER BY distance
LIMIT 10;
```

---

## 🛠️ Common Issues & Solutions

### Issue: Vector extension not found

**Solution:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

If this fails, contact Supabase support. pgvector is usually pre-installed.

### Issue: Migration fails partway through

**Solution:**
1. Check Supabase logs for specific error
2. If it's a transient error, retry the migration
3. If data already exists, migration uses `IF NOT EXISTS` clauses
4. Safe to re-run the migration file

### Issue: RLS blocks service role queries

**Solution:**
Ensure you're using the service role client in API routes:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // NOT the anon key
  { auth: { persistSession: false } }
)
```

### Issue: Vector search is slow

**Solution:**
1. Ensure HNSW index is created:
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE indexname = 'idx_bazi_report_chunks_embedding_hnsw';
   ```

2. Check index is being used:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM bazi_report_chunks
   ORDER BY embedding <=> '[...]'::vector(768)
   LIMIT 10;
   ```

3. If index isn't used, rebuild it:
   ```sql
   REINDEX INDEX idx_bazi_report_chunks_embedding_hnsw;
   ```

### Issue: Embedding dimension mismatch

**Solution:**
If using a different embedding model than Gemini text-embedding-004:

```sql
-- Check current dimension
SELECT dim FROM vector_columns 
WHERE table_name = 'bazi_report_chunks' 
  AND column_name = 'embedding';

-- If needed, alter (will lose existing embeddings)
ALTER TABLE bazi_report_chunks 
ALTER COLUMN embedding TYPE vector(1536);  -- For OpenAI ada-002

-- Rebuild index
DROP INDEX idx_bazi_report_chunks_embedding_hnsw;
CREATE INDEX idx_bazi_report_chunks_embedding_hnsw 
ON bazi_report_chunks USING hnsw (embedding vector_cosine_ops);
```

---

## 📱 Notification Checklist

After successful deployment:

- [ ] Notify development team
- [ ] Update team documentation
- [ ] Announce new features to stakeholders
- [ ] Update API documentation
- [ ] Train customer support on new features

---

## 📚 Additional Resources

- **Complete Feature Guide**: `docs/BAZI_REPORTS_AND_SUBSCRIPTIONS.md`
- **Schema Reference**: `supabase/README.md`
- **Verification Checklist**: `MIGRATION_CHECKLIST.md`
- **Supabase pgvector Docs**: https://supabase.com/docs/guides/database/extensions/pgvector

---

## ✅ Deployment Completion Checklist

- [ ] Pre-deployment backup created
- [ ] Migration executed successfully
- [ ] All verification queries passed
- [ ] Environment variables updated
- [ ] Razorpay plans configured
- [ ] Code deployed to production
- [ ] Smoke tests passed
- [ ] Monitoring enabled
- [ ] Team notified
- [ ] Documentation updated

---

**Migration**: 20241110000001  
**Tables Created**: 5  
**Indexes Created**: 23  
**RLS Policies**: 16  
**Status**: Ready for Production  

**Support**: If issues occur, refer to rollback procedure or contact DevOps team.
