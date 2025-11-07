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
| `20241106000003_add_razorpay_columns.sql` | **NEW**: Adds Razorpay payment columns to lamps table while preserving Stripe legacy data |
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

### Indexes

- `idx_profiles_user_id` — Speeds up queries filtering by user_id
- `idx_charts_profile_id` — Speeds up queries filtering by profile_id
- `idx_jobs_chart_id` — Speeds up queries filtering by chart_id
- `idx_jobs_status` — Speeds up queries filtering by job_status
- `idx_jobs_user_id` — Speeds up queries filtering by user_id
- `idx_lamps_user_id` — Speeds up queries filtering by user_id
- `idx_lamps_lamp_key` — Speeds up queries filtering by lamp_key
- `idx_lamps_status` — Speeds up queries filtering by status
- `idx_lamps_checkout_session_id` — Speeds up queries filtering by Stripe session ID (legacy)
- `idx_lamps_razorpay_payment_link_id` — Speeds up queries filtering by Razorpay payment link ID
- `idx_lamps_razorpay_payment_id` — Speeds up queries filtering by Razorpay payment ID

## Row Level Security (RLS)

### Profiles Table
- Users can view/insert/update/delete their own profiles (via `user_id = auth.uid()`)
- Anonymous profile creation allowed (for MVP only, `user_id IS NULL`)

### Charts Table
- Users can view charts for their own profiles
- Inserts/updates handled by service role only (server-side)

### Jobs Table
- Users can view their own jobs
- Inserts/updates handled by service role only (server-side)

### Service Role Key
The service role key bypasses all RLS policies. All API routes use `supabaseService` (service role client) for unrestricted database access. This is acceptable for MVP but should be refined for production.

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

---

**Last Updated**: 2024-11-04
