-- Migration: Add Stripe payment columns to user_subscriptions table
-- Created: 2024-12-25
-- Description: Adds Stripe customer ID, subscription ID, and payment ID columns for Stripe integration

-- Add Stripe-specific columns to user_subscriptions table
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT NULL,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT NULL,
ADD COLUMN IF NOT EXISTS external_payment_id TEXT NULL;

-- Add comments for the new Stripe columns
COMMENT ON COLUMN user_subscriptions.stripe_customer_id IS 'Stripe customer ID for the user';
COMMENT ON COLUMN user_subscriptions.stripe_subscription_id IS 'Stripe subscription ID (if using recurring subscriptions)';
COMMENT ON COLUMN user_subscriptions.external_payment_id IS 'Stripe Payment Intent ID or Checkout Session ID for completed payments';

-- Create indexes for efficient lookups in webhook handlers
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_external_payment_id ON user_subscriptions(external_payment_id);

-- Update comment on external_subscription_id to clarify it can be used for both Razorpay and Stripe
COMMENT ON COLUMN user_subscriptions.external_subscription_id IS 'External payment provider subscription ID (Stripe subscription ID or Razorpay subscription ID)';

-- Migration complete!
-- The user_subscriptions table now supports Stripe payment integration alongside existing payment methods
