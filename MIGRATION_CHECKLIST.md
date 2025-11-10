# Migration Checklist: Database Schema Extension

**Migration**: `20241110000001_extend_schema_reports_subscriptions.sql`  
**Date**: 2024-11-10

## Pre-Migration

- [ ] **Backup Database**: Create snapshot/backup of production database
- [ ] **Review Migration**: Read through `supabase/migrations/20241110000001_extend_schema_reports_subscriptions.sql`
- [ ] **Check pgvector**: Verify pgvector extension is available in Supabase project
- [ ] **Test Environment**: Run migration in development/staging first
- [ ] **Environment Variables**: Update `.env.local` with new variables:
  ```bash
  GEMINI_MODEL_EMBEDDING=text-embedding-004
  RAZORPAY_PLAN_BASIC=plan_basic_xxx
  RAZORPAY_PLAN_PREMIUM=plan_premium_xxx
  RAZORPAY_PLAN_VIP=plan_vip_xxx
  ```

## Running Migration

### Via Supabase Dashboard (Recommended)
- [ ] Open Supabase project dashboard
- [ ] Navigate to **SQL Editor**
- [ ] Create new query
- [ ] Copy entire migration file content
- [ ] Click **Run**
- [ ] Verify success message in output

### Via Supabase CLI (Alternative)
- [ ] Ensure Supabase CLI is installed: `supabase --version`
- [ ] Link to project: `supabase link --project-ref <your-project-ref>`
- [ ] Run pending migrations: `supabase migration up`
- [ ] Verify migration applied: `supabase migration list`

## Post-Migration Verification

### 1. Extensions
- [ ] Vector extension enabled:
  ```sql
  SELECT * FROM pg_extension WHERE extname = 'vector';
  -- Expected: 1 row
  ```

### 2. Charts Table Extensions
- [ ] New columns exist:
  ```sql
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'charts' 
    AND column_name IN ('day_master', 'ten_gods', 'luck_cycles');
  -- Expected: 3 rows
  ```

### 3. New Tables
- [ ] All 5 new tables created:
  ```sql
  SELECT tablename FROM pg_tables 
  WHERE schemaname = 'public' 
    AND tablename IN ('bazi_reports', 'bazi_report_chunks', 'qa_conversations', 'qa_usage_tracking', 'user_subscriptions')
  ORDER BY tablename;
  -- Expected: 5 rows
  ```

### 4. Indexes
- [ ] All 23 new indexes created:
  ```sql
  SELECT COUNT(*) as index_count
  FROM pg_indexes 
  WHERE tablename IN ('charts', 'bazi_reports', 'bazi_report_chunks', 'qa_conversations', 'qa_usage_tracking', 'user_subscriptions')
    AND indexname LIKE 'idx_%';
  -- Expected: 23+ (including existing chart indexes)
  ```

