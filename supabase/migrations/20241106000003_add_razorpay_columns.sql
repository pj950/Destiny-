-- Migration: Add Razorpay payment columns to lamps table
-- Created: 2024-11-06
-- Description: Adds Razorpay payment identifiers while preserving Stripe legacy data

-- Add Razorpay payment columns to lamps table
ALTER TABLE lamps 
ADD COLUMN razorpay_payment_link_id TEXT NULL,
ADD COLUMN razorpay_payment_id TEXT NULL;

-- Add comments for the new Razorpay columns
COMMENT ON COLUMN lamps.razorpay_payment_link_id IS 'Razorpay payment link ID for pending payments (replaces checkout_session_id for new transactions)';
COMMENT ON COLUMN lamps.razorpay_payment_id IS 'Razorpay payment ID for completed payments (captured after successful payment)';

-- Update comment for legacy Stripe column to indicate it's deprecated
COMMENT ON COLUMN lamps.checkout_session_id IS 'LEGACY: Stripe checkout session ID (deprecated - use razorpay_payment_link_id for new transactions)';

-- Create indexes for efficient lookups in webhook handlers
CREATE INDEX idx_lamps_razorpay_payment_link_id ON lamps(razorpay_payment_link_id);
CREATE INDEX idx_lamps_razorpay_payment_id ON lamps(razorpay_payment_id);

-- Optional: Copy existing checkout_session_id values to razorpay_payment_link_id
-- This preserves historical references while allowing new Razorpay workflow
-- NOTE: This is a one-time migration of legacy data for reference purposes only
UPDATE lamps 
SET razorpay_payment_link_id = checkout_session_id 
WHERE checkout_session_id IS NOT NULL;

-- Add comment to jobs.metadata to document Razorpay transition
COMMENT ON COLUMN jobs.metadata IS 'Additional job metadata. For payment tracking: stores razorpay_payment_link_id/razorpay_payment_id (new) or checkout_session_id (legacy)';