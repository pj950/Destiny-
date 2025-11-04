-- Migration: Create tables for Eastern Destiny MVP
-- Created: 2024-11-04
-- Description: Creates profiles, charts, and jobs tables with proper relationships

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
-- Stores user profile information and birth details for BaZi calculations
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,  -- NULL for MVP (no auth), references auth.users(id) in production
  name TEXT,
  birth_local TEXT NOT NULL,  -- ISO 8601 datetime string in local timezone
  birth_timezone TEXT NOT NULL,  -- IANA timezone string (e.g., 'America/New_York')
  gender TEXT,
  lat NUMERIC NULL,  -- Latitude for location-based features
  lon NUMERIC NULL,  -- Longitude for location-based features
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Charts table
-- Stores computed BaZi charts linked to profiles
CREATE TABLE charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  chart_json JSONB NOT NULL,  -- Full BaZi chart data (Four Pillars, etc.)
  wuxing_scores JSONB NOT NULL,  -- Five Elements scores
  ai_summary TEXT NULL,  -- AI-generated interpretation summary
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table
-- Tracks async background jobs (e.g., report generation)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,  -- NULL for MVP, references auth.users(id) in production
  chart_id UUID NOT NULL REFERENCES charts(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,  -- e.g., 'report_generation'
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  result_url TEXT NULL,  -- URL to generated report (if applicable)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_charts_profile_id ON charts(profile_id);
CREATE INDEX idx_jobs_chart_id ON jobs(chart_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_user_id ON jobs(user_id);

-- Add comments for documentation
COMMENT ON TABLE profiles IS 'User profiles with birth information for BaZi chart generation';
COMMENT ON TABLE charts IS 'Generated BaZi charts with AI interpretations';
COMMENT ON TABLE jobs IS 'Async job queue for background tasks like report generation';
