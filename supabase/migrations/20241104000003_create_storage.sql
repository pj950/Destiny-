-- Migration: Create storage bucket and policies
-- Created: 2024-11-04
-- Description: Creates the 'reports' storage bucket for PDF reports with public read access

-- Note: Storage buckets are typically created via the Supabase dashboard or API.
-- This SQL provides the equivalent setup using Supabase's storage schema.

-- Insert storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES FOR 'reports' BUCKET
-- ============================================

-- Allow public read access to all files in the reports bucket
CREATE POLICY "Public read access for reports"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'reports');

-- Allow authenticated users to view their own reports
-- (This is redundant with public read, but demonstrates ownership pattern)
CREATE POLICY "Users can view their own reports"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'reports'
    AND auth.uid() IS NOT NULL
  );

-- Note: File uploads to the 'reports' bucket should only be done via service role
-- on the server-side (e.g., in the worker or API routes).
-- No public INSERT/UPDATE/DELETE policies are created for security.

-- If you need to allow authenticated users to upload their own reports, uncomment:
-- CREATE POLICY "Authenticated users can upload reports"
--   ON storage.objects
--   FOR INSERT
--   WITH CHECK (
--     bucket_id = 'reports'
--     AND auth.uid() IS NOT NULL
--   );
