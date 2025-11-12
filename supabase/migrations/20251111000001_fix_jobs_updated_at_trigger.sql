-- Migration: Verify and fix updated_at triggers (idempotent)
-- Created: 2025-11-11
-- Description: Ensures all tables with updated_at columns have proper triggers
-- This migration is idempotent and safe to run multiple times

-- ============================================================================
-- PART 1: Verify function exists (should already exist from 20241104000005)
-- ============================================================================

-- Ensure the update_updated_at_column function exists (CREATE OR REPLACE is safe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates the updated_at timestamp to current time when a row is modified';

-- ============================================================================
-- PART 2: Verify all required triggers exist
-- ============================================================================

-- Ensure trigger exists for jobs table (should already exist from 20241104000005)
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at 
  BEFORE UPDATE ON jobs 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure trigger exists for lamps table (should already exist from 20241106000001)
DROP TRIGGER IF EXISTS update_lamps_updated_at ON lamps;
CREATE TRIGGER update_lamps_updated_at 
  BEFORE UPDATE ON lamps 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure triggers exist for report-related tables (should already exist from 20241110000001)
DROP TRIGGER IF EXISTS update_bazi_reports_updated_at ON bazi_reports;
CREATE TRIGGER update_bazi_reports_updated_at 
  BEFORE UPDATE ON bazi_reports
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_qa_conversations_updated_at ON qa_conversations;
CREATE TRIGGER update_qa_conversations_updated_at 
  BEFORE UPDATE ON qa_conversations
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_qa_usage_tracking_updated_at ON qa_usage_tracking;
CREATE TRIGGER update_qa_usage_tracking_updated_at 
  BEFORE UPDATE ON qa_usage_tracking
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at 
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration Summary
-- ============================================================================

-- This migration is a verification/fix migration that:
-- 1. Ensures update_updated_at_column() function exists
-- 2. Ensures all tables with updated_at columns have proper triggers
-- 3. Uses DROP TRIGGER IF EXISTS for idempotency
-- 4. Safe to run multiple times without errors

-- Tables with automatic updated_at triggers:
-- - jobs
-- - lamps
-- - bazi_reports
-- - qa_conversations
-- - qa_usage_tracking
-- - user_subscriptions
