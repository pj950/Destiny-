-- Migration: Add webhook event ID tracking for idempotency
-- Created: 2024-11-06
-- Description: Adds last_webhook_event_id columns to prevent duplicate webhook processing

-- Add webhook event ID tracking to lamps table
ALTER TABLE lamps 
ADD COLUMN last_webhook_event_id TEXT NULL;

-- Add comment for the new webhook event ID column
COMMENT ON COLUMN lamps.last_webhook_event_id IS 'Last processed Razorpay webhook event ID for idempotency (prevents duplicate processing)';

-- Create index for efficient webhook event ID lookups
CREATE INDEX idx_lamps_last_webhook_event_id ON lamps(last_webhook_event_id);
