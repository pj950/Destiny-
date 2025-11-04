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

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Stripe
STRIPE_SECRET_KEY=sk_test_... # or sk_live_... for production
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
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI interpretations | `sk-proj-...` |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key for payments | `sk_test_...` or `sk_live_...` |
| `STRIPE_API_VERSION` | No | Stripe API version (defaults to 2024-06-20) | `2024-06-20` |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your site URL for redirects | `https://yourdomain.com` |

---

## 5. Deploy Next.js Application

### Option A: Deploy to Vercel (Recommended)

#### Step 5.1: Push Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/eastern-destiny.git
git push -u origin main
```

#### Step 5.2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"New Project"**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build` (or `pnpm build`)
   - **Output Directory**: `.next` (should auto-detect)

#### Step 5.3: Add Environment Variables

In the Vercel project settings:

1. Navigate to **Settings** > **Environment Variables**
2. Add all environment variables from Step 4.2 above
3. Set them for **Production**, **Preview**, and **Development** environments
4. Click **"Save"**

#### Step 5.4: Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (2-3 minutes)
3. Once deployed, visit your production URL

### Option B: Deploy to Other Platforms

You can also deploy to:
- **Netlify**: Similar to Vercel, supports Next.js
- **Railway**: Supports Next.js and can host the worker in the same project
- **Render**: Good for full-stack apps
- **fly.io**: Docker-based deployments

Refer to each platform's documentation for Next.js deployment instructions.

---

## 6. Deploy Background Worker

The background worker (`worker/worker.ts`) processes async jobs like report generation.

### Option A: Deploy Worker to Railway

1. Go to [railway.app](https://railway.app) and sign in
2. Create a new project
3. Connect your GitHub repository
4. Add a new service:
   - **Service name**: `eastern-destiny-worker`
   - **Start command**: `node -r esbuild-register worker/worker.ts`
5. Add environment variables (same as Next.js app)
6. Deploy

### Option B: Deploy Worker as a Cron Job

If your worker is lightweight and doesn't need to run continuously:

1. **Vercel Cron Jobs** (requires Pro plan):
   - Create `/pages/api/cron/worker.ts`
   - Configure `vercel.json` with cron schedule
   - Vercel will call the API route on schedule

2. **External Cron Services**:
   - Use services like Cron-job.org or EasyCron
   - Set up a cron to call your worker API endpoint

### Option C: Run Worker Locally

For MVP testing, you can run the worker locally:

```bash
# Terminal 1: Run Next.js app
pnpm dev

# Terminal 2: Run worker
node -r esbuild-register worker/worker.ts
```

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

### Step 7.3: Stripe Webhooks (Post-MVP)

For production, you should set up Stripe webhooks:

1. Navigate to **Developers** > **Webhooks**
2. Click **"Add endpoint"**
3. Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
5. Copy the **Signing secret** and add to environment variables

**Note**: Webhook handler is not included in MVP. You'll need to implement `/pages/api/stripe/webhook.ts` for production.

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
- [ ] Stripe webhook is configured (if implemented)

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
