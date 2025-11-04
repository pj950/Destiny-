# Eastern Destiny — V1 TypeScript MVP

Eastern Destiny is a lightweight MVP project that provides Chinese BaZi (八字) fortune-telling calculations with AI-powered interpretations. This project demonstrates integration of modern web technologies with traditional Chinese astrology.

## Overview

This application allows users to:
- Input birth information (date, time, timezone) to generate BaZi charts
- Receive AI-powered interpretations of their charts
- Purchase detailed fortune reports via Stripe
- View and manage their generated charts

## Tech Stack

- **Framework**: Next.js 13 (Pages Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o-mini / GPT-4o
- **Payments**: Stripe
- **Package Manager**: pnpm (recommended) or npm

## Prerequisites

Before you begin, ensure you have the following:

- **Node.js** 18+ and **pnpm** (or npm)
- **Supabase** account and project
- **OpenAI** API key
- **Stripe** account (for payment processing)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
# or
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | `eyJhbGc...` |
| `OPENAI_API_KEY` | OpenAI API key for AI interpretations | `sk-proj-...` |
| `OPENAI_MODEL_SUMMARY` | OpenAI model for chart summaries (optional, defaults to gpt-4o-mini) | `gpt-4o-mini` or `gpt-4o` |
| `OPENAI_REPORT_MODEL` | OpenAI model for detailed reports (optional, defaults to gpt-4o) | `gpt-4o` or `gpt-4o-mini` |
| `STRIPE_SECRET_KEY` | Stripe secret key for payments (use test keys in development) | `sk_test_...` |
| `STRIPE_API_VERSION` | Stripe API version (optional, defaults to 2024-06-20) | `2024-06-20` |
| `NEXT_PUBLIC_SITE_URL` | Your site URL for redirects | `http://localhost:3000` |

**Security Note**: The `SUPABASE_SERVICE_ROLE_KEY` is used only in API routes (server-side) and never exposed to the client. All server-side database writes use the service role client (`supabaseService`) to bypass RLS policies in this MVP.

### 3. Set Up Supabase

Create the following tables in your Supabase project:

```sql
-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  birth_local TIMESTAMPTZ NOT NULL,
  birth_timezone TEXT NOT NULL,
  gender TEXT,
  lat NUMERIC,
  lon NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Charts table
CREATE TABLE charts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  chart_json JSONB NOT NULL,
  wuxing_scores JSONB,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table (for async report generation)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  chart_id UUID REFERENCES charts(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_charts_profile_id ON charts(profile_id);
CREATE INDEX idx_jobs_status ON jobs(status);
```

**Storage Setup**: Create a storage bucket named `reports` in Supabase and set it to public access (or configure appropriate policies).

**RLS Policies**: For this MVP, RLS policies are minimal since we use the service role key for all writes. In production, implement proper row-level security.

### 4. Run Development Server

```bash
pnpm dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You should see the homepage with Tailwind styles applied.

### 5. Run Background Worker (Optional)

The background worker processes async jobs for report generation. To run it locally:

```bash
pnpm worker
# or
npm run worker
```

**Requirements:**
- All environment variables must be set in `.env.local`
- Supabase `reports` storage bucket must exist and be configured as public
- The worker will process pending jobs and exit when the queue is empty

**How it works:**
1. Fetches up to 5 pending jobs with `job_type='deep_report'`
2. For each job:
   - Marks it as `processing`
   - Fetches the associated chart data
   - Generates a detailed report using OpenAI (model: `OPENAI_REPORT_MODEL`)
   - Uploads the report to Supabase Storage (`reports` bucket)
   - Marks the job as `done` with `result_url`
3. Failed jobs are marked as `failed` with error details in metadata
4. Rate limiting: 1 second delay between jobs to avoid overwhelming OpenAI

**Logs:**
The worker provides detailed console logs for debugging:
- Job processing status
- OpenAI API calls
- Storage uploads
- Success/failure messages

**Example output:**
```
[Worker] Starting worker...
[Worker] Using OpenAI model: gpt-4o
[Worker] Fetching pending jobs...
[Worker] Found 2 pending job(s)
[Worker] Processing job abc123...
[Worker] Job abc123 marked as processing
[Worker] Fetching chart xyz789...
[Worker] Chart xyz789 fetched successfully
[Worker] Generating report with OpenAI (model: gpt-4o)...
[Worker] Report generated (1234 characters)
[Worker] Uploading report to storage bucket 'reports' as abc123.txt...
[Worker] Report uploaded successfully
[Worker] Public URL: https://your-project.supabase.co/storage/v1/object/public/reports/abc123.txt
[Worker] Job abc123 completed successfully ✓
[Worker] Processed 2 job(s)
[Worker] Worker finished successfully
```

### 6. Run Tests

```bash
pnpm test
# or
npm test

# Watch mode for development
pnpm test:watch
# or
npm run test:watch
```

### 7. Build for Production

```bash
pnpm build
pnpm start
```

## Project Structure

```
/eastern-destiny/
├── components/          # React components
│   ├── ChartView.tsx   # Chart display component
│   └── ReportCard.tsx  # Report download card
├── docs/               # Documentation
│   └── bazi-algorithm.md  # BaZi algorithm documentation
├── lib/                # Utility libraries
│   ├── supabase.ts     # Supabase client configuration
│   ├── bazi.ts         # BaZi calculation logic
│   └── bazi.test.ts    # BaZi unit tests
├── pages/              # Next.js pages (Pages Router)
│   ├── _app.tsx        # App wrapper
│   ├── index.tsx       # Homepage
│   ├── compute.tsx     # Chart computation page
│   ├── dashboard.tsx   # User dashboard
│   └── api/            # API routes
│       ├── profiles.ts           # Create user profiles
│       ├── charts/compute.ts     # Compute BaZi charts
│       ├── ai/interpret.ts       # AI interpretation
│       ├── reports/generate.ts   # Generate paid reports
│       └── jobs/[id].ts          # Job status endpoint
├── styles/
│   └── globals.css     # Global styles with Tailwind directives
├── worker/
│   └── worker.ts       # Background job processor
├── .env.example        # Environment variables template
├── next.config.js      # Next.js configuration
├── tailwind.config.js  # Tailwind CSS configuration
├── tsconfig.json       # TypeScript configuration
├── vitest.config.ts    # Vitest configuration
└── package.json        # Dependencies
```

## Key Features & Implementation

### BaZi Calculation
The `lib/bazi.ts` module provides accurate BaZi (Four Pillars) calculation with proper Heavenly Stems (天干) and Earthly Branches (地支) derivation. It includes:

- **Accurate Gan-Zhi Calculation**: Proper derivation for year, month, day, and hour pillars using the `solarlunar` library for Chinese calendar conversion
- **Hour Pillar Computation**: Implements the "Five Rat Formula" (五鼠遁) to derive hour stems based on day stems
- **Timezone Handling**: Correctly handles timezone conversion and DST
- **Five Elements Balance**: Computes Wuxing (五行) scores from all eight characters including hidden stems
- **Configurable Weights**: Supports custom weights for stems, branches, and hidden stems
- **Edge Case Handling**: Properly handles midnight boundaries, lunar month transitions, and other edge cases

See [docs/bazi-algorithm.md](docs/bazi-algorithm.md) for detailed algorithm documentation and limitations.

### AI Interpretation
Uses OpenAI's GPT-4o-mini model (configurable via `OPENAI_MODEL_SUMMARY`) to generate short interpretations (150-200 characters) of BaZi charts. Premium reports can use GPT-4o for longer, more detailed analysis.

### Payment Processing
Stripe Checkout integration for purchasing detailed fortune reports. After successful payment, a job is created in the database for async processing by the worker. The Stripe API version is configurable via `STRIPE_API_VERSION` (defaults to 2024-06-20).

### Background Jobs
The `worker/worker.ts` script polls the `jobs` table for pending report generation tasks and processes them asynchronously.

## API Endpoints

### POST `/api/profiles`
Create a new user profile with birth information.

**Request body:**
```json
{
  "name": "John Doe",
  "birth_local": "1990-01-15T08:30:00Z",
  "birth_timezone": "Asia/Shanghai",
  "gender": "male",
  "lat": 31.2304,
  "lon": 121.4737
}
```

**Response:**
```json
{
  "ok": true,
  "profile_id": "uuid-here"
}
```

**MVP Note:** No authentication required. Profiles are created anonymously with `user_id: null`.

### POST `/api/charts/compute`
Compute a BaZi chart for a given profile.

**Request body:**
```json
{
  "profile_id": "uuid-here"
}
```

**Response:**
```json
{
  "ok": true,
  "chart": { /* chart data */ },
  "chart_id": "uuid-here"
}
```

### GET `/api/my/charts`
Retrieve recent charts. Returns the latest N charts (default: 20, max: 100).

**Query parameters:**
- `profile_id` (optional): Filter charts by profile ID
- `limit` (optional): Number of charts to return (1-100)

**Example:**
```bash
curl "http://localhost:3000/api/my/charts?profile_id=uuid-here&limit=10"
```

**Response:**
```json
{
  "ok": true,
  "charts": [
    {
      "id": "uuid",
      "profile_id": "uuid",
      "chart_json": { /* chart data */ },
      "wuxing_scores": { /* scores */ },
      "ai_summary": "AI interpretation text",
      "created_at": "2024-01-15T08:30:00Z"
    }
  ]
}
```

**MVP Note:** Without authentication, this endpoint returns charts based on optional `profile_id` filter. In production, this should be filtered by authenticated user.

### POST `/api/ai/interpret`
Generate AI interpretation for a chart.

**Request body:**
```json
{
  "chart_id": "uuid-here",
  "question": "What does this chart say about career?"
}
```

**Response:**
```json
{
  "ok": true,
  "summary": "AI-generated interpretation text in Chinese"
}
```

### POST `/api/reports/generate`
Create a Stripe checkout session for purchasing a detailed report.

**Request body:**
```json
{
  "chart_id": "uuid-here"
}
```

**Response:**
```json
{
  "ok": true,
  "url": "https://checkout.stripe.com/..."
}
```

**Note:** Validates chart existence before creating checkout session.

## Deployment

### Vercel (Recommended for Web App)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy!

**Important**: Ensure `SUPABASE_SERVICE_ROLE_KEY` and other sensitive keys are added as environment variables in Vercel, not committed to your repository.

### Background Worker Deployment

The `worker/worker.ts` script processes async jobs for report generation and needs to run separately from the web application.

#### Worker Requirements

The worker requires these environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access
- `OPENAI_API_KEY` - OpenAI API key for report generation
- `OPENAI_REPORT_MODEL` - (Optional) OpenAI model to use (defaults to `gpt-4o`)

The worker also expects:
- A Supabase storage bucket named `reports` configured with public access
- Jobs table with pending jobs of type `deep_report`

#### Deployment Options

**Option 1: Cron Job / Scheduled Task (Recommended)**

Deploy the worker as a scheduled task that runs periodically (e.g., every 5 minutes):

```bash
# Run every 5 minutes via cron
*/5 * * * * cd /path/to/project && npm run worker >> /var/log/worker.log 2>&1
```

**Option 2: Continuous Service**

Run the worker as a continuous service using a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Create a worker script that runs in a loop
# worker-loop.sh:
#!/bin/bash
while true; do
  npm run worker
  sleep 300  # Wait 5 minutes between runs
done

# Start with PM2
pm2 start worker-loop.sh --name "bazi-worker"
pm2 save
```

**Option 3: External Services**

Deploy the worker on platforms that support background jobs:

- **Railway**: Deploy as a standalone service with cron triggers
- **Render**: Use Render's Cron Jobs feature (runs worker on schedule)
- **Fly.io**: Deploy as a separate app with scheduled runs
- **Heroku**: Use Heroku Scheduler add-on
- **AWS Lambda**: Set up as a scheduled Lambda function
- **Google Cloud Run Jobs**: Deploy as a scheduled Cloud Run job

**Option 4: Vercel Cron Jobs (Pro Plan)**

If you have Vercel Pro, you can use Vercel Cron Jobs:

1. Create `pages/api/cron/process-jobs.ts`:
```typescript
import type { NextApiRequest, NextApiResponse } from 'next'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret for security
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  try {
    const { stdout, stderr } = await execAsync('npm run worker')
    return res.status(200).json({ ok: true, stdout, stderr })
  } catch (error) {
    return res.status(500).json({ error: 'Worker failed' })
  }
}
```

2. Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/process-jobs",
    "schedule": "*/5 * * * *"
  }]
}
```

#### Monitoring and Logs

- The worker logs all activity to stdout/stderr
- For production, pipe logs to a logging service (Datadog, LogDNA, CloudWatch, etc.)
- Monitor job status in your Supabase database:
  ```sql
  SELECT status, COUNT(*) FROM jobs GROUP BY status;
  SELECT * FROM jobs WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 10;
  ```

#### Scaling Considerations

For high-volume usage:
- Run multiple worker instances (ensure they don't process the same jobs)
- Use a proper job queue (BullMQ, AWS SQS, etc.)
- Implement job locking to prevent race conditions
- Add retries for failed jobs
- Monitor OpenAI rate limits and adjust `DELAY_BETWEEN_JOBS_MS` in worker code

### Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema from the "Set Up Supabase" section
3. Create a storage bucket named `reports` with public access
4. Copy your project URL and API keys to your environment variables

### Stripe Configuration

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get your API keys from the Stripe dashboard
3. **Important**: Use test keys (`sk_test_...`) in development, not live keys
4. Configure webhook endpoints for payment confirmation (not included in MVP)
5. Set `STRIPE_API_VERSION` in environment variables if you need a specific version

### OpenAI Setup

1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. Add credits to your account
3. Add the API key to your environment variables

## MVP Limitations

This is an MVP (Minimum Viable Product) with the following known limitations:

### Authentication
- **No user authentication required**: Profiles can be created anonymously
- **Service role key used**: All database operations use the Supabase service role key, bypassing Row Level Security (RLS)
- **Security risk**: In production, implement proper authentication and RLS policies

### BaZi Calculation
- **Simplified logic**: The BaZi calculation in `lib/bazi.ts` is a placeholder with basic Gan-Zhi mapping
- **Not production-ready**: Replace with accurate Chinese astrology algorithms for real use

### Payment Flow
- **No webhook handler**: Payment confirmation relies on manual checking, no automated webhook processing
- **Race conditions**: Job creation happens before payment confirmation

### Error Handling
- **Minimal validation**: Input validation is basic
- **No retry logic**: Failed jobs are marked as failed without retry attempts
- **No rate limiting**: API routes have no rate limiting protection

### Scalability
- **Polling-based worker**: Jobs are processed by polling, not event-driven
- **No queue system**: Consider implementing Redis or similar for production

## Development

### Running Locally

**Web Application:**
```bash
pnpm dev
# App runs on http://localhost:3000
```

**Background Worker:**
```bash
pnpm worker
# Processes pending jobs and exits
```

For continuous worker development, you can run it in watch mode or set up a loop:
```bash
# Option 1: Manual re-runs after each change
pnpm worker

