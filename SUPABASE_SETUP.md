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
   ```
4. Verify with the test script:
   ```
   /supabase/migrations/99_test_setup.sql
   ```

## What Was Created

### Tables
- **profiles**: User profiles with birth information
- **charts**: BaZi charts linked to profiles
- **jobs**: Async job queue for background tasks

### Indexes
- `idx_profiles_user_id`
- `idx_charts_profile_id`
- `idx_jobs_chart_id`
- `idx_jobs_status`
- `idx_jobs_user_id`

### RLS Policies
- Profiles: Users can view/edit their own profiles; anonymous creation allowed for MVP
- Charts: Users can view charts for their own profiles
- Jobs: Users can view their own jobs

### Storage
- **reports** bucket: Public read access for PDF reports

## Service Role Key

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
