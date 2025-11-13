# Supabase Migrations

This directory contains SQL migration files for setting up the Eastern Destiny database schema, Row Level Security (RLS) policies, and storage configuration.

## Quick Start

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order:
   - `20241104000001_create_tables.sql` — Creates tables and indexes
   - `20241104000002_enable_rls.sql` — Enables RLS and creates policies
   - `20241104000003_create_storage.sql` — Creates storage bucket for reports
4. (Optional) Run `99_test_setup.sql` to verify everything is set up correctly

## Migration Files

| File | Description |
|------|-------------|
| `20241104000001_create_tables.sql` | Creates `profiles`, `charts`, and `jobs` tables with proper relationships, indexes, and constraints |
| `20241104000002_enable_rls.sql` | Enables Row Level Security on all tables and creates policies for user data access |
| `20241104000003_create_storage.sql` | Creates the `reports` storage bucket for PDF report files with public read access |
| `20241106000001_create_lamps_table.sql` | Creates `lamps` table for Prayer Lamps feature with Stripe checkout session tracking |
| `20241106000002_create_fortunes_table.sql` | Creates `fortunes` table for Daily Fortune feature with session-based tracking |
| `20241106000003_add_razorpay_columns.sql` | Adds Razorpay payment columns to lamps table while preserving Stripe legacy data |
| `20241109000001_enable_fortunes_rls.sql` | Enables RLS policies for fortunes table for anonymous access |
| `20241110000001_extend_schema_reports_subscriptions.sql` | **NEW**: Extends charts table, adds vector extension, creates tables for AI reports, embeddings (RAG), Q&A conversations, usage tracking, and subscriptions |
| `20251112000001_fix_fortunes_rls_policies.sql` | **FIX**: Updates fortunes RLS policies to properly allow public and anonymous read access, following the same pattern as lamps table |
| `20241223000001_fix_fortunes_rls_public_read.sql` | **FIX**: Removes restrictive RLS conditions and enables true public read access to fortunes table |
| `20241224000001_fortunes_rls_service_role_fix.sql` | **FIX**: Ensures service_role (API endpoints) has explicit access to fortunes table, prevents "permission denied" errors |
| `99_test_setup.sql` | Test script to verify database setup (optional) |
| `99_test_razorpay_migration.sql` | Test script to verify Razorpay migration (optional) |

## Database Schema

### Tables

#### `profiles`
Stores user profile information and birth details for BaZi calculations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | Foreign key to `auth.users` (NULL for MVP) |
| `name` | TEXT | User's name |
| `birth_local` | TEXT | ISO 8601 datetime string in local timezone |
| `birth_timezone` | TEXT | IANA timezone string (e.g., 'America/New_York') |
| `gender` | TEXT | Gender |
| `lat` | NUMERIC | Latitude (optional) |
| `lon` | NUMERIC | Longitude (optional) |
| `created_at` | TIMESTAMPTZ | Timestamp when profile was created |

#### `charts`
Stores computed BaZi charts linked to profiles.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `profile_id` | UUID | Foreign key to `profiles.id` (cascades on delete) |
| `chart_json` | JSONB | Full BaZi chart data (Four Pillars, etc.) |
| `wuxing_scores` | JSONB | Five Elements scores |
| `ai_summary` | TEXT | AI-generated interpretation summary (optional) |
| `day_master` | TEXT | Day Master (日主) - Heavenly Stem of Day Pillar |
| `ten_gods` | JSONB | Ten Gods (十神) relationships by pillar |
| `luck_cycles` | JSONB | Luck Cycles (大运) 10-year periods |
| `created_at` | TIMESTAMPTZ | Timestamp when chart was created |

#### `jobs`
Tracks async background jobs (e.g., report generation).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | Foreign key to `auth.users` (NULL for MVP) |
| `chart_id` | UUID | Foreign key to `charts.id` (cascades on delete) |
| `job_type` | TEXT | Type of job (e.g., 'report_generation') |
| `status` | TEXT | Job status: 'pending', 'processing', 'done', 'failed' |
| `result_url` | TEXT | URL to generated result (optional) |
| `created_at` | TIMESTAMPTZ | Timestamp when job was created |
| `metadata` | JSONB | Additional job metadata (e.g., razorpay_payment_link_id/razorpay_payment_id for payment tracking) |

