-- Migration: Extend database schema for reports, embeddings, Q&A, and subscriptions
-- Created: 2024-11-10
-- Description: Adds vector extension, extends charts table, creates bazi_reports, 
--              bazi_report_chunks, qa_conversations, qa_usage_tracking, and user_subscriptions tables

-- ============================================================================
-- PART 1: Enable vector extension for embeddings
-- ============================================================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

COMMENT ON EXTENSION vector IS 'pgvector extension for vector similarity search and embeddings';


-- ============================================================================
-- PART 2: Extend charts table with BaZi analysis fields
-- ============================================================================

-- Add day_master (日主) field to store the Heavenly Stem of the Day Pillar
ALTER TABLE charts 
ADD COLUMN IF NOT EXISTS day_master TEXT;

-- Add ten_gods (十神) field to store Ten Gods relationships
ALTER TABLE charts 
ADD COLUMN IF NOT EXISTS ten_gods JSONB;

-- Add luck_cycles (大运) field to store 10-year luck cycle data
ALTER TABLE charts 
ADD COLUMN IF NOT EXISTS luck_cycles JSONB;

-- Add comments for the new fields
COMMENT ON COLUMN charts.day_master IS 'Day Master (日主) - Heavenly Stem of Day Pillar, represents self in BaZi';
COMMENT ON COLUMN charts.ten_gods IS 'Ten Gods (十神) relationships JSONB: {pillar: {stem: god_name, branch: god_name}, ...}';
COMMENT ON COLUMN charts.luck_cycles IS 'Luck Cycles (大运) JSONB array: [{age_start, age_end, stem, branch, ten_god}, ...]';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_charts_day_master ON charts(day_master);
CREATE INDEX IF NOT EXISTS idx_charts_ten_gods ON charts USING GIN(ten_gods);
CREATE INDEX IF NOT EXISTS idx_charts_luck_cycles ON charts USING GIN(luck_cycles);


-- ============================================================================
-- PART 3: Create bazi_reports table for AI-generated reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS bazi_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id UUID NOT NULL REFERENCES charts(id) ON DELETE CASCADE,
  user_id UUID NULL,  -- References auth.users(id) when auth is enabled
  
  -- Report metadata
  report_type TEXT NOT NULL CHECK (report_type IN ('character_profile', 'yearly_flow')),
  title TEXT NOT NULL,
  
  -- Report content
  summary JSONB,  -- Executive summary or key insights
  structured JSONB,  -- Structured report sections/chapters
  body TEXT,  -- Full markdown/plaintext report body
  
  -- AI generation metadata
  model TEXT,  -- e.g., 'gemini-2.5-pro'
  prompt_version TEXT,  -- Prompt template version for tracking
  tokens INT,  -- Total tokens used
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
);

-- Add comments
COMMENT ON TABLE bazi_reports IS 'AI-generated BaZi reports for character analysis and yearly flow predictions';
COMMENT ON COLUMN bazi_reports.report_type IS 'Type of report: character_profile (性格分析) or yearly_flow (流年运势)';
COMMENT ON COLUMN bazi_reports.summary IS 'JSONB executive summary with key insights';
COMMENT ON COLUMN bazi_reports.structured IS 'JSONB structured report sections for programmatic access';
COMMENT ON COLUMN bazi_reports.body IS 'Full report content in markdown or plaintext format';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bazi_reports_chart_id ON bazi_reports(chart_id);
CREATE INDEX IF NOT EXISTS idx_bazi_reports_user_id ON bazi_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bazi_reports_type ON bazi_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_bazi_reports_status ON bazi_reports(status);
CREATE INDEX IF NOT EXISTS idx_bazi_reports_created_at ON bazi_reports(created_at DESC);


-- ============================================================================
-- PART 4: Create bazi_report_chunks table for vector embeddings (RAG)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bazi_report_chunks (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES bazi_reports(id) ON DELETE CASCADE,
  
  -- Chunk content
  chunk_index INT NOT NULL,  -- Sequential index within report
  content TEXT NOT NULL,  -- Text content of the chunk
  
  -- Vector embedding (Gemini text-embedding-004 produces 768 dimensions)
  embedding vector(768),
  
  -- Metadata
  metadata JSONB,  -- Additional chunk metadata (section, page, etc.)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE bazi_report_chunks IS 'Chunked report content with vector embeddings for RAG-based Q&A';
COMMENT ON COLUMN bazi_report_chunks.embedding IS 'Vector embedding (768d) from Gemini text-embedding-004 model';
COMMENT ON COLUMN bazi_report_chunks.metadata IS 'JSONB metadata: {section, subsection, keywords, etc.}';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bazi_report_chunks_report_id ON bazi_report_chunks(report_id);
CREATE INDEX IF NOT EXISTS idx_bazi_report_chunks_chunk_index ON bazi_report_chunks(report_id, chunk_index);

-- Create vector similarity search index (HNSW for fast approximate nearest neighbor search)
CREATE INDEX IF NOT EXISTS idx_bazi_report_chunks_embedding_hnsw 
ON bazi_report_chunks USING hnsw (embedding vector_cosine_ops);

-- Alternative: IVFFlat index (good for smaller datasets)
-- CREATE INDEX IF NOT EXISTS idx_bazi_report_chunks_embedding_ivfflat 
-- ON bazi_report_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);


