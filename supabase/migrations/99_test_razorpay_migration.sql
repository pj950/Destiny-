-- Test Script: Verify Razorpay Migration
-- Created: 2024-11-06
-- Description: Run this script to verify that Razorpay columns were added correctly

-- ============================================
-- TEST 1: Verify Lamps Table Exists
-- ============================================

SELECT 
  'Test 1: Lamps table exists' as test_name,
  COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'lamps';
-- Expected: table_count = 1

-- ============================================
-- TEST 2: Verify New Razorpay Columns Exist
-- ============================================

SELECT 
  'Test 2: Razorpay columns exist' as test_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'lamps'
AND column_name IN ('razorpay_payment_link_id', 'razorpay_payment_id')
ORDER BY column_name;
-- Expected: Should see both columns with data_type = text and is_nullable = YES

-- ============================================
-- TEST 3: Verify Legacy Stripe Column Still Exists
-- ============================================

SELECT 
  'Test 3: Legacy Stripe column exists' as test_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'lamps'
AND column_name = 'checkout_session_id';
-- Expected: Should see checkout_session_id column

-- ============================================
-- TEST 4: Verify New Indexes Exist
-- ============================================

SELECT 
  'Test 4: New Razorpay indexes' as test_name,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'lamps'
AND indexname IN ('idx_lamps_razorpay_payment_link_id', 'idx_lamps_razorpay_payment_id')
ORDER BY indexname;
-- Expected: Should see both new indexes

-- ============================================
-- TEST 5: Verify Column Comments
-- ============================================

SELECT 
  'Test 5: Column comments' as test_name,
  col.column_name,
  pg_description.description as comment
FROM information_schema.columns col
LEFT JOIN pg_description ON pg_description.objoid = (
  SELECT c.oid 
  FROM pg_class c 
  JOIN pg_namespace n ON n.oid = c.relnamespace 
  WHERE n.nspname = col.table_schema 
  AND c.relname = col.table_name
)
AND pg_description.objsubid = col.ordinal_position
WHERE col.table_schema = 'public'
AND col.table_name = 'lamps'
AND col.column_name IN ('razorpay_payment_link_id', 'razorpay_payment_id', 'checkout_session_id')
ORDER BY col.column_name;
-- Expected: Should see comments for all three columns

-- ============================================
-- TEST 6: Verify Jobs Metadata Comment
-- ============================================

SELECT 
  'Test 6: Jobs metadata comment' as test_name,
  col.column_name,
  pg_description.description as comment
FROM information_schema.columns col
LEFT JOIN pg_description ON pg_description.objoid = (
  SELECT c.oid 
  FROM pg_class c 
  JOIN pg_namespace n ON n.oid = c.relnamespace 
  WHERE n.nspname = col.table_schema 
  AND c.relname = col.table_name
)
AND pg_description.objsubid = col.ordinal_position
WHERE col.table_schema = 'public'
AND col.table_name = 'jobs'
AND col.column_name = 'metadata';
-- Expected: Should see updated comment mentioning Razorpay

-- ============================================
-- TEST 7: Test Data Migration (if any existing data)
-- ============================================

SELECT 
  'Test 7: Data migration check' as test_name,
  COUNT(*) as lamps_with_legacy_data,
  COUNT(CASE WHEN razorpay_payment_link_id IS NOT NULL THEN 1 END) as lamps_with_copied_data
FROM lamps
WHERE checkout_session_id IS NOT NULL;
-- Expected: If there were existing checkout_session_id values, 
-- lamps_with_legacy_data should equal lamps_with_copied_data

-- ============================================
-- SUMMARY
-- ============================================

SELECT 
  '========================================' as summary,
  'Razorpay migration tests completed!' as status,
  'Review results above to verify Razorpay columns were added correctly' as next_step;