#### `lamps`
Stores prayer lamp state and payment information for the Prayer Lamps feature.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | Foreign key to `auth.users` (NULL for MVP) |
| `lamp_key` | TEXT | Unique lamp identifier (p1, p2, p3, p4) corresponding to image files |
| `status` | TEXT | Current state: 'unlit' (available) or 'lit' (purchased) |
| `checkout_session_id` | TEXT | **LEGACY**: Stripe checkout session ID (deprecated) |
| `razorpay_payment_link_id` | TEXT | Razorpay payment link ID for pending payments |
| `razorpay_payment_id` | TEXT | Razorpay payment ID for completed payments |
| `created_at` | TIMESTAMPTZ | Timestamp when lamp record was created |
| `updated_at` | TIMESTAMPTZ | Timestamp when lamp record was last updated |

#### `fortunes`
Stores daily fortune draws with session-based tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `session_id` | TEXT | Session identifier for one-draw-per-day tracking |
| `category` | TEXT | Fortune category (15 types: 事业, 财运, 爱情, 健康, 学业, 旅行, 交友, 家庭, 投资, 创意, 运动, 购物, 娱乐, 美食, 宠物) |
| `fortune_text` | TEXT | The fortune text/content |
| `ai_analysis` | TEXT | AI-generated interpretation and analysis |
| `created_at` | TIMESTAMPTZ | Timestamp when fortune was drawn |

#### `bazi_reports`
Stores AI-generated BaZi reports for character analysis and yearly flow predictions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `chart_id` | UUID | Foreign key to `charts.id` (cascades on delete) |
| `user_id` | UUID | Foreign key to `auth.users` (NULL for MVP) |
| `report_type` | TEXT | Type: 'character_profile' or 'yearly_flow' |
| `title` | TEXT | Report title |
| `summary` | JSONB | Executive summary with key insights |
| `structured` | JSONB | Structured report sections for programmatic access |
| `body` | TEXT | Full report content (markdown/plaintext) |
| `model` | TEXT | AI model used (e.g., 'gemini-2.5-pro') |
| `prompt_version` | TEXT | Prompt template version |
| `tokens` | INT | Total tokens used in generation |
| `status` | TEXT | Status: 'pending', 'processing', 'completed', 'failed' |
| `created_at` | TIMESTAMPTZ | Timestamp when report was created |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |
| `completed_at` | TIMESTAMPTZ | Completion timestamp |

#### `bazi_report_chunks`
Stores chunked report content with vector embeddings for RAG-based Q&A.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Primary key (auto-increment) |
| `report_id` | UUID | Foreign key to `bazi_reports.id` (cascades on delete) |
| `chunk_index` | INT | Sequential index within report |
| `content` | TEXT | Text content of the chunk |
| `embedding` | VECTOR(768) | Vector embedding from Gemini text-embedding-004 |
| `metadata` | JSONB | Additional metadata (section, keywords, etc.) |
| `created_at` | TIMESTAMPTZ | Timestamp when chunk was created |

#### `qa_conversations`
Stores Q&A conversation sessions linked to BaZi reports.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `report_id` | UUID | Foreign key to `bazi_reports.id` (cascades on delete) |
| `user_id` | UUID | Foreign key to `auth.users` (NULL for MVP) |
| `subscription_tier` | TEXT | Subscription tier: 'free', 'basic', 'premium', 'vip' |
| `messages` | JSONB | Array of messages: `[{role, content, timestamp}, ...]` |
| `last_message_at` | TIMESTAMPTZ | Timestamp of last message |
| `retention_until` | TIMESTAMPTZ | Auto-deletion date (data retention policy) |
| `metadata` | JSONB | Additional context (source chunks, ratings, etc.) |
| `created_at` | TIMESTAMPTZ | Timestamp when conversation was created |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

