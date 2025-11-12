-- Migration: Create lamps table for Prayer Lamps feature
-- Created: 2024-11-06
-- Description: Creates lamps table for tracking lit/unlit state of prayer lamps

-- Lamps table
-- Stores lamp state and checkout information for Prayer Lamps feature
CREATE TABLE lamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,  -- NULL for MVP (no auth), references auth.users(id) in production
  lamp_key TEXT NOT NULL UNIQUE,  -- Lamp identifier: 'p1', 'p2', 'p3', 'p4'
  status TEXT NOT NULL CHECK (status IN ('unlit', 'lit')) DEFAULT 'unlit',
  checkout_session_id TEXT NULL,  -- Stripe checkout session ID for payment tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_lamps_user_id ON lamps(user_id);
CREATE INDEX idx_lamps_lamp_key ON lamps(lamp_key);
CREATE INDEX idx_lamps_status ON lamps(status);
CREATE INDEX idx_lamps_checkout_session_id ON lamps(checkout_session_id);

-- Add comments for documentation
COMMENT ON TABLE lamps IS 'Prayer lamps tracking lit/unlit state and payment information';
COMMENT ON COLUMN lamps.lamp_key IS 'Unique lamp identifier (p1, p2, p3, p4) corresponding to image files';
COMMENT ON COLUMN lamps.status IS 'Current state of the lamp: unlit (available for purchase) or lit (purchased)';
COMMENT ON COLUMN lamps.checkout_session_id IS 'Stripe checkout session ID for tracking payment completion';

-- Insert initial lamp records (all unlit by default)
INSERT INTO lamps (lamp_key, status) VALUES 
  ('p1', 'unlit'),
  ('p2', 'unlit'),
  ('p3', 'unlit'),
  ('p4', 'unlit')
ON CONFLICT (lamp_key) DO NOTHING;

-- Create trigger to automatically update updated_at timestamp
-- Note: The update_updated_at_column() function is created in migration 20241104000005
DROP TRIGGER IF EXISTS update_lamps_updated_at ON lamps;

CREATE TRIGGER update_lamps_updated_at 
    BEFORE UPDATE ON lamps 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
