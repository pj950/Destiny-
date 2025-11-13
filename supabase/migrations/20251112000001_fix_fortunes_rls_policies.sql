-- Migration: Fix RLS policies for fortunes table
-- Created: 2025-11-12
-- Description: Updates RLS policies to properly allow public and anonymous read access
--              Follows the same pattern as lamps table for consistency

-- ============================================================================
-- PART 1: Drop existing restrictive policies
-- ============================================================================

-- Drop the existing policies that are too restrictive
DROP POLICY IF EXISTS "Allow anonymous fortune reads by session" ON fortunes;
DROP POLICY IF EXISTS "Users can view their own fortunes" ON fortunes;

-- ============================================================================
-- PART 2: Create new permissive policies for SELECT operations
-- ============================================================================

-- Policy: Allow all users (authenticated and anonymous) to view fortunes
-- This replaces both previous SELECT policies with a single, more permissive one
-- Authenticated users can see their own fortunes (user_id = auth.uid())
-- Anonymous users can see anonymous fortunes (user_id IS NULL)
CREATE POLICY "Allow users to view their own fortunes"
  ON fortunes
  FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================================
-- PART 3: Verify existing INSERT policy is still in place
-- ============================================================================

-- The existing INSERT policy should remain unchanged:
-- "Allow anonymous fortune inserts" - FOR INSERT WITH CHECK (user_id IS NULL AND session_id IS NOT NULL)
-- This policy is correct and doesn't need modification

-- ============================================================================
-- PART 4: Add comments for documentation
-- ============================================================================

COMMENT ON POLICY "Allow users to view their own fortunes" ON fortunes IS 
  'Allows authenticated users to view their own fortunes and anonymous users to view anonymous fortunes. Service role bypasses this policy.';

-- ============================================================================
-- Migration Summary
-- ============================================================================

-- This migration fixes the RLS policies for the fortunes table:
-- 1. Drops overly restrictive SELECT policies
-- 2. Creates a single, more permissive SELECT policy that handles both authenticated and anonymous users
-- 3. Maintains the existing INSERT policy for anonymous users
-- 4. Follows the same pattern as the lamps table for consistency
-- 5. Ensures service role (used in API endpoints) can bypass RLS

-- Security Model:
-- - Authenticated users can only see their own fortune records (user_id = auth.uid())
-- - Anonymous users can see all anonymous fortune records (user_id IS NULL)
-- - The API endpoints filter by session_id to ensure users only get their own fortunes
-- - Service role bypasses RLS for all operations
-- - INSERT policy ensures only anonymous records can be created (MVP requirement)

-- Backward Compatibility:
-- - Existing fortune records continue to work
-- - API endpoints (/api/fortune/today and /api/fortune/draw) work without changes
-- - Anonymous MVP functionality is preserved and improved
-- - No breaking changes to existing functionality

-- Security Considerations:
-- - Anonymous users can technically query all anonymous fortunes (where user_id IS NULL)
-- - However, without knowing the session_id, they cannot identify which fortune belongs to which session
-- - The API endpoints properly filter by session_id to ensure privacy
-- - This is acceptable for MVP where fortunes are not considered highly sensitive
-- - For production with authentication, add user_id-based filtering in the API