#### `qa_usage_tracking`
Tracks Q&A usage limits per user, report, and subscription period.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Primary key (auto-increment) |
| `user_id` | UUID | Foreign key to `auth.users` |
| `report_id` | UUID | Foreign key to `bazi_reports.id` (cascades on delete) |
| `plan_tier` | TEXT | Plan tier: 'free', 'basic', 'premium', 'vip' |
| `period_start` | TIMESTAMPTZ | Start of billing/usage period |
| `period_end` | TIMESTAMPTZ | End of billing/usage period |
| `questions_used` | SMALLINT | Questions used in current period |
| `extra_questions` | SMALLINT | Additional questions purchased (one-time) |
| `last_reset_at` | TIMESTAMPTZ | Last usage reset timestamp |
| `created_at` | TIMESTAMPTZ | Timestamp when tracking record was created |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

#### `user_subscriptions`
Manages user subscriptions for premium features and usage limits.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | Foreign key to `auth.users` |
| `tier` | TEXT | Subscription tier: 'free', 'basic', 'premium', 'vip' |
| `status` | TEXT | Status: 'active', 'past_due', 'canceled', 'expired' |
| `current_period_start` | TIMESTAMPTZ | Start of current billing period |
| `current_period_end` | TIMESTAMPTZ | End of current billing period |
| `auto_renew` | BOOLEAN | Whether subscription auto-renews |
| `external_subscription_id` | TEXT | External payment provider ID (Razorpay) |
| `payment_method` | TEXT | Payment method (e.g., 'razorpay', 'card', 'upi') |
| `cancel_at` | TIMESTAMPTZ | Scheduled cancellation date |
| `canceled_at` | TIMESTAMPTZ | Actual cancellation timestamp |
| `metadata` | JSONB | Additional subscription metadata |
| `created_at` | TIMESTAMPTZ | Timestamp when subscription was created |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### Extensions

- **uuid-ossp**: UUID generation
- **vector**: pgvector extension for vector similarity search (768-dimensional embeddings)

### Indexes

#### Core Tables
- `idx_profiles_user_id` — Speeds up queries filtering by user_id
- `idx_charts_profile_id` — Speeds up queries filtering by profile_id
- `idx_charts_day_master` — Speeds up queries filtering by day master
- `idx_charts_ten_gods` — GIN index for JSONB ten_gods queries
- `idx_charts_luck_cycles` — GIN index for JSONB luck_cycles queries
- `idx_jobs_chart_id` — Speeds up queries filtering by chart_id
- `idx_jobs_status` — Speeds up queries filtering by job_status
- `idx_jobs_user_id` — Speeds up queries filtering by user_id

#### Feature Tables
- `idx_lamps_user_id` — Speeds up queries filtering by user_id
- `idx_lamps_lamp_key` — Speeds up queries filtering by lamp_key
- `idx_lamps_status` — Speeds up queries filtering by status
- `idx_lamps_checkout_session_id` — Speeds up queries filtering by Stripe session ID (legacy)
- `idx_lamps_razorpay_payment_link_id` — Speeds up queries filtering by Razorpay payment link ID
- `idx_lamps_razorpay_payment_id` — Speeds up queries filtering by Razorpay payment ID

#### Reports and AI
- `idx_bazi_reports_chart_id` — Speeds up queries filtering by chart_id
- `idx_bazi_reports_user_id` — Speeds up queries filtering by user_id
- `idx_bazi_reports_type` — Speeds up queries filtering by report_type
- `idx_bazi_reports_status` — Speeds up queries filtering by status
- `idx_bazi_reports_created_at` — Speeds up time-based queries
- `idx_bazi_report_chunks_report_id` — Speeds up queries filtering by report_id
- `idx_bazi_report_chunks_chunk_index` — Speeds up chunk ordering queries
- `idx_bazi_report_chunks_embedding_hnsw` — HNSW vector similarity search index

#### Q&A and Usage
- `idx_qa_conversations_report_id` — Speeds up queries filtering by report_id
- `idx_qa_conversations_user_id` — Speeds up queries filtering by user_id
- `idx_qa_conversations_last_message_at` — Speeds up time-based queries
- `idx_qa_conversations_retention_until` — Speeds up data retention cleanup
- `idx_qa_usage_tracking_user_id` — Speeds up queries filtering by user_id
- `idx_qa_usage_tracking_report_id` — Speeds up queries filtering by report_id
- `idx_qa_usage_tracking_period` — Speeds up period-based queries
- `idx_qa_usage_tracking_unique` — Ensures unique tracking records per period

