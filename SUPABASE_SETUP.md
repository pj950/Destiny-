# Supabase Setup Summary

This document provides a quick reference for the Supabase database schema and setup.

## Quick Setup

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migration files in order:
   ```
   /supabase/migrations/20241104000001_create_tables.sql
   /supabase/migrations/20241104000002_enable_rls.sql
   /supabase/migrations/20241104000003_create_storage.sql
   /supabase/migrations/20241106000001_create_lamps_table.sql
   /supabase/migrations/20241106000002_create_fortunes_table.sql
   /supabase/migrations/20241106000003_add_razorpay_columns.sql
   /supabase/migrations/20241109000001_enable_fortunes_rls.sql
   /supabase/migrations/20241110000001_extend_schema_reports_subscriptions.sql
   ```
4. Verify with the test script (optional):
   ```
   /supabase/migrations/99_test_setup.sql
   ```

## What Was Created

### Core Tables
- **profiles**: User profiles with birth information
- **charts**: BaZi charts linked to profiles (extended with day_master, ten_gods, luck_cycles)
- **jobs**: Async job queue for background tasks

### Feature Tables
- **lamps**: Prayer lamps with Razorpay payment tracking
- **fortunes**: Daily fortune draws with session-based tracking

### Reports and AI (NEW)
- **bazi_reports**: AI-generated BaZi reports (character profiles, yearly flow)
- **bazi_report_chunks**: Chunked report content with vector embeddings for RAG
- **qa_conversations**: Q&A conversation sessions linked to reports
- **qa_usage_tracking**: Usage limit tracking per user and subscription period
- **user_subscriptions**: Subscription management and billing

### Extensions
- **uuid-ossp**: UUID generation
- **vector**: pgvector for 768-dimensional embeddings (Gemini text-embedding-004)

### Key Indexes
- Profile and chart lookups
- Report and chunk queries
- Vector similarity search (HNSW index on embeddings)
- Q&A conversation and usage tracking
- Subscription management and period queries

See [supabase/README.md](./supabase/README.md) for complete index documentation.

### RLS Policies
- **Core Tables**: Users can view/edit their own data; anonymous access for MVP
- **Reports**: Users can manage their own reports and chunks
- **Q&A**: Users can manage their own conversations and view usage stats
- **Subscriptions**: Users can view/update their own subscriptions

### Storage
- **reports** bucket: Public read access for PDF reports

## Environment Variables

### Required Configuration

Add the following to your `.env.local` file:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google AI (Gemini)
GOOGLE_API_KEY=your-google-api-key
GEMINI_MODEL_SUMMARY=gemini-2.5-pro
GEMINI_MODEL_REPORT=gemini-2.5-pro
GEMINI_MODEL_EMBEDDING=text-embedding-004

# Razorpay
RAZORPAY_KEY_ID=rzk_test_xxx
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# Razorpay Subscription Plans (for premium features)
RAZORPAY_PLAN_BASIC=plan_basic_xxx
RAZORPAY_PLAN_PREMIUM=plan_premium_xxx
RAZORPAY_PLAN_VIP=plan_vip_xxx
```

### Service Role Key

⚠️ **Important**: The service role key bypasses all RLS policies. It is used in:
- All API routes (`/pages/api/*`)
- Background worker (`/worker/worker.ts`)

This key should **never** be exposed to client-side code.

## For More Information

- **Detailed Deployment Guide**: See [README_DEPLOY.md](./README_DEPLOY.md)
- **Supabase Directory**: See [supabase/README.md](./supabase/README.md)
- **Main Documentation**: See [README.md](./README.md)

---

**Created**: 2024-11-04