# Option 2: Loop for continuous processing (in a separate terminal)
while true; do pnpm worker; sleep 60; done
```

### Linting
```bash
pnpm lint
```

### Type Checking
TypeScript will check types during build. For continuous checking:
```bash
pnpm tsc --watch
```

### Testing the Worker Locally

1. Ensure all environment variables are set in `.env.local`
2. Create a test job in your database:
```sql
-- Create a test profile
INSERT INTO profiles (name, birth_local, birth_timezone, gender)
VALUES ('Test User', '1990-01-15T08:30:00', 'Asia/Shanghai', 'male')
RETURNING id;

-- Create a test chart (replace profile_id with the ID from above)
INSERT INTO charts (profile_id, chart_json, wuxing_scores)
VALUES (
  'your-profile-id',
  '{"year":"庚午","month":"戊寅","day":"甲子","hour":"丙寅"}'::jsonb,
  '{"wood":2,"fire":3,"earth":1,"metal":1,"water":1}'::jsonb
)
RETURNING id;

-- Create a test job (replace chart_id with the ID from above)
INSERT INTO jobs (chart_id, job_type, status)
VALUES ('your-chart-id', 'deep_report', 'pending')
RETURNING id;
```

3. Run the worker:
```bash
pnpm worker
```

4. Check the output in the console and verify the report was uploaded to the `reports` bucket

5. Verify the job status was updated:
```sql
SELECT * FROM jobs WHERE id = 'your-job-id';
```

6. Test the public URL returned in `result_url`:
```bash
curl "YOUR_RESULT_URL"
```

## Contributing

This is an MVP project. For production use, consider:
- Implementing proper authentication (Supabase Auth)
- Adding comprehensive RLS policies
- Replacing placeholder BaZi logic with accurate calculations
- Adding Stripe webhook handlers
- Implementing proper error handling and logging
- Adding tests (unit, integration, e2e)
- Setting up monitoring and analytics

## License

Private project - all rights reserved.

## Support

For issues or questions, please check:
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [OpenAI Documentation](https://platform.openai.com/docs)
