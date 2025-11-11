-- Migration: Fix jobs table updated_at trigger and clean up duplicate functions
-- Created: 2025-11-11
-- Description: Adds missing trigger for jobs table updated_at column and removes duplicate trigger function definitions

-- ============================================================================
-- PART 1: Drop and recreate the update_updated_at_column function cleanly
-- ============================================================================

-- Drop the existing function to avoid duplicates
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Recreate the function once
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment for the function
COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates the updated_at timestamp to current time when a row is modified';

-- ============================================================================
-- PART 2: Add missing trigger for jobs table
-- ============================================================================

-- Create trigger for jobs table to automatically update updated_at
CREATE TRIGGER update_jobs_updated_at 
  BEFORE UPDATE ON jobs 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for the trigger
COMMENT ON TRIGGER update_jobs_updated_at ON jobs IS 'Automatically updates updated_at timestamp when job record is modified';

-- ============================================================================
-- PART 3: Ensure triggers exist for all other tables with updated_at columns
-- ============================================================================

-- Drop existing triggers to recreate them cleanly
DROP TRIGGER IF EXISTS update_lamps_updated_at ON lamps;
DROP TRIGGER IF EXISTS update_bazi_reports_updated_at ON bazi_reports;
DROP TRIGGER IF EXISTS update_qa_conversations_updated_at ON qa_conversations;
DROP TRIGGER IF EXISTS update_qa_usage_tracking_updated_at ON qa_usage_tracking;
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;

-- Recreate triggers for all tables with updated_at columns
CREATE TRIGGER update_lamps_updated_at 
  BEFORE UPDATE ON lamps 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bazi_reports_updated_at BEFORE UPDATE ON bazi_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qa_conversations_updated_at BEFORE UPDATE ON qa_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qa_usage_tracking_updated_at BEFORE UPDATE ON qa_usage_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration Summary
-- ============================================================================

-- This migration fixes the following issues:
-- 1. Removes duplicate definitions of update_updated_at_column() function
-- 2. Adds missing trigger for jobs table to auto-update updated_at column
-- 3. Ensures all tables with updated_at columns have proper triggers
-- 4. Cleans up trigger definitions to avoid redundancy

-- Tables now with automatic updated_at triggers:
-- - jobs (fixed)
-- - lamps (recreated)
-- - bazi_reports (recreated)
-- - qa_conversations (recreated)
-- - qa_usage_tracking (recreated)
-- - user_subscriptions (recreated)