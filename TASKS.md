# Eastern Destiny V1 — MVP Development Tasks

This is a living checklist of all MVP development work for the Eastern Destiny BaZi fortune-telling application. Check off items as they are completed and update this document as the project evolves.

---

## A. Project Setup

- [x] Initialize Next.js + TypeScript + Tailwind configs
  - [x] `.gitignore` for Next.js + Node.js + environment files
  - [x] `next-env.d.ts` generated
  - [x] `styles/globals.css` with Tailwind directives
- [x] Create base configuration files
  - [x] `package.json` with all dependencies (Next.js, TypeScript, Tailwind, Supabase, OpenAI, Stripe, etc.)
  - [x] `tsconfig.json` with strict mode enabled
  - [x] `next.config.js` for Next.js configuration
  - [x] `tailwind.config.js` with default configuration
  - [x] `postcss.config.js` for Tailwind processing
  - [x] `.env.example` with all required environment variables
- [x] Verify development server
  - [x] Run `pnpm dev` successfully
  - [x] Homepage renders with Tailwind styles

---

## B. App Pages & Components

### Pages (Pages Router)
- [x] `pages/_app.tsx` — App wrapper with Tailwind CSS imports
- [x] `pages/index.tsx` — Profile creation form + navigation to compute page
- [x] `pages/compute.tsx` — Chart computation + AI summary display
- [x] `pages/dashboard.tsx` — List user's charts (calls `/api/my/charts`)

### Components
- [x] `components/ChartView.tsx` — Display BaZi chart data
- [x] `components/ReportCard.tsx` — Report download card component

---

## C. Supabase Integration

### Client Setup
- [x] `lib/supabase.ts` — Export both `supabase` (anon) and `supabaseService` (service role) clients

### Database Schema
- [ ] Create `profiles` table
  - Schema: `id`, `user_id`, `name`, `birth_local`, `birth_timezone`, `gender`, `lat`, `lon`, `created_at`
  - See `README.md` for full SQL schema
- [ ] Create `charts` table
  - Schema: `id`, `profile_id`, `chart_json`, `wuxing_scores`, `ai_summary`, `created_at`
- [ ] Create `jobs` table
  - Schema: `id`, `user_id`, `chart_id`, `job_type`, `status`, `result_url`, `created_at`, `updated_at`
- [ ] Create indexes
  - `idx_profiles_user_id`, `idx_charts_profile_id`, `idx_jobs_status`

### Storage
- [ ] Create `reports` bucket in Supabase Storage
  - Set to public access or configure appropriate policies

### Row Level Security (RLS)
- [ ] Minimal RLS policies for MVP (service role bypasses RLS)
  - Note: In production, implement proper RLS policies per table

---

## D. API Routes

### Implemented Routes
- [x] `pages/api/profiles.ts` — Create user profiles (uses `supabaseService`)
- [x] `pages/api/charts/compute.ts` — Compute BaZi charts
- [x] `pages/api/ai/interpret.ts` — Generate AI interpretations via OpenAI
- [x] `pages/api/reports/generate.ts` — Create Stripe checkout session for report purchase
- [x] `pages/api/jobs/[id].ts` — Retrieve job status by ID

### Missing Routes
- [ ] `pages/api/my/charts.ts` — **TODO: Implement endpoint to list user's charts**
  - Referenced by `pages/dashboard.tsx`
  - Should return list of charts for a user/profile

### Future Routes (Post-MVP)
- [ ] `pages/api/stripe/webhook.ts` — Handle Stripe webhook events for payment confirmation

---

## E. Background Worker

- [x] `worker/worker.ts` — Background job processor
  - Polls `jobs` table for pending report generation tasks
  - Generates PDF reports and uploads to `reports` storage bucket
  - Updates job status to `completed` or `failed`
- [ ] Add npm script to run worker
  - Example: `"worker": "node -r esbuild-register worker/worker.ts"` or similar
  - Document how to run worker locally in `README.md`

---

## F. Library & Business Logic

- [x] `lib/bazi.ts` — BaZi calculation logic
  - **Note**: Current implementation is a placeholder/simplified for MVP
  - See follow-up tasks for production-ready logic

---

## G. Documentation & Deployment

### Documentation
- [x] `README.md` — Complete project documentation
  - [x] Tech stack overview
  - [x] Quick start guide (install, env vars, run dev server)
  - [x] Supabase setup instructions (SQL schema, storage, RLS notes)
  - [x] Project structure
  - [x] Deployment instructions (Vercel, worker deployment options)
  - [x] MVP limitations clearly documented
  - [x] Environment variables table with descriptions

- [ ] `README_DEPLOY.md` (Optional) — Detailed deployment guide
  - Step-by-step Supabase SQL/RLS/storage setup
  - Worker deployment options (cron jobs, serverless, Railway, etc.)
  - Production environment variable checklist
  - Stripe webhook configuration

### Type Definitions
- [x] `types/` directory — TypeScript type definitions (if applicable)

---

## H. Testing & Quality Assurance