#### Subscriptions
- `idx_user_subscriptions_user_id` — Speeds up queries filtering by user_id
- `idx_user_subscriptions_status` — Speeds up queries filtering by status
- `idx_user_subscriptions_external_id` — Speeds up queries by external subscription ID
- `idx_user_subscriptions_period_end` — Speeds up renewal/expiration checks
- `idx_user_subscriptions_active_user` — Ensures only one active subscription per user

## Row Level Security (RLS)

### Core Tables

#### Profiles Table
- Users can view/insert/update/delete their own profiles (via `user_id = auth.uid()`)
- Anonymous profile creation allowed (for MVP only, `user_id IS NULL`)

#### Charts Table
- Users can view charts for their own profiles
- Inserts/updates handled by service role only (server-side)

#### Jobs Table
- Users can view their own jobs
- Inserts/updates handled by service role only (server-side)

### Reports and AI

#### BaZi Reports Table
- Users can view/insert/update/delete their own reports
- Anonymous access allowed for MVP (`user_id IS NULL`)

#### BaZi Report Chunks Table
- Users can view chunks for their own reports
- Service role handles insert/update (embeddings generated server-side)

### Q&A and Subscriptions

#### Q&A Conversations Table
- Users can view/insert/update/delete their own conversations
- Anonymous access allowed for MVP (`user_id IS NULL`)

#### Q&A Usage Tracking Table
- Users can view their own usage statistics
- Service role manages all insert/update operations

#### User Subscriptions Table
- Users can view/insert/update their own subscriptions
- Critical for enforcing feature access and usage limits

### Service Role Key
The service role key bypasses all RLS policies. All API routes use `supabaseService` (service role client) for unrestricted database access. This is acceptable for MVP but should be refined for production.

**Important**: The `SUPABASE_SERVICE_ROLE_KEY` environment variable must be configured:
- **Local development**: Create `.env.local` and add the service role key
- **Vercel production**: Configure in Environment Variables settings
- **Key format**: Must start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`
- **Security**: Never expose this key in client-side code or commit to Git

If you encounter "permission denied for table fortunes" errors, verify:
1. Environment variable is properly set (not a placeholder)
2. RLS policies are applied (run latest migration)
3. API code uses `supabaseService` client (not `supabase`)

See `FORTUNE_API_FIX_GUIDE.md` for detailed troubleshooting.

## Storage

### `reports` Bucket
- **Public**: Yes (allows public read access to generated reports)
- **Purpose**: Stores PDF fortune reports generated by the worker
- **Upload Policy**: Server-side only (via service role)
- **Read Policy**: Public access for all files

## Testing

To verify your setup, run the test script in Supabase SQL Editor:

```bash
# In Supabase SQL Editor, run:
/supabase/migrations/99_test_setup.sql
```

This will:
1. Check that all tables exist
2. Verify RLS is enabled
3. Verify indexes are created
4. List all RLS policies
5. Check storage bucket configuration
6. Test insert/select operations
7. Verify foreign key relationships

## For More Details

See [README_DEPLOY.md](/README_DEPLOY.md) for comprehensive deployment instructions, including:
- Step-by-step Supabase setup guide
- Environment variable configuration
- Deployment to Vercel/Railway/etc.
- Troubleshooting common issues

## Notes

- **MVP Limitations**: This schema is designed for MVP with minimal authentication. For production, implement proper Supabase Auth integration.
- **Service Role Usage**: All server-side API routes use the service role key to bypass RLS. This is intentional for MVP simplicity.
- **Security**: Never expose the service role key to client-side code. It should only be used in API routes and the background worker.
- **Vector Extension**: The pgvector extension is required for the RAG-based Q&A feature. Ensure it's enabled before running the migration.
- **Embedding Dimension**: We use 768-dimensional embeddings from Gemini's `text-embedding-004` model. If using a different model, adjust the vector dimension in the migration.

---

**Last Updated**: 2024-11-10 (Added reports, embeddings, Q&A, and subscription tables)
