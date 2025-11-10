# BaZi Reports, RAG Q&A, and Subscription System

This document provides detailed information about the expanded database schema for AI-generated BaZi reports, vector embeddings for RAG-based Q&A, and subscription management.

## Overview

The `20241110000001_extend_schema_reports_subscriptions.sql` migration introduces several new capabilities:

1. **Enhanced Charts**: Additional BaZi analysis fields (day_master, ten_gods, luck_cycles)
2. **AI Reports**: Structured storage for AI-generated character profiles and yearly flow reports
3. **Vector Embeddings**: RAG (Retrieval-Augmented Generation) system for intelligent Q&A
4. **Conversations**: Multi-turn Q&A sessions with context retention
5. **Usage Tracking**: Question limit enforcement per subscription tier
6. **Subscriptions**: Razorpay-integrated subscription management

## Database Schema

### 1. Extended Charts Table

New columns added to the existing `charts` table:

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `day_master` | TEXT | Heavenly Stem of Day Pillar (日主) | '甲', '乙', '丙', etc. |
| `ten_gods` | JSONB | Ten Gods relationships | `{"year_stem": "正财", "month_branch": "食神"}` |
| `luck_cycles` | JSONB | 10-year luck periods (大运) | `[{age_start: 5, age_end: 15, stem: "甲", branch: "子"}]` |

**Indexes**:
- `idx_charts_day_master` — B-tree index for filtering by day master
- `idx_charts_ten_gods` — GIN index for JSONB queries
- `idx_charts_luck_cycles` — GIN index for JSONB queries

### 2. BaZi Reports Table

Stores AI-generated reports for character analysis and yearly flow predictions.