- [ ] Manual testing
  - [ ] Test profile creation flow (`pages/index.tsx` → `pages/api/profiles.ts`)
  - [ ] Test chart computation (`pages/compute.tsx` → `pages/api/charts/compute.ts`)
  - [ ] Test AI interpretation (`pages/api/ai/interpret.ts`)
  - [ ] Test Stripe checkout flow (`pages/api/reports/generate.ts`)
  - [ ] Test job status endpoint (`pages/api/jobs/[id].ts`)
  - [ ] Test worker processing (`worker/worker.ts`)
  - [ ] Test dashboard displays charts (`pages/dashboard.tsx`)

- [ ] Environment verification
  - [ ] All environment variables in `.env.example` are documented
  - [ ] Service role key is never exposed to client-side code
  - [ ] Stripe API version configuration works correctly

- [ ] Cross-browser testing
  - [ ] Test in Chrome, Firefox, Safari
  - [ ] Mobile responsive checks

---

## I. Production Readiness Checklist (Pre-Launch)

- [ ] Supabase setup
  - [ ] All tables created with proper schema
  - [ ] Storage bucket `reports` configured
  - [ ] RLS policies reviewed (even if minimal for MVP)
  - [ ] Service role key secured (server-side only)

- [ ] Third-party integrations
  - [ ] OpenAI API key configured and tested
  - [ ] Stripe API key configured and tested
  - [ ] Stripe API version set (defaults to `2024-06-20`)

- [ ] Deployment
  - [ ] Next.js app deployed to Vercel (or hosting platform)
  - [ ] All environment variables configured in hosting platform
  - [ ] Worker deployed and running (cron job or separate service)
  - [ ] SSL/HTTPS enabled
  - [ ] `NEXT_PUBLIC_SITE_URL` set correctly for production

- [ ] Monitoring & Logging
  - [ ] Basic error logging in place
  - [ ] Monitor API route performance
  - [ ] Track worker job success/failure rates

---

## J. Follow-Up Tasks (Post-MVP)

### High Priority
- [ ] **Replace placeholder BaZi logic** in `lib/bazi.ts`
  - Implement accurate Gan-Zhi (干支) calculation
  - Use proper Chinese calendar conversion
  - Add Wuxing (五行) scoring logic
  - Validate against known BaZi charts

- [ ] **Implement `/api/my/charts` route**
  - Endpoint is referenced by `pages/dashboard.tsx` but not yet implemented
  - Should return user's charts from database

- [ ] **Add Supabase Auth integration**
  - Replace anonymous profile creation with authenticated users
  - Use `auth.users` table for user management
  - Pass bearer tokens in API requests
  - Update API routes to verify authentication

- [ ] **Stripe webhook handler** (`/api/stripe/webhook`)
  - Handle `checkout.session.completed` events
  - Automatically create jobs upon successful payment
  - Verify webhook signatures for security

### Medium Priority
- [ ] Comprehensive error handling
  - Add try-catch blocks in all API routes
  - Return meaningful error messages to client
  - Log errors to monitoring service (e.g., Sentry)

- [ ] Input validation
  - Validate birth date/time formats
  - Validate timezone strings
  - Sanitize user inputs

- [ ] Rate limiting
  - Add rate limiting to API routes
  - Prevent abuse of OpenAI API calls
  - Throttle chart generation requests

- [ ] Worker improvements
  - Replace polling with event-driven architecture
  - Add retry logic for failed jobs
  - Implement job queue (Redis, Bull, etc.)

### Low Priority
- [ ] Automated testing
  - Unit tests for BaZi calculation logic
  - Integration tests for API routes
  - End-to-end tests for user flows

- [ ] Performance optimization
  - Optimize database queries (add indexes as needed)
  - Cache frequently accessed data
  - Optimize bundle size

- [ ] Internationalization (i18n)
  - Support for English and Chinese languages
  - Localized date/time formatting

- [ ] Enhanced UI/UX
  - Improve chart visualization
  - Add loading states and error messages
  - Responsive design improvements

---

## K. Known Issues & Technical Debt

- **Security**: Service role key bypasses RLS — all writes are unrestricted
- **Authentication**: No user authentication in MVP — anyone can create profiles
- **BaZi Accuracy**: Current calculation is simplified and not production-ready
- **Payment Flow**: No webhook handler — race conditions possible
- **Error Handling**: Minimal validation and error handling
- **Scalability**: Polling-based worker is not suitable for high load
- **Testing**: No automated tests in MVP

---

## Notes

- **Pages Router**: This project uses Next.js Pages Router (not App Router)
- **Package Manager**: Use `pnpm` for consistency (falls back to `npm` if unavailable)
- **TypeScript**: Strict mode enabled — all code must be fully typed
- **Service Role**: `supabaseService` client used in API routes only, never exposed to client
- **Stripe API Version**: Configurable via `STRIPE_API_VERSION` env var (default: `2024-06-20`)

---

**Last Updated**: 2024-11-04

This checklist is a living document. Update it as tasks are completed, new tasks are discovered, or priorities change.
