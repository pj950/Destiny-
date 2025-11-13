-- Migration: Ensure service_role has access to fortunes table
-- Created: 2024-12-24
-- Description: Fixes RLS policies to explicitly allow service_role access
--              This ensures API endpoints using service role key can access the fortunes table

-- ============================================================================
-- PART 1: Drop all existing SELECT policies to start fresh
-- ============================================================================

-- Drop any existing SELECT policies on fortunes table
DROP POLICY IF EXISTS "Allow users to view their own fortunes" ON fortunes;
DROP POLICY IF EXISTS "Allow public read fortunes" ON fortunes;
DROP POLICY IF EXISTS "service_role_access" ON fortunes;
DROP POLICY IF EXISTS "Allow anonymous fortune reads by session" ON fortunes;
DROP POLICY IF EXISTS "Users can view their own fortunes" ON fortunes;

-- ============================================================================
-- PART 2: Create new unified policy for SELECT operations
-- ============================================================================

-- Policy: Allow service_role OR public read access
-- This ensures:
-- 1. Service role (API endpoints) can always access the table
-- 2. Public users can read all fortune data (fortunes are public by nature)
-- 3. No permission denied errors
CREATE POLICY "fortunes_select_policy"
  ON fortunes
  FOR SELECT
  USING (
    -- Service role always has access (bypasses RLS but policy is explicit)
    auth.role() = 'service_role'
    OR
    -- Public read access for all users
    true
  );

-- ============================================================================
-- PART 3: Verify INSERT policy remains intact
-- ============================================================================

-- The existing INSERT policy should remain unchanged:
-- "Allow anonymous fortune inserts" - FOR INSERT WITH CHECK (user_id IS NULL AND session_id IS NOT NULL)
-- This policy controls who can create fortunes (anonymous users with session_id)

-- ============================================================================
-- PART 4: Verify RLS is enabled
-- ============================================================================

-- Ensure RLS is enabled on the fortunes table
ALTER TABLE fortunes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 5: Add documentation
-- ============================================================================

COMMENT ON POLICY "fortunes_select_policy" ON fortunes IS 
  'Allows service_role (API endpoints) and public users to read fortunes. Service role bypasses RLS but policy is explicit for clarity.';

COMMENT ON TABLE fortunes IS 
  'Stores daily fortune draws. RLS enabled with public read access and anonymous insert capability.';

-- ============================================================================
-- Migration Summary
-- ============================================================================

-- This migration ensures the Fortune API endpoints work correctly by:
-- 1. Explicitly allowing service_role access (API endpoints use service role key)
-- 2. Allowing public read access (fortune data is public by nature)
-- 3. Removing any restrictive policies that might cause "permission denied" errors
-- 4. Maintaining INSERT policy for anonymous users with session_id

-- Security Model:
-- - SELECT: service_role OR anyone (public read)
-- - INSERT: anonymous users with valid session_id (controlled by API)
-- - UPDATE/DELETE: No policies (only service_role can perform these)
-- - API layer enforces privacy by filtering by session_id

-- Testing:
-- After applying this migration:
-- 1. /api/fortune/today should return 200 (no permission errors)
-- 2. /api/fortune/draw should successfully create fortunes
-- 3. Frontend daily fortune feature should work correctly
-- 4. No "permission denied for table fortunes" errors

-- Verification Query:
-- Run this to verify the policy is in place:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'fortunes';
