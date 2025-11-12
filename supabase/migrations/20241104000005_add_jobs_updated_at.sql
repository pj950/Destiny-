-- Migration: Add updated_at column to jobs table
-- Created: 2024-11-04
-- Description: Adds updated_at timestamp to track job status changes and ensures automatic updates

ALTER TABLE jobs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN jobs.updated_at IS 'Timestamp of last job status update';

-- Ensure updated_at trigger function exists for consistent timestamp maintenance
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates the updated_at timestamp to current time when a row is modified';

-- Create trigger on jobs table to keep updated_at in sync with modifications
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;

CREATE TRIGGER update_jobs_updated_at 
  BEFORE UPDATE ON jobs 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER update_jobs_updated_at ON jobs IS 'Automatically updates updated_at timestamp when job record is modified';
