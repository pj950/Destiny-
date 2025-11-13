-- Migration: Fix fortunes table RLS policy for public read access
-- Created: 2024-12-23
-- Description: Removes restrictive RLS conditions and enables true public read access
--              This fixes the issue where unauthenticated users cannot read fortune data

-- ============================================================================
-- PART 1: Drop the current restrictive policy
-- ============================================================================

-- Drop the existing policy that is still too restrictive
DROP POLICY IF EXISTS "Allow users to view their own fortunes" ON fortunes;

-- ============================================================================
-- PART 2: Create new public read policy
-- ============================================================================

-- Policy: Allow public read access to fortunes
-- This allows anyone (authenticated or anonymous) to read all fortune data
-- Fortune data is considered public (daily fortunes, prayers, etc.)
CREATE POLICY "Allow public read fortunes"
  ON fortunes
  FOR SELECT
  USING (true);

-- ============================================================================
-- PART 3: Verify existing INSERT policy remains intact
-- ============================================================================

-- The existing INSERT policy should remain unchanged:
-- "Allow anonymous fortune inserts" - FOR INSERT WITH CHECK (user_id IS NULL AND session_id IS NOT NULL)
-- This policy is correct and doesn't need modification

-- ============================================================================
-- PART 4: Add comments for documentation
-- ============================================================================

COMMENT ON POLICY "Allow public read fortunes" ON fortunes IS 
  'Allows anyone (authenticated and anonymous users) to read all fortune data. Fortune data is public by nature.';

-- ============================================================================
-- Migration Summary
-- ============================================================================

-- This migration fixes the RLS policies for the fortunes table by:
-- 1. Dropping the restrictive SELECT policy that prevented proper access
-- 2. Creating a true public read policy with USING (true)
-- 3. Maintaining the existing INSERT policy for anonymous users
-- 4. Ensuring all users can access fortune data regardless of authentication status

-- Security Model:
-- - Anyone can read any fortune data (public by nature)
-- - INSERT operations are still restricted to anonymous users with valid session_id
-- - Service role bypasses RLS for all operations
-- - The API layer handles privacy by filtering by session_id when appropriate

-- Why this fix is needed:
-- - The previous policy (user_id = auth.uid() OR user_id IS NULL) was problematic
-- - For unauthenticated users, auth.uid() returns NULL
-- - The condition became (NULL = NULL) OR (user_id IS NULL) = NULL OR (user_id IS NULL)
-- - This only allowed reading records where user_id IS NULL, not all records
-- - Fortune data should be publicly accessible like prayer lamps

-- Backward Compatibility:
-- - Existing fortune records continue to work
-- - API endpoints (/api/fortune/today and /api/fortune/draw) work without changes
-- - Anonymous MVP functionality is preserved and improved
-- - No breaking changes to existing functionality

-- Expected Results:
-- - /api/fortune/today returns 200 for all users
-- - Daily fortune displays correctly for everyone
-- - No "permission denied for table fortunes" errors
-- - Unauthenticated users can access all fortune features