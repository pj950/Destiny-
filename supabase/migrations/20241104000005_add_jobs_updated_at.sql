-- Migration: Add updated_at column to jobs table
-- Created: 2024-11-04
-- Description: Adds updated_at timestamp to track job status changes

ALTER TABLE jobs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN jobs.updated_at IS 'Timestamp of last job status update';
