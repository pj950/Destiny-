-- Migration: Add metadata column to jobs table
-- Created: 2024-11-04
-- Description: Adds metadata JSONB column to store additional job information like checkout_session_id

ALTER TABLE jobs ADD COLUMN metadata JSONB NULL;

COMMENT ON COLUMN jobs.metadata IS 'Additional job metadata (e.g., checkout_session_id for payment tracking)';