-- ============================================================================
-- PART 5: Create qa_conversations table for Q&A sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS qa_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES bazi_reports(id) ON DELETE CASCADE,
  user_id UUID NULL,  -- References auth.users(id) when auth is enabled
  
  -- Subscription context
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'premium', 'vip')),
  
  -- Conversation data
  messages JSONB NOT NULL DEFAULT '[]',  -- Array of {role, content, timestamp}
  
  -- Metadata
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  retention_until TIMESTAMPTZ,  -- For data retention policy (e.g., 30 days for free tier)
  metadata JSONB,  -- Additional context (source chunks, ratings, etc.)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE qa_conversations IS 'Q&A conversation sessions linked to BaZi reports';
COMMENT ON COLUMN qa_conversations.messages IS 'JSONB array of messages: [{role: "user"|"assistant", content: string, timestamp: string}, ...]';
COMMENT ON COLUMN qa_conversations.subscription_tier IS 'User subscription tier for usage limit enforcement';
COMMENT ON COLUMN qa_conversations.retention_until IS 'Date when conversation will be auto-deleted (data retention policy)';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_qa_conversations_report_id ON qa_conversations(report_id);
CREATE INDEX IF NOT EXISTS idx_qa_conversations_user_id ON qa_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_qa_conversations_last_message_at ON qa_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_conversations_retention_until ON qa_conversations(retention_until) 
WHERE retention_until IS NOT NULL;


-- ============================================================================
-- PART 6: Create qa_usage_tracking table for usage limits
-- ============================================================================

CREATE TABLE IF NOT EXISTS qa_usage_tracking (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,  -- References auth.users(id) when auth is enabled
  report_id UUID NOT NULL REFERENCES bazi_reports(id) ON DELETE CASCADE,
  
  -- Subscription plan
  plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'basic', 'premium', 'vip')),
  
  -- Usage period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Usage counters
  questions_used SMALLINT NOT NULL DEFAULT 0,
  extra_questions SMALLINT NOT NULL DEFAULT 0,  -- One-time purchases
  
  -- Timestamps
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE qa_usage_tracking IS 'Tracks Q&A usage limits per user, report, and subscription period';
COMMENT ON COLUMN qa_usage_tracking.questions_used IS 'Number of questions used in current period';
COMMENT ON COLUMN qa_usage_tracking.extra_questions IS 'Additional questions purchased (one-time, non-expiring)';
COMMENT ON COLUMN qa_usage_tracking.period_start IS 'Start of billing/usage period';
COMMENT ON COLUMN qa_usage_tracking.period_end IS 'End of billing/usage period';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_qa_usage_tracking_user_id ON qa_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_qa_usage_tracking_report_id ON qa_usage_tracking(report_id);
CREATE INDEX IF NOT EXISTS idx_qa_usage_tracking_period ON qa_usage_tracking(user_id, report_id, period_start, period_end);

-- Create unique constraint to prevent duplicate tracking records
CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_usage_tracking_unique 
ON qa_usage_tracking(user_id, report_id, period_start);


-- ============================================================================
-- PART 7: Create user_subscriptions table for subscription management
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,  -- References auth.users(id) when auth is enabled
  
  -- Subscription details
  tier TEXT NOT NULL CHECK (tier IN ('free', 'basic', 'premium', 'vip')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'expired')),
  
  -- Billing period
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  
  -- Subscription management
  auto_renew BOOLEAN DEFAULT true,
  
  -- Payment integration
  external_subscription_id TEXT,  -- Razorpay subscription ID
  payment_method TEXT,  -- e.g., 'razorpay', 'card', 'upi'
  
  -- Cancellation
  cancel_at TIMESTAMPTZ NULL,  -- Scheduled cancellation date
  canceled_at TIMESTAMPTZ NULL,  -- Actual cancellation timestamp
  
  -- Metadata
  metadata JSONB,  -- Additional subscription metadata (features, limits, etc.)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE user_subscriptions IS 'User subscription management for premium features and usage limits';