**Schema**:
```sql
CREATE TABLE bazi_reports (
  id UUID PRIMARY KEY,
  chart_id UUID REFERENCES charts(id) ON DELETE CASCADE,
  user_id UUID,  -- NULL for anonymous users
  report_type TEXT CHECK (IN ('character_profile', 'yearly_flow')),
  title TEXT NOT NULL,
  summary JSONB,  -- Key insights and highlights
  structured JSONB,  -- Programmatic access to sections
  body TEXT,  -- Full markdown content
  model TEXT,  -- e.g., 'gemini-2.5-pro'
  prompt_version TEXT,  -- Track prompt template versions
  tokens INT,  -- Token usage for billing/analytics
  status TEXT CHECK (IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

**Report Types**:
- `character_profile` — Personality analysis, strengths, weaknesses, career guidance
- `yearly_flow` — Annual predictions, month-by-month analysis, lucky periods

**Example `summary` JSONB**:
```json
{
  "key_insights": [
    "Strong Wood element indicates creativity",
    "Metal deficiency suggests communication challenges"
  ],
  "strengths": ["决策能力", "领导力"],
  "areas_for_growth": ["耐心", "情绪管理"],
  "lucky_elements": ["木", "水"],
  "unlucky_elements": ["金"]
}
```

**Example `structured` JSONB**:
```json
{
  "sections": [
    {
      "title": "个性特征",
      "content": "...",
      "subsections": [...]
    },
    {
      "title": "事业运势",
      "content": "...",
      "keywords": ["career", "work", "business"]
    }
  ]
}
```

### 3. BaZi Report Chunks Table

Stores chunked report content with vector embeddings for RAG-based semantic search.

**Schema**:
```sql
CREATE TABLE bazi_report_chunks (
  id BIGSERIAL PRIMARY KEY,
  report_id UUID REFERENCES bazi_reports(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),  -- Gemini text-embedding-004
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Vector Embedding**:
- **Model**: Gemini `text-embedding-004`
- **Dimensions**: 768
- **Use Case**: Semantic search to find relevant report sections for Q&A

**Chunking Strategy**:
- **Size**: 500-1000 characters per chunk (optimal for context)
- **Overlap**: 100-200 characters between chunks (maintain continuity)
- **Metadata**: Section title, keywords, importance score

**Example `metadata` JSONB**:
```json
{
  "section": "事业运势",
  "subsection": "2024年上半年",
  "keywords": ["career", "work", "promotion"],
  "importance": 0.85,
  "page": 3
}
```

**Vector Search Index**:
- `idx_bazi_report_chunks_embedding_hnsw` — HNSW index for fast approximate nearest neighbor search
- Supports cosine similarity search: `ORDER BY embedding <=> query_embedding`

### 4. Q&A Conversations Table

Stores multi-turn conversation sessions for report Q&A.

**Schema**:
```sql
CREATE TABLE qa_conversations (
  id UUID PRIMARY KEY,
  report_id UUID REFERENCES bazi_reports(id) ON DELETE CASCADE,
  user_id UUID,
  subscription_tier TEXT CHECK (IN ('free', 'basic', 'premium', 'vip')),
  messages JSONB NOT NULL DEFAULT '[]',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  retention_until TIMESTAMPTZ,  -- Data retention policy
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Messages Format**:
```json
[
  {
    "role": "user",
    "content": "我的事业运势如何？",
    "timestamp": "2024-11-10T10:30:00Z"
  },
  {
    "role": "assistant",
    "content": "根据您的八字...",
    "timestamp": "2024-11-10T10:30:15Z",
    "sources": [
      {"chunk_id": 123, "similarity": 0.92},
      {"chunk_id": 456, "similarity": 0.87}
    ]
  }
]
```

**Metadata**:
```json
{
  "total_questions": 5,
  "average_response_time_ms": 2500,
  "satisfaction_rating": 4.5,
  "topics": ["career", "relationships", "health"]
}
```

**Retention Policy**:
- Free tier: 30 days
- Basic tier: 90 days
- Premium tier: 1 year
- VIP tier: Indefinite

### 5. Q&A Usage Tracking Table

Tracks question usage limits per user and subscription period.

**Schema**:
```sql
CREATE TABLE qa_usage_tracking (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  report_id UUID REFERENCES bazi_reports(id) ON DELETE CASCADE,
  plan_tier TEXT CHECK (IN ('free', 'basic', 'premium', 'vip')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  questions_used SMALLINT DEFAULT 0,
  extra_questions SMALLINT DEFAULT 0,  -- One-time purchases
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Usage Limits by Tier**:
| Tier | Questions/Month | Price | Extra Questions |
|------|-----------------|-------|-----------------|
| Free | 3 | ¥0 | ¥5/question |
| Basic | 10 | ¥29/month | ¥3/question |
| Premium | 50 | ¥99/month | ¥2/question |
| VIP | Unlimited | ¥299/month | N/A |

**Unique Constraint**:
- `idx_qa_usage_tracking_unique` on `(user_id, report_id, period_start)`
- Prevents duplicate tracking records

### 6. User Subscriptions Table

Manages user subscriptions and billing.

**Schema**:
```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  tier TEXT CHECK (IN ('free', 'basic', 'premium', 'vip')),
  status TEXT CHECK (IN ('active', 'past_due', 'canceled', 'expired')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN DEFAULT TRUE,
  external_subscription_id TEXT,  -- Razorpay subscription ID
  payment_method TEXT,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Subscription Status**:
- `active` — Currently active, user has full access
- `past_due` — Payment failed, grace period active
- `canceled` — Scheduled for cancellation at period end
- `expired` — Period ended, no auto-renewal

**Metadata**:
```json
{
  "features": {
    "ai_reports": true,
    "qa_unlimited": true,
    "priority_support": true
  },
  "limits": {
    "reports_per_month": 10,
    "questions_per_report": 50
  },
  "discount": {
    "code": "LAUNCH50",
    "percent": 50,
    "valid_until": "2024-12-31"
  }
}
```

**Unique Constraint**:
- `idx_user_subscriptions_active_user` on `user_id WHERE status = 'active'`
- Only one active subscription per user

## Row Level Security (RLS)

All new tables have RLS enabled with appropriate policies:

### BaZi Reports
- ✅ Users can view their own reports
- ✅ Anonymous users can view reports (MVP mode)
- ✅ Service role can insert/update/delete

### BaZi Report Chunks
- ✅ Users can view chunks for their own reports
- ⚠️ Service role only for insert/update (embeddings generated server-side)

### Q&A Conversations
- ✅ Users can view/insert/update/delete their own conversations
- ✅ Anonymous users can create conversations (MVP mode)

### Q&A Usage Tracking
- ✅ Users can view their own usage stats
- ⚠️ Service role only for insert/update (prevent tampering)

### User Subscriptions
- ✅ Users can view their own subscriptions
- ✅ Users can insert/update their own subscriptions
- ⚠️ Critical for access control and feature gating

## Environment Variables

Add these to your `.env.local`:

```bash
# Gemini Embedding Model
GEMINI_MODEL_EMBEDDING=text-embedding-004

# Razorpay Subscription Plans
RAZORPAY_PLAN_BASIC=plan_basic_xxx
RAZORPAY_PLAN_PREMIUM=plan_premium_xxx
RAZORPAY_PLAN_VIP=plan_vip_xxx
```

## Usage Examples

### 1. Generate a Report

```typescript
// Generate report
const { data: report } = await supabase
  .from('bazi_reports')
  .insert({
    chart_id: chartId,
    user_id: userId,
    report_type: 'character_profile',
    title: '个性分析报告',
    status: 'pending'
  })
  .select()
  .single()

// Generate chunks and embeddings
const chunks = chunkReport(reportBody, { size: 800, overlap: 150 })
for (const [index, chunk] of chunks.entries()) {
  const embedding = await generateEmbedding(chunk.content)
  await supabase.from('bazi_report_chunks').insert({
    report_id: report.id,
    chunk_index: index,
    content: chunk.content,
    embedding: embedding,
    metadata: chunk.metadata
  })
}
```

### 2. RAG-based Q&A

```typescript
// 1. Get question embedding
const questionEmbedding = await generateEmbedding(question)

// 2. Find relevant chunks using vector similarity
const { data: chunks } = await supabase.rpc('match_report_chunks', {
  query_embedding: questionEmbedding,
  match_threshold: 0.7,
  match_count: 5,
  report_id: reportId
})

// 3. Build context from chunks
const context = chunks.map(c => c.content).join('\n\n')

// 4. Generate answer with Gemini
const prompt = `基于以下报告内容，回答用户问题：

报告内容：
${context}

用户问题：${question}

请提供准确、有帮助的回答。`

const answer = await gemini.generateContent(prompt)

// 5. Save to conversation
await supabase.from('qa_conversations').update({
  messages: [...existingMessages, {
    role: 'user',
    content: question,
    timestamp: new Date().toISOString()
  }, {
    role: 'assistant',
    content: answer,
    timestamp: new Date().toISOString(),
    sources: chunks.map(c => ({ chunk_id: c.id, similarity: c.similarity }))
  }]
}).eq('id', conversationId)
```

### 3. Check Usage Limits

```typescript
// Check if user can ask more questions
async function canAskQuestion(userId: string, reportId: string) {
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  const tier = subscription?.tier || 'free'
  
  // VIP has unlimited questions
  if (tier === 'vip') return true

  const { data: usage } = await supabase
    .from('qa_usage_tracking')
    .select('questions_used, extra_questions')
    .eq('user_id', userId)
    .eq('report_id', reportId)
    .gte('period_end', new Date().toISOString())
    .single()

  const limits = {
    free: 3,
    basic: 10,
    premium: 50
  }

  const limit = limits[tier] + (usage?.extra_questions || 0)
  return (usage?.questions_used || 0) < limit
}
```

### 4. Create Subscription

```typescript
// Create Razorpay subscription
const razorpay = new Razorpay({ ... })
const subscription = await razorpay.subscriptions.create({
  plan_id: process.env.RAZORPAY_PLAN_PREMIUM,
  customer_notify: 1,
  total_count: 12,  // 12 months
  notes: {
    user_id: userId
  }
})

// Save to database
await supabase.from('user_subscriptions').insert({
  user_id: userId,
  tier: 'premium',
  status: 'active',
  current_period_start: new Date(),
  current_period_end: addMonths(new Date(), 1),
  external_subscription_id: subscription.id,
  payment_method: 'razorpay'
})
```

## Vector Similarity Search Function

Create this PostgreSQL function for efficient vector search:

```sql
CREATE OR REPLACE FUNCTION match_report_chunks(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  report_id uuid
)
RETURNS TABLE (
  id bigint,
  report_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bazi_report_chunks.id,
    bazi_report_chunks.report_id,
    bazi_report_chunks.content,
    bazi_report_chunks.metadata,
    1 - (bazi_report_chunks.embedding <=> query_embedding) as similarity
  FROM bazi_report_chunks
  WHERE bazi_report_chunks.report_id = match_report_chunks.report_id
    AND 1 - (bazi_report_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY bazi_report_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Performance Considerations

### Indexes
- **HNSW Index**: Fast approximate nearest neighbor search (< 10ms for 10k vectors)
- **GIN Indexes**: Efficient JSONB queries on metadata
- **Composite Indexes**: Optimized for common query patterns

### Chunking Strategy
- **Optimal Size**: 500-1000 characters (2-3 paragraphs)
- **Overlap**: 100-200 characters (maintain context)
- **Metadata**: Rich metadata for filtering and ranking

### Caching
- **Embeddings**: Cache frequently accessed embeddings
- **Search Results**: Cache popular questions
- **Conversations**: Redis cache for active sessions

## Migration Verification

Run these checks after migration:

```sql
-- 1. Check vector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 2. Verify new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'charts' 
  AND column_name IN ('day_master', 'ten_gods', 'luck_cycles');

-- 3. Verify new tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE 'bazi%' OR tablename LIKE 'qa%' OR tablename = 'user_subscriptions';

-- 4. Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('bazi_reports', 'bazi_report_chunks', 'qa_conversations');

-- 5. Verify RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('bazi_reports', 'bazi_report_chunks', 'qa_conversations', 'user_subscriptions');
```

## Troubleshooting

### Vector Extension Not Available
```bash
# Install pgvector on Supabase (usually pre-installed)
# If not, contact Supabase support or use Supabase SQL Editor:
CREATE EXTENSION IF NOT EXISTS vector;
```

### Embedding Dimension Mismatch
If using a different embedding model, update the migration:
```sql
-- For OpenAI text-embedding-ada-002 (1536 dimensions)
ALTER TABLE bazi_report_chunks 
ALTER COLUMN embedding TYPE vector(1536);
```

### RLS Policy Issues
If users can't access their data:
```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'bazi_reports';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'bazi_reports';
```

---

**Migration File**: `20241110000001_extend_schema_reports_subscriptions.sql`  
**Created**: 2024-11-10  
**Status**: Ready for production
