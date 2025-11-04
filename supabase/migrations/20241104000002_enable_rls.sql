-- Migration: Enable Row Level Security (RLS)
-- Created: 2024-11-04
-- Description: Enables RLS and creates policies for profiles, charts, and jobs tables

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================

-- Allow users to view their own profiles
CREATE POLICY "Users can view their own profiles"
  ON profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- Allow authenticated users to insert their own profiles
CREATE POLICY "Users can insert their own profiles"
  ON profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow users to update their own profiles
CREATE POLICY "Users can update their own profiles"
  ON profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow users to delete their own profiles
CREATE POLICY "Users can delete their own profiles"
  ON profiles
  FOR DELETE
  USING (user_id = auth.uid());

-- MVP: Allow inserts without user_id (for anonymous profile creation via service role)
-- Note: This policy is intentionally loose for MVP. In production, remove this and require auth.
CREATE POLICY "Allow anonymous profile creation"
  ON profiles
  FOR INSERT
  WITH CHECK (user_id IS NULL);

-- ============================================
-- CHARTS TABLE POLICIES
-- ============================================

-- Allow users to view charts for their own profiles
CREATE POLICY "Users can view their own charts"
  ON charts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = charts.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Note: Chart inserts/updates are handled by service role on the server
-- No public INSERT/UPDATE/DELETE policies are created for charts table

-- ============================================
-- JOBS TABLE POLICIES
-- ============================================

-- Allow users to view their own jobs
CREATE POLICY "Users can view their own jobs"
  ON jobs
  FOR SELECT
  USING (user_id = auth.uid());

-- Note: Job inserts/updates are handled by service role on the server
-- No public INSERT/UPDATE/DELETE policies are created for jobs table

-- ============================================
-- SERVICE ROLE ACCESS
-- ============================================

-- Note: The service role key automatically bypasses RLS policies.
-- All server-side operations (in /pages/api/*) use the service role client
-- to perform inserts, updates, and deletes without restriction.
-- This is acceptable for MVP but should be refined for production.