COMMENT ON COLUMN user_subscriptions.tier IS 'Subscription tier: free, basic, premium, vip';
COMMENT ON COLUMN user_subscriptions.status IS 'Subscription status: active, past_due, canceled, expired';
COMMENT ON COLUMN user_subscriptions.external_subscription_id IS 'External payment provider subscription ID (e.g., Razorpay)';
COMMENT ON COLUMN user_subscriptions.auto_renew IS 'Whether subscription auto-renews at period end';
COMMENT ON COLUMN user_subscriptions.cancel_at IS 'Scheduled cancellation date (subscription remains active until then)';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_external_id ON user_subscriptions(external_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period_end ON user_subscriptions(current_period_end);

-- Create unique constraint: only one active subscription per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_active_user 
ON user_subscriptions(user_id) 
WHERE status = 'active';


-- ============================================================================
-- PART 8: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE bazi_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bazi_report_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for bazi_reports
-- ============================================================================

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON bazi_reports
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

-- Users can insert their own reports (when auth is enabled)
CREATE POLICY "Users can insert own reports" ON bazi_reports
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Users can update their own reports
CREATE POLICY "Users can update own reports" ON bazi_reports
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);

-- Users can delete their own reports
CREATE POLICY "Users can delete own reports" ON bazi_reports
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================================
-- RLS Policies for bazi_report_chunks
-- ============================================================================

-- Users can view chunks for their own reports
CREATE POLICY "Users can view chunks for own reports" ON bazi_report_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bazi_reports 
      WHERE bazi_reports.id = bazi_report_chunks.report_id 
      AND (bazi_reports.user_id = auth.uid() OR bazi_reports.user_id IS NULL)
    )
  );

-- Service role can insert chunks (embeddings generated server-side)
CREATE POLICY "Service role can insert chunks" ON bazi_report_chunks
  FOR INSERT WITH CHECK (true);

-- Service role can update chunks
CREATE POLICY "Service role can update chunks" ON bazi_report_chunks
  FOR UPDATE USING (true);

-- ============================================================================
-- RLS Policies for qa_conversations
-- ============================================================================

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations" ON qa_conversations
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

-- Users can insert their own conversations
CREATE POLICY "Users can insert own conversations" ON qa_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations" ON qa_conversations
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations" ON qa_conversations
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================================
-- RLS Policies for qa_usage_tracking
-- ============================================================================

-- Users can view their own usage tracking
CREATE POLICY "Users can view own usage" ON qa_usage_tracking
  FOR SELECT USING (user_id = auth.uid());

-- Service role can insert/update usage tracking
CREATE POLICY "Service role can manage usage tracking" ON qa_usage_tracking
  FOR ALL USING (true);

-- ============================================================================
-- RLS Policies for user_subscriptions
-- ============================================================================

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions" ON user_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own subscriptions (e.g., cancel)
CREATE POLICY "Users can update own subscriptions" ON user_subscriptions
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- PART 9: Update timestamps trigger
-- ============================================================================

-- Note: The update_updated_at_column() function is already created in migration 20241104000005
-- We only need to create triggers for the new tables

-- Add triggers for updated_at columns on new tables
DROP TRIGGER IF EXISTS update_bazi_reports_updated_at ON bazi_reports;
CREATE TRIGGER update_bazi_reports_updated_at BEFORE UPDATE ON bazi_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_qa_conversations_updated_at ON qa_conversations;
CREATE TRIGGER update_qa_conversations_updated_at BEFORE UPDATE ON qa_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_qa_usage_tracking_updated_at ON qa_usage_tracking;
CREATE TRIGGER update_qa_usage_tracking_updated_at BEFORE UPDATE ON qa_usage_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- PART 10: Summary
-- ============================================================================

-- Migration complete!
-- 
-- This migration adds:
-- 1. Vector extension for embeddings
-- 2. Extended charts table with day_master, ten_gods, luck_cycles
-- 3. bazi_reports table for AI-generated reports
-- 4. bazi_report_chunks table with 768d vector embeddings for RAG
-- 5. qa_conversations table for Q&A sessions
-- 6. qa_usage_tracking table for usage limits
-- 7. user_subscriptions table for subscription management
-- 8. Comprehensive RLS policies for all tables
-- 9. Indexes for efficient querying and vector search
-- 10. Automatic updated_at timestamp triggers

