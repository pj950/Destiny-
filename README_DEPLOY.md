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
7. [Razorpay Configuration](#7-razorpay-configuration)
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

# Razorpay
RAZORPAY_KEY_ID=rzp_test_... # or rzp_live_... for production
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

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
| `RAZORPAY_KEY_ID` | Yes | Razorpay key ID for payments (use test keys in development) | `rzp_test_...` or `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay key secret for API authentication | `your_key_secret` |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Razorpay webhook signing secret for verifying webhook events | `your_webhook_secret` |
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
| `RAZORPAY_KEY_ID` | `rzp_test_...` or `rzp_live_...` | Production, Preview, Development | Razorpay key ID for payments (use `rzp_test_` for testing) |
| `RAZORPAY_KEY_SECRET` | `your_key_secret` | Production, Preview, Development | Razorpay key secret for API authentication |
| `RAZORPAY_WEBHOOK_SECRET` | `your_webhook_secret` | Production, Preview, Development | Razorpay webhook signing secret (see Section 7 below) |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | Production, Preview, Development | Your Vercel deployment URL (update after first deploy) |

#### Optional Environment Variables (with defaults)

| Variable Name | Default Value | Environment | Description |
|---------------|---------------|-------------|-------------|
| `GEMINI_MODEL_SUMMARY` | `gemini-2.5-pro` | Production, Preview, Development | Gemini model for AI interpretations (can also use gemini-2.5-flash for cost optimization) |
| `GEMINI_MODEL_REPORT` | `gemini-2.5-pro` | Production, Preview, Development | Gemini model for deep report generation (higher quality) |

**Important Notes**:
- ⚠️ For each variable, select **Production**, **Preview**, and **Development** environments
- ⚠️ `RAZORPAY_WEBHOOK_SECRET` can be configured after deployment (see Section 7)
- ⚠️ Use `rzp_test_` Razorpay keys for Preview/Development, `rzp_live_` for Production
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

### Step 5.6: Configure Razorpay Webhook

The Razorpay webhook is required for payment confirmation and updating lamp/job status.

#### Step 5.6.1: Add Webhook Endpoint in Razorpay

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Navigate to **Settings** > **Webhooks**
3. Click **"Create New Webhook"** or **"+ Add New"**
4. Configure endpoint:
   - **Webhook URL**: `https://eastern-destiny.vercel.app/api/razorpay/webhook` (use your actual Vercel URL)
   - **Secret**: Generate a secure secret (or use a password generator)
     - Example: `my_secure_webhook_secret_2024`
     - **Important**: Save this secret immediately - you'll need it for environment variables
   - **Alert Email**: (Optional) Your email for webhook failures
   - **Active Events**: Select the following:
     - ✅ Check `payment_link.paid`
5. Click **"Create Webhook"** or **"Save"**

#### Step 5.6.2: Update Webhook Secret in Vercel

1. Copy the webhook secret you just created
2. Go to your Vercel project: **Settings** > **Environment Variables**
3. Update `RAZORPAY_WEBHOOK_SECRET`:
   - Paste the webhook secret as the value
   - Select **Production**, **Preview**, and **Development**
   - Click **"Save"**
4. Redeploy your application (see Step 5.5)

#### Step 5.6.3: Test Webhook (Optional)

To test the webhook integration:

1. Make a test lamp purchase:
   - Visit `/lamps` on your deployed site
   - Click "点亮" on any lamp
   - Complete payment using Razorpay test card: `4111 1111 1111 1111`
2. In Razorpay Dashboard, go to **Settings** > **Webhooks**
3. Click on your webhook endpoint
4. View **Webhook Logs** to see delivery attempts
5. Verify the webhook was delivered successfully (status code 200)
6. Check your Supabase database to confirm lamp status changed to 'lit'

**Troubleshooting**: If webhook delivery fails, check:
- Webhook URL is correct and publicly accessible
- `RAZORPAY_WEBHOOK_SECRET` matches the secret in Razorpay Dashboard
- No firewall blocking Razorpay IPs
- Check Vercel function logs for errors

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

#### Test 5: Prayer Lamps Page
- Visit `/lamps` page
- Verify all 4 lamps display correctly
- Check Razorpay integration by clicking "点亮" on a lamp (should redirect to Razorpay payment page)

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
6. Update Razorpay webhook URL in Razorpay Dashboard

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

The background worker (`worker/worker.ts`) processes async jobs like report generation. The worker has been refactored to support multiple job types:

- **`deep_report`**: Legacy deep report generation with Supabase Storage
- **`yearly_flow_report`**: New structured yearly flow reports with embeddings and chunking

Since Vercel is a serverless platform, it cannot run long-running background processes. You have several options:

### Option A: Vercel Cron Jobs (Recommended for Vercel deployments)

Vercel Cron Jobs allow you to run scheduled tasks. This requires a Vercel Pro plan.

#### Step 6.1: Create Worker API Route

Create a new file `/pages/api/cron/process-jobs.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseService } from '@/lib/supabase';
import { getGeminiClient } from '@/lib/gemini/client';
import { buildYearlyFlowPrompt } from '@/lib/gemini/prompts';
import { parseGeminiJsonResponse } from '@/lib/gemini/parser';
import { YearlyFlowPayloadSchema } from '@/lib/gemini/schemas';
import { analyzeBaziInsights } from '@/lib/bazi-insights';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret to prevent unauthorized access
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Import and run worker logic
    const { processJobs } = await import('../../../worker/worker');
    const processedCount = await processJobs();

    res.status(200).json({ 
      processed: processedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Cron Worker]', error);
    res.status(500).json({ 
      error: 'Worker failed',
      timestamp: new Date().toISOString()
    });
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
   - **Interval**: Every 5 minutes (recommended for job processing)
   - **HTTP Method**: GET or POST
   - **Headers**: `Authorization: Bearer YOUR_CRON_SECRET`
3. Save and enable the cron job

**Note**: The worker supports multiple job types and will process all pending jobs regardless of type.

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
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_API_KEY` (required for Gemini)
   - `GEMINI_MODEL_REPORT` (optional, defaults to 'gemini-2.5-pro')
   - `GEMINI_MODEL_EMBEDDING` (optional, defaults to 'text-embedding-004')
   - `GEMINI_CLIENT_MAX_RETRIES` (optional, defaults to 3)
   - `GEMINI_CLIENT_RETRY_DELAY_MS` (optional, defaults to 800)
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
GOOGLE_API_KEY=your_gemini_api_key
GEMINI_MODEL_REPORT=gemini-2.5-pro
GEMINI_MODEL_EMBEDDING=text-embedding-004
```

**Security Note**: Only run the worker locally during MVP testing. In production, use Options A, B, or C.

### Worker Testing Guide

#### Testing Job Types

The refactored worker supports two job types:

1. **`deep_report`** (Legacy):
   - Generates plain text reports
   - Stores in Supabase Storage
   - Returns public URL

2. **`yearly_flow_report`** (New):
   - Generates structured JSON reports
   - Stores in `bazi_reports` table
   - Creates embeddings and chunks in `bazi_report_chunks`
   - Returns frontend URL (`/reports/{id}`)

#### Manual Testing

To test the worker manually:

1. **Insert a test job**:
```sql
-- Test yearly_flow_report
INSERT INTO jobs (chart_id, job_type, status, metadata)
VALUES (
  'your-chart-id',
  'yearly_flow_report',
  'pending',
  '{"target_year": 2024, "subscription_tier": "premium"}'::jsonb
);

-- Test deep_report (legacy)
INSERT INTO jobs (chart_id, job_type, status)
VALUES (
  'your-chart-id',
  'deep_report',
  'pending'
);
```

2. **Run the worker**:
```bash
npm run worker
```

3. **Check results**:
```sql
-- Check job status
SELECT * FROM jobs WHERE status IN ('done', 'failed');

-- Check yearly flow reports
SELECT * FROM bazi_reports WHERE report_type = 'yearly_flow';

-- Check chunks and embeddings
SELECT * FROM bazi_report_chunks WHERE report_id = 'your-report-id';
```

#### Monitoring Worker Logs

The worker provides detailed logging:
- `[Worker]` prefix for all messages
- Processing time for each job
- Error details with stack traces
- Chunking and embedding progress

### Recommendation

- **For Vercel Pro users**: Use Option A (Vercel Cron)
- **For Vercel Hobby users**: Use Option B (External Cron) or Option C (Railway)
- **For MVP testing**: Use Option D (Local worker)

---

## 7. Razorpay Configuration

### Step 7.1: Get Razorpay API Keys

1. Go to [razorpay.com](https://razorpay.com) and sign in (or sign up for a new account)
2. Navigate to **Settings** > **API Keys**
3. Generate API keys if you haven't already:
   - Click **"Generate Test Key"** for development
   - Click **"Generate Live Key"** for production (requires KYC verification)
4. Copy your keys:
   - **Key ID**: Starts with `rzp_test_` (test) or `rzp_live_` (production)
   - **Key Secret**: Click "show" to reveal the secret
5. Add them to your environment variables:
   - `RAZORPAY_KEY_ID=rzp_test_xxxxx`
   - `RAZORPAY_KEY_SECRET=your_secret_here`

**Important Security Note**: Never commit these keys to your repository or expose them client-side. Only use them in server-side API routes.

### Step 7.2: Configure Payment Settings

The application uses Razorpay Payment Links for:
- **Prayer Lamps**: $19.90 per lamp
- **Deep Reports**: $19.99 per report

Payment link settings are configured in code:
- **Currency**: USD
- **Expiry**: 30 minutes (lamps), 60 minutes (reports)
- **Callback URL**: Returns to `/lamps` or `/dashboard` after payment

No additional product configuration is needed in Razorpay Dashboard.

### Step 7.3: Razorpay Webhooks

The application uses Razorpay webhooks to confirm payments and update resource status (lamps and jobs).

#### Development Testing with ngrok

For local development, use ngrok to expose your local server:

1. **Install ngrok**: Download from [ngrok.com](https://ngrok.com)

2. **Start your Next.js app**:
   ```bash
   npm run dev
   # App runs on http://localhost:3000
   ```

3. **Start ngrok tunnel**:
   ```bash
   ngrok http 3000
   ```
   
4. **Copy the HTTPS URL** from ngrok (e.g., `https://abc123.ngrok.io`)

5. **Configure webhook in Razorpay**:
   - Go to **Settings** > **Webhooks** in Razorpay Dashboard
   - Click **"Create New Webhook"**
   - **Webhook URL**: `https://abc123.ngrok.io/api/razorpay/webhook`
   - **Secret**: Generate a secure secret (e.g., `my_dev_webhook_secret_2024`)
   - **Active Events**: Select `payment_link.paid`
   - Click **"Create"**

6. **Add webhook secret to `.env.local`**:
   ```env
   RAZORPAY_WEBHOOK_SECRET=my_dev_webhook_secret_2024
   ```

7. **Test with a lamp purchase**:
   - Visit `http://localhost:3000/lamps`
   - Click "点亮" on any lamp
   - Complete payment with test card: `4111 1111 1111 1111`
   - Razorpay will send webhook to ngrok URL → your local server
   - Check ngrok web interface (`http://127.0.0.1:4040`) to see webhook requests
   - Verify lamp status changes to 'lit' in Supabase

8. **Monitor webhook logs**:
   - Check your Next.js server logs for `[Razorpay Webhook]` messages
   - Check Razorpay Dashboard > Webhooks > your webhook > Logs for delivery status

#### Production Setup

For production deployment (Vercel, etc.):

1. Navigate to **Settings** > **Webhooks** in Razorpay Dashboard
2. Click **"Create New Webhook"** or edit existing webhook
3. Configure endpoint:
   - **Webhook URL**: `https://your-production-domain.com/api/razorpay/webhook`
   - **Secret**: Generate a secure webhook secret (different from development)
   - **Active Events**: Select `payment_link.paid`
4. Copy the **Secret** and add to your production environment variables as `RAZORPAY_WEBHOOK_SECRET`
5. Deploy your application with the new environment variable

#### How the Webhook Works

**For Lamp Purchases:**
1. User completes Razorpay payment for a lamp
2. Razorpay sends `payment_link.paid` event to webhook endpoint
3. Webhook validates signature using `RAZORPAY_WEBHOOK_SECRET`
4. Webhook extracts `lamp_key` from payment link notes
5. Webhook updates lamp status to 'lit' and stores payment ID
6. Webhook stores event ID for idempotency (prevents duplicate processing)

**For Report Purchases:**
1. User completes Razorpay payment for a report
2. Razorpay sends `payment_link.paid` event to webhook endpoint
3. Webhook validates signature using `RAZORPAY_WEBHOOK_SECRET`
4. Webhook extracts `chart_id` from payment link reference_id or notes
5. Webhook updates job status to 'pending' and marks payment confirmed
6. Background worker picks up pending jobs and generates reports

#### Event Mapping

| Razorpay Event | Resource | Action | Database Update |
|----------------|----------|--------|-----------------|
| `payment_link.paid` | Lamp | Payment successful | Update lamp to `status='lit'`, store `razorpay_payment_id` |
| `payment_link.paid` | Report | Payment successful | Update job to `status='pending'`, add `payment_confirmed: true` in metadata |

#### Security Features

- **Signature Verification**: All webhook events are verified using Razorpay's HMAC-SHA256 signature
- **Idempotency**: Duplicate events are detected and ignored using `last_webhook_event_id`
- **Quick Response**: Webhook returns 200 status quickly to avoid timeouts
- **Error Logging**: All errors are logged with `[Razorpay Webhook]` prefix for debugging
- **Metadata Validation**: Webhook validates presence of required metadata (lamp_key, chart_id)

#### Testing Guide

For comprehensive testing instructions, see [docs/RAZORPAY_TESTING_CHECKLIST.md](../docs/RAZORPAY_TESTING_CHECKLIST.md)

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
5. Test the "Generate Report" button (Razorpay payment link)

### Step 8.3: Verify Data in Supabase

1. Navigate to **Table Editor** > **profiles**
2. You should see the profile you just created
3. Check **charts** table for the computed chart
4. Check **jobs** table if you tested report generation

### Step 8.4: Monitor Logs

- **Vercel**: Go to your project > **Deployments** > Click on latest deployment > View **Function Logs**
- **Supabase**: Navigate to **Logs** to see database queries
- **Razorpay**: Check **Settings** > **Webhooks** > **Logs** for webhook delivery status

---

## 9. Production Checklist

Before going live, ensure you've completed:

### Security
- [ ] All environment variables are set correctly in production
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is never exposed to client-side code
- [ ] Razorpay is using live keys (`rzp_live_...`) not test keys
- [ ] HTTPS/SSL is enabled on your domain
- [ ] `RAZORPAY_WEBHOOK_SECRET` is properly configured and matches Razorpay Dashboard

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
- [ ] Google AI API key is valid (GOOGLE_API_KEY)
- [ ] Razorpay integration is tested (use test mode first)
- [ ] Razorpay webhook endpoint is configured in Razorpay Dashboard
- [ ] RAZORPAY_WEBHOOK_SECRET is set correctly in production environment
- [ ] Razorpay payment links are working for both lamps and reports

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

#### Issue: Razorpay payment not working

**Solution**:
1. Verify `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set correctly
2. Check Razorpay dashboard for errors in **Settings** > **Webhooks** > **Logs**
3. Ensure `NEXT_PUBLIC_SITE_URL` is set correctly for redirects
4. Verify webhook secret matches between Razorpay Dashboard and environment variables
5. Test with Razorpay test card: `4111 1111 1111 1111`

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