- [ ] HNSW vector index exists:
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE indexname = 'idx_bazi_report_chunks_embedding_hnsw';
  -- Expected: 1 row
  ```

### 5. RLS Policies
- [ ] All 16 new policies created:
  ```sql
  SELECT tablename, COUNT(*) as policy_count
  FROM pg_policies 
  WHERE tablename IN ('bazi_reports', 'bazi_report_chunks', 'qa_conversations', 'qa_usage_tracking', 'user_subscriptions')
  GROUP BY tablename
  ORDER BY tablename;
  -- Expected: 5 rows with counts: 4, 3, 4, 2, 3
  ```

### 6. Triggers
- [ ] Updated_at triggers exist:
  ```sql
  SELECT trigger_name, event_object_table
  FROM information_schema.triggers
  WHERE trigger_name LIKE '%updated_at%'
    AND event_object_table IN ('bazi_reports', 'qa_conversations', 'qa_usage_tracking', 'user_subscriptions')
  ORDER BY event_object_table;
  -- Expected: 4 rows
  ```

### 7. Function
- [ ] Update timestamp function exists:
  ```sql
  SELECT proname FROM pg_proc WHERE proname = 'update_updated_at_column';
  -- Expected: 1 row
  ```

## Functional Testing

### 1. Test Vector Extension
- [ ] Create test embedding:
  ```sql
  SELECT '[0.1,0.2,0.3]'::vector(768);
  -- Should succeed without error
  ```

### 2. Test Insert into bazi_reports
- [ ] Insert test report:
  ```sql
  INSERT INTO bazi_reports (chart_id, report_type, title, status)
  VALUES (
    (SELECT id FROM charts LIMIT 1),
    'character_profile',
    'Test Report',
    'pending'
  )
  RETURNING id;
  -- Should return UUID
  ```

### 3. Test Vector Similarity Search
- [ ] Create test chunk with embedding (requires service role):
  ```sql
  INSERT INTO bazi_report_chunks (report_id, chunk_index, content, embedding)
  VALUES (
    (SELECT id FROM bazi_reports LIMIT 1),
    0,
    'Test content',
    array_fill(0.1, ARRAY[768])::vector(768)
  )
  RETURNING id;
  -- Should return chunk ID
  ```

- [ ] Test vector search:
  ```sql
  SELECT id, content, embedding <=> array_fill(0.1, ARRAY[768])::vector(768) as distance
  FROM bazi_report_chunks
  ORDER BY distance
  LIMIT 5;
  -- Should return chunks ordered by similarity
  ```

### 4. Test RLS Policies
- [ ] Test user access (as authenticated user):
  ```sql
  -- Should only return user's own reports
  SET request.jwt.claim.sub = '<user-uuid>';
  SELECT * FROM bazi_reports WHERE user_id = '<user-uuid>';
  ```

### 5. Test Unique Constraints
- [ ] Test user subscription uniqueness:
  ```sql
  -- Try to insert duplicate active subscription (should fail)
  INSERT INTO user_subscriptions (user_id, tier, status, current_period_start, current_period_end)
  VALUES (
    '<test-user-id>',
    'basic',
    'active',
    NOW(),
    NOW() + INTERVAL '1 month'
  );
  -- First insert: SUCCESS
  -- Second insert with same user_id and status='active': SHOULD FAIL
  ```

## Integration Testing

### 1. TypeScript Types
- [ ] TypeScript compilation succeeds:
  ```bash
  npm run build
  # or
  pnpm build
  ```

- [ ] Import types work:
  ```typescript
  import { BaziReport, QAConversation, UserSubscription } from '@/types/database'
  ```

### 2. Supabase Client
- [ ] Query new tables with client:
  ```typescript
  const { data: reports } = await supabase
    .from('bazi_reports')
    .select('*')
    .limit(10)
  ```

### 3. Environment Variables
- [ ] All new variables set in `.env.local`
- [ ] Variables accessible in API routes:
  ```typescript
  console.log(process.env.GEMINI_MODEL_EMBEDDING) // 'text-embedding-004'
  console.log(process.env.RAZORPAY_PLAN_BASIC) // 'plan_basic_xxx'
  ```

## Documentation Updates

- [x] Updated `supabase/README.md` with new tables and fields
- [x] Updated `SUPABASE_SETUP.md` with migration instructions
- [x] Updated `.env.example` with new environment variables
- [x] Created `types/database.ts` with TypeScript types
- [x] Created `docs/BAZI_REPORTS_AND_SUBSCRIPTIONS.md` comprehensive guide
- [x] Created `docs/MIGRATION_20241110_SUMMARY.md` quick reference
- [x] Updated `README.md` feature list

## Rollback Plan

If issues occur, rollback procedure:

```sql
-- 1. Drop new tables (cascades to indexes, policies, triggers)
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS qa_usage_tracking CASCADE;
DROP TABLE IF EXISTS qa_conversations CASCADE;
DROP TABLE IF EXISTS bazi_report_chunks CASCADE;
DROP TABLE IF EXISTS bazi_reports CASCADE;

-- 2. Drop new columns from charts
ALTER TABLE charts DROP COLUMN IF EXISTS day_master;
ALTER TABLE charts DROP COLUMN IF EXISTS ten_gods;
ALTER TABLE charts DROP COLUMN IF EXISTS luck_cycles;

-- 3. Drop new indexes on charts
DROP INDEX IF EXISTS idx_charts_day_master;
DROP INDEX IF EXISTS idx_charts_ten_gods;
DROP INDEX IF EXISTS idx_charts_luck_cycles;

-- 4. Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Note: Vector extension NOT dropped (may be used by other features)
```

Then restore from backup.

## Sign-Off

- [ ] **Developer**: Migration tested in development environment
- [ ] **QA**: Functional tests passed
- [ ] **DevOps**: Database backup verified
- [ ] **Product**: Documentation reviewed
- [ ] **Lead**: Approved for production deployment

---

**Migration Status**: ⬜ Pending / ✅ Completed / ❌ Failed  
**Completed By**: _________________  
**Date**: _________________  
**Notes**: _________________
