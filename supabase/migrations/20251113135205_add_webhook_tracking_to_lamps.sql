-- Migration: Add webhook event tracking to lamps table
-- Created: 2025-11-13
-- Description: Adds last_webhook_event_id column for idempotent webhook processing

-- ============================================================================
-- PART 1: Add webhook event tracking column
-- ============================================================================

-- Add column to track the last webhook event ID processed for idempotency
ALTER TABLE lamps
ADD COLUMN IF NOT EXISTS last_webhook_event_id TEXT NULL;

-- Add index for webhook event tracking queries
CREATE INDEX IF NOT EXISTS idx_lamps_last_webhook_event_id ON lamps(last_webhook_event_id);

-- Add comments for documentation
COMMENT ON COLUMN lamps.last_webhook_event_id IS 'Last Stripe webhook event ID processed for this lamp (for idempotency)';

-- ============================================================================
-- Migration Summary
-- ============================================================================

-- This migration adds webhook event tracking to support idempotent processing:
-- 1. Webhook events may be retried if Stripe doesn't receive a 200 response
-- 2. Storing the last_webhook_event_id ensures we don't process the same event twice
-- 3. This prevents duplicate lamp state updates
-- 4. Enables reliable payment confirmation without database locks

-- Security & Reliability:
-- - Ensures payment confirmations are idempotent
-- - Prevents lamp status from being corrupted by duplicate webhook events
-- - Allows safe webhook replay without business logic changes
-- - Maintains data integrity even with network failures
