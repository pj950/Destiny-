-- Test Script: Verify Database Setup
-- Created: 2024-11-04
-- Description: Run this script to verify that tables, RLS, and storage are set up correctly

-- ============================================
-- TEST 1: Verify Tables Exist
-- ============================================

SELECT 
  'Test 1: Tables exist' as test_name,
  COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'charts', 'jobs');
-- Expected: table_count = 3

-- ============================================
-- TEST 2: Verify RLS is Enabled
-- ============================================

SELECT 
  'Test 2: RLS enabled' as test_name,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'charts', 'jobs')
ORDER BY tablename;
-- Expected: All tables should have rls_enabled = true

-- ============================================
-- TEST 3: Verify Indexes Exist
-- ============================================

SELECT 
  'Test 3: Indexes' as test_name,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'charts', 'jobs')
ORDER BY tablename, indexname;
-- Expected: Should see idx_profiles_user_id, idx_charts_profile_id, idx_jobs_chart_id, idx_jobs_status, idx_jobs_user_id

-- ============================================
-- TEST 4: Verify Policies Exist
-- ============================================

SELECT 
  'Test 4: RLS Policies' as test_name,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
-- Expected: Should see policies for profiles, charts, and jobs

-- ============================================
-- TEST 5: Verify Storage Bucket
-- ============================================

SELECT 
  'Test 5: Storage bucket' as test_name,
  id as bucket_id,
  name as bucket_name,
  public as is_public
FROM storage.buckets
WHERE name = 'reports';
-- Expected: Should see bucket 'reports' with is_public = true

-- ============================================
-- TEST 6: Test Insert/Select (Service Role)
-- ============================================

-- Insert a test profile
INSERT INTO profiles (name, birth_local, birth_timezone, gender, lat, lon)
VALUES (
  'Test User',
  '1990-01-01T12:00:00',
  'UTC',
  'male',
  40.7128,
  -74.0060
)
RETURNING id, name, birth_local, birth_timezone;

-- Verify the insert
SELECT 
  'Test 6: Data operations' as test_name,
  COUNT(*) as profile_count
FROM profiles
WHERE name = 'Test User';
-- Expected: profile_count = 1

-- Clean up test data
DELETE FROM profiles WHERE name = 'Test User';

-- ============================================
-- TEST 7: Verify Foreign Key Relationships
-- ============================================

SELECT 
  'Test 7: Foreign keys' as test_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND tc.table_name IN ('profiles', 'charts', 'jobs')
ORDER BY tc.table_name;
-- Expected: Should see foreign keys for charts.profile_id -> profiles.id and jobs.chart_id -> charts.id

-- ============================================
-- SUMMARY
-- ============================================

SELECT 
  '========================================' as summary,
  'All tests completed!' as status,
  'Review results above to verify setup' as next_step;
