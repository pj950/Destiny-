-- Migration: Enable RLS and add policies for fortunes table
-- Created: 2024-11-09
-- Description: Enables Row Level Security on fortunes table and creates appropriate policies

-- Enable Row Level Security on fortunes table
ALTER TABLE fortunes ENABLE ROW LEVEL SECURITY;

-- Policy to allow anonymous users to insert their own fortune draws
-- This is needed for the MVP where users are not authenticated
CREATE POLICY "Allow anonymous fortune inserts"
  ON fortunes
  FOR INSERT
  WITH CHECK (user_id IS NULL AND session_id IS NOT NULL);

-- Policy to allow users to view their own fortunes (for authenticated users)
CREATE POLICY "Users can view their own fortunes"
  ON fortunes
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy to allow anonymous users to view their own fortunes via session_id
-- This allows the API to check if a session already has a fortune today
CREATE POLICY "Allow anonymous fortune reads by session"
  ON fortunes
  FOR SELECT
  USING (user_id IS NULL AND session_id IS NOT NULL);

-- Policy to allow service role to manage all fortunes
-- This is implicitly handled by the service role key bypassing RLS
-- No additional policy needed for service role operations
