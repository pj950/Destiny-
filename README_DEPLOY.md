# Eastern Destiny — Deployment Guide

This document provides step-by-step instructions for deploying the Eastern Destiny MVP application, including Supabase database setup, Row Level Security (RLS) configuration, storage setup, and production deployment.

---

## Table of Contents

1. [Supabase Database Setup](#1-supabase-database-setup)
2. [Row Level Security (RLS)](#2-row-level-security-rls)
3. [Storage Bucket Configuration](#3-storage-bucket-configuration)
4. [Environment Variables](#4-environment-variables)
5. [Deploy Next.js Application](#5-deploy-nextjs-application)
6. [Deploy Background Worker](#6-deploy-background-worker)
7. [Stripe Configuration](#7-stripe-configuration)
8. [Testing Your Deployment](#8-testing-your-deployment)
9. [Production Checklist](#9-production-checklist)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Supabase Database Setup

### Step 1.1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Project Name**: `eastern-destiny` (or your preferred name)
   - **Database Password**: Generate a secure password and save it
   - **Region**: Choose the region closest to your users
4. Click **"Create new project"** and wait for provisioning (2-3 minutes)

### Step 1.2: Run Database Migrations

Navigate to your Supabase project dashboard, then go to **SQL Editor**.

#### Migration 1: Create Tables

Copy and paste the contents of `/supabase/migrations/20241104000001_create_tables.sql`:

```sql
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
  metadata JSONB NULL,  -- Additional job metadata (e.g., checkout_session_id)
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
```

Click **"Run"** to execute the migration.

**Expected Result**: You should see a success message. Verify the tables were created:
- Navigate to **Table Editor** in the left sidebar
- You should see three new tables: `profiles`, `charts`, `jobs`

#### Migration 2: Enable RLS and Create Policies

Copy and paste the contents of `/supabase/migrations/20241104000002_enable_rls.sql`:

```sql
-- Migration: Enable Row Level Security (RLS)
-- Created: 2024-11-04
-- Description: Enables RLS and creates policies for profiles, charts, and jobs tables

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================

-- Allow users to view their own profiles
CREATE POLICY "Users can view their own profiles"
  ON profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- Allow authenticated users to insert their own profiles
CREATE POLICY "Users can insert their own profiles"
  ON profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow users to update their own profiles
CREATE POLICY "Users can update their own profiles"
  ON profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow users to delete their own profiles
CREATE POLICY "Users can delete their own profiles"
  ON profiles
  FOR DELETE
  USING (user_id = auth.uid());

-- MVP: Allow inserts without user_id (for anonymous profile creation via service role)
-- Note: This policy is intentionally loose for MVP. In production, remove this and require auth.
CREATE POLICY "Allow anonymous profile creation"
  ON profiles
  FOR INSERT
  WITH CHECK (user_id IS NULL);

-- ============================================
-- CHARTS TABLE POLICIES
-- ============================================

-- Allow users to view charts for their own profiles
CREATE POLICY "Users can view their own charts"
  ON charts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = charts.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Note: Chart inserts/updates are handled by service role on the server
-- No public INSERT/UPDATE/DELETE policies are created for charts table

-- ============================================
-- JOBS TABLE POLICIES
-- ============================================

-- Allow users to view their own jobs
CREATE POLICY "Users can view their own jobs"
  ON jobs
  FOR SELECT
  USING (user_id = auth.uid());

-- Note: Job inserts/updates are handled by service role on the server
-- No public INSERT/UPDATE/DELETE policies are created for jobs table

-- ============================================
-- SERVICE ROLE ACCESS
-- ============================================

-- Note: The service role key automatically bypasses RLS policies.
-- All server-side operations (in /pages/api/*) use the service role client
-- to perform inserts, updates, and deletes without restriction.
-- This is acceptable for MVP but should be refined for production.
```

Click **"Run"** to execute the migration.

**Expected Result**: You should see a success message. Verify RLS is enabled:
- Navigate to **Authentication** > **Policies** in the left sidebar
- You should see policies for `profiles`, `charts`, and `jobs` tables

#### Migration 3: Create Storage Bucket (Optional - Can also use Dashboard)

Copy and paste the contents of `/supabase/migrations/20241104000003_create_storage.sql`:

```sql
-- Migration: Create storage bucket and policies
-- Created: 2024-11-04
-- Description: Creates the 'reports' storage bucket for PDF reports with public read access

-- Note: Storage buckets are typically created via the Supabase dashboard or API.
-- This SQL provides the equivalent setup using Supabase's storage schema.

-- Insert storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES FOR 'reports' BUCKET
-- ============================================

-- Allow public read access to all files in the reports bucket
CREATE POLICY "Public read access for reports"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'reports');

-- Allow authenticated users to view their own reports
-- (This is redundant with public read, but demonstrates ownership pattern)
CREATE POLICY "Users can view their own reports"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'reports'
    AND auth.uid() IS NOT NULL
  );

-- Note: File uploads to the 'reports' bucket should only be done via service role
-- on the server-side (e.g., in the worker or API routes).
-- No public INSERT/UPDATE/DELETE policies are created for security.
```

Click **"Run"** to execute the migration.

**Expected Result**: You should see a success message. Verify the storage bucket:
- Navigate to **Storage** in the left sidebar
- You should see a bucket named `reports` (marked as public)

#### Migration 4: Add Metadata Column to Jobs

Copy and paste the contents of `/supabase/migrations/20241104000004_add_jobs_metadata.sql`:

```sql
-- Migration: Add metadata column to jobs table
-- Created: 2024-11-04
-- Description: Adds metadata JSONB column to store additional job information like checkout_session_id

ALTER TABLE jobs ADD COLUMN metadata JSONB NULL;

COMMENT ON COLUMN jobs.metadata IS 'Additional job metadata (e.g., checkout_session_id for payment tracking)';
```

Click **"Run"** to execute the migration.

**Expected Result**: You should see a success message. Verify the column was added:
- Navigate to **Table Editor** > **jobs** in the left sidebar
- You should see a new `metadata` column of type `jsonb`

---

## 2. Row Level Security (RLS)

### RLS Overview

Row Level Security (RLS) ensures that users can only access data they're authorized to see. In this MVP:

- **Service Role Key Bypasses RLS**: All API routes use `supabaseService` (service role client), which bypasses RLS policies
- **Policies are in place for future client-side queries**: When you add authentication, these policies will protect your data

### RLS Policies Summary

| Table | Policy | Description |
|-------|--------|-------------|
| **profiles** | Users can view/insert/update/delete their own profiles | Enforces ownership via `user_id = auth.uid()` |
| **profiles** | Allow anonymous profile creation | Permits `user_id IS NULL` for MVP (remove in production) |
| **charts** | Users can view their own charts | Checks ownership via `profiles.user_id = auth.uid()` |
| **jobs** | Users can view their own jobs | Enforces ownership via `user_id = auth.uid()` |
| **storage.objects** | Public read access for reports bucket | Allows anyone to download reports |

### Testing RLS in SQL Editor

Test that RLS is working correctly:

```sql
-- Test 1: Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'charts', 'jobs');
-- Expected: All tables should have rowsecurity = true

-- Test 2: View policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public';
-- Expected: You should see all the policies we created

-- Test 3: Insert a test profile (using service role - should succeed)
INSERT INTO profiles (name, birth_local, birth_timezone, gender)
VALUES ('Test User', '1990-01-01T10:00:00', 'America/New_York', 'male')
RETURNING *;
-- Expected: Should return the inserted row with a generated UUID

-- Test 4: Select all profiles (using service role - should succeed)
SELECT * FROM profiles;
-- Expected: Should return all profiles (service role bypasses RLS)
```

---

## 3. Storage Bucket Configuration

### Step 3.1: Create Storage Bucket (Dashboard Method)

If you prefer using the dashboard instead of SQL:

1. Navigate to **Storage** in the left sidebar
2. Click **"New bucket"**
3. Fill in:
   - **Name**: `reports`
   - **Public bucket**: Toggle **ON** (this allows public read access)
4. Click **"Create bucket"**

### Step 3.2: Configure Storage Policies

If you created the bucket via the dashboard, add the storage policies:

1. Navigate to **Storage** > **Policies**
2. Click **"New policy"** for the `reports` bucket
3. Select **"For full customization"**
4. Policy name: `Public read access for reports`
5. Allowed operation: **SELECT**
6. Policy definition:
   ```sql
   bucket_id = 'reports'
   ```
7. Click **"Review"** and then **"Save policy"**

### Step 3.3: Verify Storage Setup

Test the storage bucket:

1. Navigate to **Storage** > **reports** bucket
2. Try uploading a test file manually
3. Click on the file to get its public URL
4. Open the URL in a new tab — you should be able to view/download the file

---

## 4. Environment Variables

### Step 4.1: Gather Supabase Credentials

1. Navigate to **Settings** > **API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL**: Your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key**: Your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key**: Your `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

### Step 4.2: Set Environment Variables

Create a `.env.local` file in your project root (or configure in your hosting platform):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Google Gemini
GOOGLE_API_KEY=AIzaSy...
GEMINI_MODEL_SUMMARY=gemini-2.5-pro # optional, for AI summaries
GEMINI_MODEL_REPORT=gemini-2.5-pro # optional, for deep reports

# Stripe
STRIPE_SECRET_KEY=sk_test_... # or sk_live_... for production
STRIPE_WEBHOOK_SECRET=whsec_... # from Stripe CLI or webhook endpoint settings
STRIPE_API_VERSION=2024-06-20

# Site URL
NEXT_PUBLIC_SITE_URL=https://yourdomain.com # or http://localhost:3000 for local
```

**Security Notes**:
- ⚠️ **Never commit `.env.local` to Git** (it's in `.gitignore`)
- ⚠️ **SUPABASE_SERVICE_ROLE_KEY must NEVER be exposed to the client** — only use it in API routes (server-side)
- The service role key bypasses all RLS policies and has full database access

### Step 4.3: Environment Variable Descriptions

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) | `eyJhbGc...` |
| `GOOGLE_API_KEY` | Yes | Google AI API key for Gemini interpretations | `AIzaSy...` |
| `GEMINI_MODEL_SUMMARY` | No | Gemini model for AI summaries (defaults to gemini-2.5-pro) | `gemini-2.5-pro` |
| `GEMINI_MODEL_REPORT` | No | Gemini model for deep report generation (defaults to gemini-2.5-pro) | `gemini-2.5-pro` |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key for payments | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret for verifying webhook events | `whsec_...` |
| `STRIPE_API_VERSION` | No | Stripe API version (defaults to 2024-06-20) | `2024-06-20` |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your site URL for redirects | `https://yourdomain.com` |

---

## 5. Deploy Next.js Application to Vercel (Recommended)

### Prerequisites

Before deploying to Vercel, ensure you have:

- ✅ **GitHub Account**: Your code should be pushed to a GitHub repository
- ✅ **Vercel Account**: Sign up at [vercel.com](https://vercel.com) (free for personal projects)
- ✅ **Supabase Project**: Completed Steps 1-3 above (database, RLS, storage)
- ✅ **API Keys Ready**: 
  - Supabase credentials (URL, anon key, service role key)
  - Google API key from Google AI Studio
  - Stripe secret key and webhook secret

### Step 5.1: Push Code to GitHub

If you haven't already pushed your code to GitHub:

```bash
git init
git add .
git commit -m "Initial commit - Eastern Destiny MVP"
git branch -M main
git remote add origin https://github.com/yourusername/eastern-destiny.git
git push -u origin main
```

### Step 5.2: Import Project to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New..."** → **"Project"**
3. Find and import your `eastern-destiny` repository
   - If it's not visible, click **"Adjust GitHub App Permissions"** to grant access
4. Configure project settings:
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build` (default, can override if needed)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (default)

### Step 5.3: Configure Environment Variables

This is the most critical step. Add all environment variables before deploying.

1. In the Vercel import screen, scroll down to **"Environment Variables"**
2. Add each variable below:

#### Required Environment Variables

| Variable Name | Value | Environment | Description |
|---------------|-------|-------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production, Preview, Development | Your Supabase project URL (from Supabase Settings > API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | Production, Preview, Development | Supabase anonymous/public key (from Supabase Settings > API) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | Production, Preview, Development | Supabase service role key - **KEEP SECRET** (from Supabase Settings > API) |
| `GOOGLE_API_KEY` | `AIzaSy...` | Production, Preview, Development | Google AI API key for Gemini interpretations (from Google AI Studio) |
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` | Production, Preview, Development | Stripe secret key for payments (use `sk_test_` for testing) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Production, Preview, Development | Stripe webhook signing secret (see Step 5.6 below) |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | Production, Preview, Development | Your Vercel deployment URL (update after first deploy) |

#### Optional Environment Variables (with defaults)

| Variable Name | Default Value | Environment | Description |
|---------------|---------------|-------------|-------------|
| `GEMINI_MODEL_SUMMARY` | `gemini-2.5-pro` | Production, Preview, Development | Gemini model for AI interpretations (can also use gemini-2.5-flash for cost optimization) |
| `GEMINI_MODEL_REPORT` | `gemini-2.5-pro` | Production, Preview, Development | Gemini model for deep report generation (higher quality) |
| `STRIPE_API_VERSION` | `2024-06-20` | Production, Preview, Development | Stripe API version to use |

**Important Notes**:
- ⚠️ For each variable, select **Production**, **Preview**, and **Development** environments
- ⚠️ Leave `STRIPE_WEBHOOK_SECRET` blank initially - you'll add it after deployment (Step 5.6)
- ⚠️ Use `sk_test_` Stripe keys for Preview/Development, `sk_live_` for Production
- ⚠️ `NEXT_PUBLIC_SITE_URL` should be updated after first deployment with your actual Vercel URL

### Step 5.4: Deploy

1. Click **"Deploy"** at the bottom of the import screen
2. Vercel will:
   - Clone your repository
   - Install dependencies (`npm install`)
   - Run build command (`npm run build`)
   - Deploy your application
3. Wait for the build to complete (typically 2-3 minutes)
4. Once complete, you'll see: **"Congratulations! Your project has been deployed."**

### Step 5.5: Update NEXT_PUBLIC_SITE_URL

After your first deployment:

1. Copy your production URL (e.g., `https://eastern-destiny.vercel.app`)
2. Go to **Settings** > **Environment Variables**
3. Edit `NEXT_PUBLIC_SITE_URL`:
   - **Production**: `https://eastern-destiny.vercel.app`
   - **Preview**: `https://eastern-destiny-git-{branch}.vercel.app` (or use production URL)
   - **Development**: `http://localhost:3000`
4. Click **"Save"**
5. Trigger a redeploy:
   - Go to **Deployments**
   - Click **"..."** on latest deployment
   - Select **"Redeploy"**

### Step 5.6: Configure Stripe Webhook

The Stripe webhook is required for payment confirmation and report generation.

#### Step 5.6.1: Add Webhook Endpoint in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** > **Webhooks**
3. Click **"Add endpoint"**
4. Configure endpoint:
   - **Endpoint URL**: `https://eastern-destiny.vercel.app/api/stripe/webhook` (use your actual Vercel URL)
   - **Description**: `Eastern Destiny - Checkout completed`
   - **Events to listen to**: Click **"Select events"**
     - ✅ Check `checkout.session.completed`
   - **API version**: Match your `STRIPE_API_VERSION` (e.g., `2024-06-20`)
5. Click **"Add endpoint"**

#### Step 5.6.2: Get Webhook Signing Secret

1. After creating the endpoint, click on it to view details
2. Reveal and copy the **Signing secret** (starts with `whsec_`)
3. Go to your Vercel project: **Settings** > **Environment Variables**
4. Update `STRIPE_WEBHOOK_SECRET`:
   - Paste the signing secret as the value
   - Select **Production**, **Preview**, and **Development**
   - Click **"Save"**
5. Redeploy your application (see Step 5.5)

#### Step 5.6.3: Test Webhook (Optional)

1. In Stripe Dashboard, go to **Developers** > **Webhooks**
2. Click on your webhook endpoint
3. Click **"Send test webhook"**
4. Select `checkout.session.completed`
5. Click **"Send test webhook"**
6. Verify the webhook was received successfully (check response status)

### Step 5.7: Post-Deployment Verification

After deployment, verify everything is working:

#### Test 1: Homepage
- Visit your production URL (e.g., `https://eastern-destiny.vercel.app`)
- Verify the homepage loads without errors
- Check browser console for any JavaScript errors

#### Test 2: Profile Creation
1. Fill out the birth information form on the homepage
2. Submit the form
3. Verify you're redirected to `/compute` page
4. Check that profile data is saved in Supabase:
   - Go to Supabase dashboard
   - Navigate to **Table Editor** > **profiles**
   - Confirm new row exists

#### Test 3: BaZi Chart Computation
1. On the `/compute` page, click **"Compute Chart"** (or it should auto-compute)
2. Verify the Four Pillars (Year, Month, Day, Hour) are displayed
3. Check that chart data is saved in Supabase:
   - Navigate to **Table Editor** > **charts**
   - Confirm new row exists with `chart_json` and `wuxing_scores`

#### Test 4: AI Summary
1. On the chart page, click **"Get AI Interpretation"** (if available)
2. Wait for AI summary to generate (up to 30 seconds)
3. Verify AI summary is displayed
4. Check that `ai_summary` column is populated in `charts` table

#### Test 5: Pricing Page
- Visit `/pricing` page
- Verify pricing information displays correctly
- Check Stripe integration (if clicking generate report button)

#### Test 6: API Health Check
Test critical API routes:

```bash
# Test profile creation (replace with your Vercel URL)
curl -X POST https://your-app.vercel.app/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","birth_local":"1990-01-01T12:00:00","birth_timezone":"UTC","gender":"male"}'

# Should return: {"id": "...", "name": "Test", ...}
```

### Step 5.8: Monitor Logs

Vercel provides real-time logging for debugging:

1. Go to your Vercel project dashboard
2. Click on **Deployments**
3. Click on the latest deployment
4. View tabs:
   - **Building**: Build logs (useful for build errors)
   - **Runtime Logs**: Function execution logs (useful for API debugging)
   - **Function Logs**: Per-function logs

**Tip**: Filter logs by function (e.g., `/api/profiles`) for easier debugging

### Step 5.9: Custom Domain (Optional)

To use a custom domain instead of `.vercel.app`:

1. Go to **Settings** > **Domains**
2. Click **"Add"**
3. Enter your domain (e.g., `easterndestiny.com`)
4. Follow Vercel's instructions to:
   - Add DNS records (A, CNAME)
   - Verify domain ownership
5. Update `NEXT_PUBLIC_SITE_URL` environment variable
6. Update Stripe webhook URL in Stripe Dashboard

### Troubleshooting Vercel Deployment

#### Build Fails: "Module not found"

**Cause**: Missing dependency in `package.json`

**Solution**:
```bash
npm install <missing-package>
git add package.json package-lock.json
git commit -m "Add missing dependency"
git push
```

#### Build Fails: "Type error"

**Cause**: TypeScript compilation errors

**Solution**:
1. Run locally: `npm run build`
2. Fix TypeScript errors
3. Commit and push

#### Runtime Error: "SUPABASE_SERVICE_ROLE_KEY is not defined"

**Cause**: Environment variable not set

**Solution**:
1. Go to **Settings** > **Environment Variables**
2. Verify all required variables are set
3. Redeploy

#### API Timeout: "Function execution timeout"

**Cause**: API route exceeds Vercel's timeout (10s on Hobby, 60s on Pro)

**Solution**:
- OpenAI calls can take 20-30 seconds
- Upgrade to Vercel Pro for 60s timeout
- Or implement client-side polling for long operations

#### Stripe Webhook: "No signatures found"

**Cause**: `STRIPE_WEBHOOK_SECRET` is incorrect or missing

**Solution**:
1. Re-check signing secret in Stripe Dashboard
2. Update environment variable in Vercel
3. Ensure no extra spaces or line breaks in secret
4. Redeploy

### Alternative Deployment Options

While Vercel is recommended, you can also deploy to:

- **Netlify**: Similar to Vercel, supports Next.js (use Netlify adapter)
- **Railway**: Supports Next.js and can host the worker in the same project
- **Render**: Good for full-stack apps with background workers
- **fly.io**: Docker-based deployments with global edge network

Refer to each platform's documentation for Next.js deployment instructions.

---

## 6. Deploy Background Worker

The background worker (`worker/worker.ts`) processes async jobs like report generation. Since Vercel is a serverless platform, it cannot run long-running background processes. You have several options:

### Option A: Vercel Cron Jobs (Recommended for Vercel deployments)

Vercel Cron Jobs allow you to run scheduled tasks. This requires a Vercel Pro plan.

#### Step 6.1: Create Worker API Route

Create a new file `/pages/api/cron/process-jobs.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseService } from '@/lib/supabase';
// Import worker logic here or create a shared function

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret to prevent unauthorized access
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Process pending jobs (copy logic from worker/worker.ts)
    const { data: jobs, error } = await supabaseService
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .eq('job_type', 'deep_report')
      .limit(10);

    if (error) throw error;

    // Process each job...
    // (Implement worker logic here)

    res.status(200).json({ processed: jobs?.length || 0 });
  } catch (error) {
    console.error('[Cron Worker]', error);
    res.status(500).json({ error: 'Worker failed' });
  }
}
```

#### Step 6.2: Configure Cron Schedule

Update `vercel.json` to add cron configuration:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-jobs",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This runs the worker every 5 minutes.

#### Step 6.3: Add CRON_SECRET Environment Variable

1. Go to Vercel project **Settings** > **Environment Variables**
2. Add `CRON_SECRET` with a random secret value (e.g., generate with `openssl rand -hex 32`)
3. Set for **Production**, **Preview**, and **Development**
4. Deploy

**Note**: Vercel Cron Jobs are only available on Pro plans ($20/month). For Hobby plans, use Option B or C.

### Option B: External Cron Service (Free alternative)

Use a free external cron service to trigger your worker API endpoint:

#### Step 6.1: Create Worker API Route

Same as Option A - create `/pages/api/cron/process-jobs.ts`

#### Step 6.2: Choose a Cron Service

Popular free options:
- **cron-job.org**: Free, up to 50 jobs, 1-minute intervals
- **EasyCron**: Free tier available
- **UptimeRobot**: Free tier with 5-minute intervals

#### Step 6.3: Configure Cron Job

1. Sign up for a cron service (e.g., cron-job.org)
2. Create a new cron job:
   - **URL**: `https://your-app.vercel.app/api/cron/process-jobs`
   - **Interval**: Every 5 minutes
   - **HTTP Method**: GET or POST
   - **Headers**: `Authorization: Bearer YOUR_CRON_SECRET`
3. Save and enable the cron job

### Option C: Deploy Worker to Railway (Separate service)

If you need a continuously running worker:

1. Go to [railway.app](https://railway.app) and sign in
2. Create a new project from your GitHub repository
3. Add a new service:
   - **Service name**: `eastern-destiny-worker`
   - **Build command**: `npm install`
   - **Start command**: `npm run worker`
4. Add environment variables (same as your Vercel deployment):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `OPENAI_REPORT_MODEL` (optional)
   - `STRIPE_SECRET_KEY`
5. Deploy

**Cost**: Railway has a free tier with 500 hours/month, then $5/month after.

### Option D: Run Worker Locally (MVP Testing)

For MVP testing, you can run the worker locally:

```bash
# Terminal 1: Run Next.js app (deployed on Vercel)
# (No need to run locally if using Vercel deployment)

# Terminal 2: Run worker locally, connected to production Supabase
npm run worker
```

Create a `.env.local` file with production credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
OPENAI_API_KEY=sk-proj-...
OPENAI_REPORT_MODEL=gpt-4o
```

**Security Note**: Only run the worker locally during MVP testing. In production, use Options A, B, or C.

### Recommendation

- **For Vercel Pro users**: Use Option A (Vercel Cron)
- **For Vercel Hobby users**: Use Option B (External Cron) or Option C (Railway)
- **For MVP testing**: Use Option D (Local worker)

---

## 7. Stripe Configuration

### Step 7.1: Get Stripe API Keys

1. Go to [stripe.com](https://stripe.com) and sign in
2. Navigate to **Developers** > **API keys**
3. Copy your **Secret key** (starts with `sk_test_` or `sk_live_`)
4. Add it to your environment variables as `STRIPE_SECRET_KEY`

### Step 7.2: Configure Stripe Products (Optional)

For the report generation feature to work with real payments:

1. Navigate to **Products** in Stripe dashboard
2. Create a new product:
   - **Name**: "BaZi Fortune Report"
   - **Price**: Set your desired price (e.g., $9.99 USD)
3. Copy the **Price ID** (starts with `price_`)
4. Update your code in `/pages/api/reports/generate.ts` to use this price ID

### Step 7.3: Stripe Webhooks

The application uses Stripe webhooks to finalize the report purchase flow after successful payment.

#### Development Testing with Stripe CLI

For local development, use the Stripe CLI to forward webhook events:

1. **Install Stripe CLI**: Follow instructions at [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)

2. **Login to Stripe CLI**:
   ```bash
   stripe login
   ```

3. **Forward webhook events to your local server**:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. **Copy the webhook signing secret**: The CLI will display a webhook signing secret (starts with `whsec_`). Add it to your `.env.local`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

5. **Test with a real checkout**: 
   - Start your Next.js app: `pnpm dev`
   - Create a chart and initiate report generation
   - Complete the Stripe checkout (use test card `4242 4242 4242 4242`)
   - Watch the Stripe CLI forward the `checkout.session.completed` event
   - Verify a job is created/updated in the `jobs` table with `status='pending'`

6. **Test with Stripe CLI trigger** (optional):
   ```bash
   stripe trigger checkout.session.completed
   ```

#### Production Setup

For production deployment:

1. Navigate to **Developers** > **Webhooks** in Stripe Dashboard
2. Click **"Add endpoint"**
3. Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
5. Copy the **Signing secret** and add to your environment variables as `STRIPE_WEBHOOK_SECRET`
6. Deploy your application with the new environment variable

#### How the Webhook Works

1. User completes Stripe checkout
2. Stripe sends `checkout.session.completed` event to your webhook endpoint
3. Webhook validates the signature using `STRIPE_WEBHOOK_SECRET`
4. Webhook extracts `chart_id` from session metadata
5. Webhook finds the job by `checkout_session_id` in metadata
6. If job exists, updates it to `status='pending'` and adds `payment_confirmed: true`
7. If job doesn't exist (edge case), creates a new job
8. Webhook implements idempotency by storing `last_webhook_event_id` to prevent duplicate processing
9. Background worker picks up pending jobs and generates reports

#### Event Mapping

| Stripe Event | Action | Database Update |
|--------------|--------|-----------------|
| `checkout.session.completed` | Payment successful | Update job to `status='pending'`, add `payment_confirmed: true` in metadata |

#### Security Features

- **Signature Verification**: All webhook events are verified using Stripe's signature
- **Idempotency**: Duplicate events are detected and ignored using `last_webhook_event_id`
- **Quick Response**: Webhook returns 200 status quickly to avoid timeouts
- **Error Logging**: All errors are logged with `[Webhook]` prefix for debugging

---

## 8. Testing Your Deployment

### Step 8.1: Test Database Connection

Run a quick test in Supabase SQL Editor:

```sql
-- Insert a test profile
INSERT INTO profiles (name, birth_local, birth_timezone, gender)
VALUES ('Test Deploy', '1990-01-01T12:00:00', 'UTC', 'male')
RETURNING *;

-- Verify the insert
SELECT * FROM profiles WHERE name = 'Test Deploy';

-- Clean up
DELETE FROM profiles WHERE name = 'Test Deploy';
```

### Step 8.2: Test Application Flow

1. Visit your deployed site (e.g., `https://your-app.vercel.app`)
2. Fill out the profile creation form on the homepage
3. Submit and verify you're redirected to `/compute`
4. Check that the BaZi chart is displayed
5. Test the "Generate Report" button (Stripe checkout)

### Step 8.3: Verify Data in Supabase

1. Navigate to **Table Editor** > **profiles**
2. You should see the profile you just created
3. Check **charts** table for the computed chart
4. Check **jobs** table if you tested report generation

### Step 8.4: Monitor Logs

- **Vercel**: Go to your project > **Deployments** > Click on latest deployment > View **Function Logs**
- **Supabase**: Navigate to **Logs** to see database queries
- **Stripe**: Check **Developers** > **Events** for payment events

---

## 9. Production Checklist

Before going live, ensure you've completed:

### Security
- [ ] All environment variables are set correctly in production
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is never exposed to client-side code
- [ ] Stripe is using live keys (`sk_live_...`) not test keys
- [ ] HTTPS/SSL is enabled on your domain

### Database
- [ ] All migrations have been run successfully
- [ ] RLS is enabled on all tables
- [ ] Storage bucket `reports` is created and configured
- [ ] Indexes are in place for optimal query performance

### Application
- [ ] Next.js app is deployed and accessible
- [ ] All pages load without errors
- [ ] API routes are functioning correctly
- [ ] Background worker is running (if applicable)

### Third-Party Services
- [ ] OpenAI API key is valid and has credits
- [ ] Stripe integration is tested (use test mode first)
- [ ] Stripe webhook endpoint is configured in Stripe Dashboard
- [ ] STRIPE_WEBHOOK_SECRET is set correctly in production environment

### Testing
- [ ] End-to-end user flow tested (profile → chart → report)
- [ ] Error handling tested (invalid inputs, API failures)
- [ ] Mobile responsiveness tested

### Monitoring
- [ ] Error logging is set up (e.g., Sentry, LogRocket)
- [ ] Performance monitoring is enabled
- [ ] Database query performance is monitored

---

## 10. Troubleshooting

### Common Issues

#### Issue: "relation 'profiles' does not exist"

**Solution**: Run the database migrations in Supabase SQL Editor (see Step 1.2)

#### Issue: "JWT expired" or "Invalid API key"

**Solution**: 
1. Verify your Supabase keys in **Settings** > **API**
2. Regenerate keys if they've been rotated
3. Update environment variables in your hosting platform

#### Issue: "Row Level Security policy violation"

**Solution**: 
1. Ensure you're using `supabaseService` (service role) in API routes, not the regular `supabase` client
2. Verify RLS policies are created correctly (see Step 2)
3. Test policies in SQL Editor with sample data

#### Issue: Storage bucket "reports" not found

**Solution**: 
1. Verify the bucket exists in **Storage** dashboard
2. Check that it's named exactly `reports` (case-sensitive)
3. Run the storage migration (Step 1.2, Migration 3)

#### Issue: Stripe checkout not working

**Solution**:
1. Verify `STRIPE_SECRET_KEY` is set correctly
2. Check Stripe dashboard for errors in **Developers** > **Logs**
3. Ensure `NEXT_PUBLIC_SITE_URL` is set correctly for redirects

#### Issue: Worker not processing jobs

**Solution**:
1. Verify the worker is running (check logs)
2. Check that jobs exist in the `jobs` table with `status = 'pending'`
3. Verify worker has access to all environment variables
4. Check worker logs for errors

### Getting Help

- **Supabase**: [docs.supabase.com](https://docs.supabase.com)
- **Next.js**: [nextjs.org/docs](https://nextjs.org/docs)
- **Stripe**: [stripe.com/docs](https://stripe.com/docs)
- **Vercel**: [vercel.com/docs](https://vercel.com/docs)

---

## Summary

You've successfully deployed Eastern Destiny MVP! 🎉

Your application now has:
- ✅ Database tables with proper relationships
- ✅ Row Level Security enabled with policies
- ✅ Storage bucket for PDF reports
- ✅ Next.js application deployed
- ✅ Background worker for async jobs
- ✅ Stripe payment integration

For production improvements, consider:
- Implementing proper authentication (Supabase Auth)
- Adding Stripe webhook handlers
- Replacing placeholder BaZi logic with accurate calculations
- Adding comprehensive error handling and logging
- Setting up monitoring and analytics

---

**Last Updated**: 2024-11-04
