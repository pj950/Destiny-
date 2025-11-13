-- Migration: Fix lamps table RLS policy for public read access
-- Created: 2024-12-23
-- Description: Removes restrictive RLS conditions and enables true public read access
--              This ensures consistency with the fortunes table fix

-- ============================================================================
-- PART 1: Drop current restrictive policies
-- ============================================================================

-- Drop the existing policies that are too restrictive
DROP POLICY IF EXISTS "Users can view their own lamps" ON lamps;
DROP POLICY IF EXISTS "Allow anonymous lamp status viewing" ON lamps;

-- ============================================================================
-- PART 2: Create new public read policy
-- ============================================================================

-- Policy: Allow public read access to lamps
-- This allows anyone (authenticated or anonymous) to read all lamp data
-- Lamp data is considered public (prayer lamps, status, etc.)
CREATE POLICY "Allow public read lamps"
  ON lamps
  FOR SELECT
  USING (true);

-- ============================================================================
-- PART 3: Verify existing INSERT/UPDATE/DELETE policies remain intact
-- ============================================================================

-- The existing INSERT, UPDATE, DELETE policies should remain unchanged:
-- "Users can insert their own lamps" - FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL)
-- "Users can update their own lamps" - FOR UPDATE USING/WITH CHECK (user_id = auth.uid() OR user_id IS NULL)
-- "Users can delete their own lamps" - FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL)
-- "Service role can manage all lamps" - FOR ALL with service role check
-- These policies are correct and don't need modification

-- ============================================================================
-- PART 4: Add comments for documentation
-- ============================================================================

COMMENT ON POLICY "Allow public read lamps" ON lamps IS 
  'Allows anyone (authenticated and anonymous users) to read all lamp data. Lamp data is public by nature.';

-- ============================================================================
-- Migration Summary
-- ============================================================================

-- This migration fixes the RLS policies for the lamps table by:
-- 1. Dropping restrictive SELECT policies that prevented proper access
-- 2. Creating a true public read policy with USING (true)
-- 3. Maintaining existing INSERT, UPDATE, DELETE policies for data integrity
-- 4. Ensuring consistency with the fortunes table RLS fix

-- Security Model:
-- - Anyone can read any lamp data (public by nature)
-- - INSERT/UPDATE/DELETE operations are still properly restricted
-- - Service role bypasses RLS for all operations
-- - The API layer handles data validation and business logic

-- Why this fix is needed:
-- - The previous policy (user_id = auth.uid() OR user_id IS NULL) was problematic
-- - For unauthenticated users, auth.uid() returns NULL
-- - The condition became (NULL = NULL) OR (user_id IS NULL) = NULL OR (user_id IS NULL)
-- - This only allowed reading records where user_id IS NULL, not all records
-- - Lamp data should be publicly accessible like fortune data

-- Backward Compatibility:
-- - Existing lamp records continue to work
-- - API endpoints continue to function without changes
-- - Webhook processing remains unaffected
-- - No breaking changes to existing functionality

-- Expected Results:
-- - All lamp data is publicly readable
-- - No "permission denied for table lamps" errors
-- - Consistent behavior with fortunes table
-- - Public features work correctly for all users