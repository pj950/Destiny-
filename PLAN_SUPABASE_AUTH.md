# Plan: Migrate to Supabase Auth (Option A)

**Status**: Planning Phase  
**Created**: 2024-11-04  
**Target Completion**: TBD based on prioritization

---

## Executive Summary

This document outlines the plan to migrate Eastern Destiny from the current anonymous MVP authentication (Option B) to a full Supabase Auth implementation (Option A). The migration will introduce proper user authentication using email magic links and/or OAuth, enforce Row Level Security (RLS) policies, and provide a foundation for multi-tenant user data.

**Key Changes**:
- Client-side authentication flow with session management
- Bearer token propagation to all API requests
- User-scoped data access via RLS policies
- Migration strategy for existing anonymous data
- Protected UI routes and authenticated dashboard

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target Architecture](#2-target-architecture)
3. [Frontend/UI Changes](#3-frontendui-changes)
4. [Backend/API Changes](#4-backendapi-changes)
5. [Database Changes](#5-database-changes)
6. [Data Migration Strategy](#6-data-migration-strategy)
7. [Testing Strategy](#7-testing-strategy)
8. [Rollout Plan](#8-rollout-plan)
9. [Dependencies & Risks](#9-dependencies--risks)
10. [Timeline & Phases](#10-timeline--phases)

---

## 1. Current State Analysis

### 1.1 Authentication Flow (MVP)
- **No authentication required**: All API routes accept requests without bearer tokens
- **Anonymous profiles**: `user_id` is NULL on all profiles, charts, and jobs records
- **Service role everywhere**: All server-side operations use `supabaseService` (service role key) to bypass RLS
- **No session management**: Client doesn't track or maintain user sessions
- **Open access**: Dashboard and all routes are publicly accessible

### 1.2 Existing RLS Policies
The database already has RLS enabled with policies in place:
- **Profiles**: Allow SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()`
- **Charts**: Allow SELECT via JOIN to profiles where `profiles.user_id = auth.uid()`
- **Jobs**: Allow SELECT where `user_id = auth.uid()`
- **MVP Policy**: Special policy allows INSERT on profiles with `user_id IS NULL`

### 1.3 TODO Comments in Code
API routes already have commented-out bearer token validation logic:
- `/api/profiles.ts` (lines 7-14)
- `/api/charts/compute.ts` (lines 8-9)
- `/api/my/charts.ts` (lines 10-17)
- `/api/reports/generate.ts` (implicit, no auth check)

### 1.4 Tech Stack
- Next.js 13 Pages Router
- Supabase client v2.29.0
- TypeScript strict mode
- Tailwind CSS for styling

---

## 2. Target Architecture

### 2.1 Authentication Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │────────▶│  Auth Modal  │────────▶│  Supabase   │
│   (Client)  │         │ (Magic Link) │         │    Auth     │
└─────────────┘         └──────────────┘         └─────────────┘
       │                                                  │
       │                                                  │
       ▼                                                  ▼
┌─────────────┐                                  ┌─────────────┐
│   Session   │◀─────────────────────────────────│ Access Token│
│   Storage   │                                  │  (JWT)      │
└─────────────┘                                  └─────────────┘
       │
       │ Authorization: Bearer <token>
       ▼
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│ API Request │────────▶│ Token Verify │────────▶│  Supabase   │
│   (fetch)   │         │  Middleware  │         │   (RLS)     │
└─────────────┘         └──────────────┘         └─────────────┘
```

### 2.2 Component Architecture

```
pages/_app.tsx
  └── AuthProvider (new context)
       ├── Session management
       ├── Token refresh
       └── User state
            └── pages/
                 ├── index.tsx (public)
                 ├── dashboard.tsx (protected)
                 └── compute.tsx (protected)
```

### 2.3 Data Access Patterns

**Client-side**:
- Use `supabase.auth.getSession()` to get current session
- Pass `session.access_token` in Authorization header for API calls
- Use `supabase` client (anon key) for direct database reads (RLS enforced)

**Server-side API routes**:
- Extract token from `Authorization: Bearer <token>` header
- Validate token using `supabase.auth.getUser(token)`
- Use `supabaseService` for database writes (still bypassing RLS for MVP+)
- Store `user_id` from validated token on created records

**Background worker**:
- Continue using `supabaseService` (service role) - no changes needed

---

## 3. Frontend/UI Changes

### 3.1 New Components

#### 3.1.1 AuthContext & AuthProvider (`lib/auth.tsx`)
```typescript
interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string) => Promise<void>
  signOut: () => Promise<void>
}
```

**Responsibilities**:
- Manage auth state with React Context
- Listen to Supabase auth state changes (`onAuthStateChange`)
- Refresh tokens automatically
- Persist session in localStorage (handled by Supabase)
- Provide helper methods (signIn, signOut)

#### 3.1.2 AuthModal Component (`components/AuthModal.tsx`)
```typescript
interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'signin' | 'signup'
}
```

**Features**:
- Email input for magic link
- OAuth providers (Google, GitHub - optional Phase 2)
- Loading states and error handling
- Success message: "Check your email for the magic link"
- Styling: Match existing Tailwind theme

#### 3.1.3 ProtectedRoute Component (`components/ProtectedRoute.tsx`)
```typescript
interface ProtectedRouteProps {
  children: React.ReactNode
}
```

**Behavior**:
- Check if user is authenticated via `useAuth()`
- If not authenticated: redirect to homepage with auth modal open
- If authenticated: render children
- Show loading spinner while checking auth state

#### 3.1.4 Navigation/Header Component (`components/Header.tsx`)
**Features**:
- Display user email when logged in
- "Sign In" button when logged out
- "Sign Out" button when logged in
- Link to dashboard (only when authenticated)
- Responsive design

### 3.2 Modified Pages

#### 3.2.1 `pages/_app.tsx`
```typescript
// Wrap entire app with AuthProvider
export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Header />
      <Component {...pageProps} />
    </AuthProvider>
  )
}
```

#### 3.2.2 `pages/index.tsx`
**Changes**:
- Add "Sign In" button in header/corner
- Keep free trial flow (compute BaZi without auth) OR
- **Decision Point**: Require auth before chart creation?
  - Option A: Keep anonymous trial, then prompt to "Save" (requires sign-in)
  - Option B: Require sign-in before any chart creation

**Recommendation**: Option A (less friction, better conversion)

#### 3.2.3 `pages/dashboard.tsx`
**Changes**:
- Wrap in `ProtectedRoute` component
- Fetch charts using authenticated API call with bearer token
- Pass `Authorization: Bearer ${session.access_token}` header
- Display user-specific charts only (filtered by backend)
- Add "Sign Out" button

#### 3.2.4 `pages/compute.tsx`
**Changes**:
- Check if user is authenticated
- If authenticated: pass bearer token when creating chart
- If not authenticated: allow anonymous chart creation (Phase 1) or prompt sign-in (Phase 2)

### 3.3 API Request Helper

Create `lib/apiClient.ts`:
```typescript
export async function authenticatedFetch(
  url: string, 
  options?: RequestInit
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }
  
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  })
}
```

**Usage**: Replace all `fetch()` calls in protected pages with `authenticatedFetch()`

---

## 4. Backend/API Changes

### 4.1 Token Validation Middleware

Create `lib/auth-middleware.ts`:
```typescript
import { NextApiRequest } from 'next'
import { supabase } from './supabase'

export async function verifyBearerToken(
  req: NextApiRequest
): Promise<{ user_id: string } | null> {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  
  const token = authHeader.substring(7)
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return null
    }
    
    return { user_id: user.id }
  } catch (err) {
    return null
  }
}
```

### 4.2 Modified API Routes

#### 4.2.1 `/api/profiles.ts`
**Changes**:
```typescript
// Add authentication
const authResult = await verifyBearerToken(req)
if (!authResult) {
  return res.status(401).json({ ok: false, message: 'Unauthorized' })
}

// Set user_id on insert
const { data: p, error: insertErr } = await supabaseService
  .from('profiles')
  .insert([{ 
    user_id: authResult.user_id, // ← Set from token
    name, 
    birth_local, 
    // ...
  }])
```

**Migration Consideration**: Support optional auth in Phase 1 (feature flag)

#### 4.2.2 `/api/charts/compute.ts`
**Changes**:
```typescript
// Add authentication
const authResult = await verifyBearerToken(req)
if (!authResult) {
  return res.status(401).json({ ok: false, message: 'Unauthorized' })
}

// Verify profile ownership
const { data: profile, error } = await supabaseService
  .from('profiles')
  .select('*')
  .eq('id', profile_id)
  .eq('user_id', authResult.user_id) // ← Verify ownership
  .single()
```

#### 4.2.3 `/api/my/charts.ts`
**Changes**:
```typescript
// Require authentication
const authResult = await verifyBearerToken(req)
if (!authResult) {
  return res.status(401).json({ ok: false, message: 'Unauthorized' })
}

// Filter by user's profiles only
const { data: charts, error } = await supabaseService
  .from('charts')
  .select(`
    id, 
    profile_id, 
    chart_json, 
    wuxing_scores, 
    ai_summary, 
    created_at,
    profiles!inner(user_id)
  `)
  .eq('profiles.user_id', authResult.user_id) // ← User-scoped filter
  .order('created_at', { ascending: false })
  .limit(parsedLimit)
```

#### 4.2.4 `/api/reports/generate.ts`
**Changes**:
```typescript
// Require authentication
const authResult = await verifyBearerToken(req)
if (!authResult) {
  return res.status(401).json({ ok: false, message: 'Unauthorized' })
}

// Verify chart ownership before creating Stripe session
const { data: chart, error: chartError } = await supabaseService
  .from('charts')
  .select('id, profile_id, profiles!inner(user_id)')
  .eq('id', chart_id)
  .eq('profiles.user_id', authResult.user_id) // ← Verify ownership
  .single()

// Set user_id on job creation
await supabaseService
  .from('jobs')
  .insert([{ 
    user_id: authResult.user_id, // ← Set from token
    chart_id, 
    // ...
  }])
```

### 4.3 New API Routes

#### 4.3.1 `/api/auth/session.ts` (optional)
**Purpose**: Validate session from client-side
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  
  const authResult = await verifyBearerToken(req)
  
  if (!authResult) {
    return res.status(401).json({ ok: false })
  }
  
  return res.json({ ok: true, user_id: authResult.user_id })
}
```

---

## 5. Database Changes

### 5.1 New Migration: Enable Supabase Auth

**File**: `supabase/migrations/YYYYMMDDHHMMSS_enable_supabase_auth.sql`

```sql
-- Migration: Enable Supabase Auth for production use
-- Description: Remove MVP anonymous policies and enforce auth.uid() checks

-- ============================================
-- REMOVE MVP ANONYMOUS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Allow anonymous profile creation" ON profiles;

-- ============================================
-- UPDATE EXISTING POLICIES (NO CHANGES NEEDED)
-- ============================================

-- The existing policies already check auth.uid() = user_id
-- No modifications needed to:
-- - "Users can view their own profiles"
-- - "Users can insert their own profiles"
-- - "Users can update their own profiles"
-- - "Users can delete their own profiles"
-- - "Users can view their own charts"
-- - "Users can view their own jobs"

-- ============================================
-- ADD INDEXES FOR PERFORMANCE
-- ============================================

-- These indexes already exist from initial migration, but verify:
-- CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
-- CREATE INDEX IF NOT EXISTS idx_charts_profile_id ON charts(profile_id);
-- CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
-- CREATE INDEX IF NOT EXISTS idx_jobs_chart_id ON jobs(chart_id);

-- ============================================
-- CONSTRAINTS
-- ============================================

-- Option A: Require user_id on new records (strict)
ALTER TABLE profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN user_id SET NOT NULL;

-- Option B: Keep user_id nullable for transition period (recommended)
-- No changes needed - keep existing schema

-- Add foreign key constraint to auth.users (if not exists)
-- Note: This may fail if auth.users table is not accessible
-- ALTER TABLE profiles 
--   ADD CONSTRAINT profiles_user_id_fkey 
--   FOREIGN KEY (user_id) 
--   REFERENCES auth.users(id) 
--   ON DELETE CASCADE;
```

**Decision Point**: 
- **Option A (Strict)**: Make `user_id` NOT NULL → Requires full migration first
- **Option B (Gradual)**: Keep `user_id` nullable → Allows dual-mode operation

**Recommendation**: Option B for safer rollout

### 5.2 Data Migration Script

**File**: `supabase/migrations/YYYYMMDDHHMMSS_migrate_anonymous_data.sql`

```sql
-- Migration: Migrate anonymous user data to authenticated users
-- Description: One-time migration to link existing profiles to auth.users

-- ============================================
-- APPROACH 1: ORPHAN CLEANUP (Destructive)
-- ============================================

-- Delete all anonymous profiles older than X days
-- DELETE FROM profiles WHERE user_id IS NULL AND created_at < NOW() - INTERVAL '30 days';

-- ============================================
-- APPROACH 2: ADMIN CLAIM (Recommended for testing)
-- ============================================

-- Create a migration admin user and assign all orphan data
-- Requires admin user to be created first via Supabase Auth dashboard
-- UPDATE profiles SET user_id = '<ADMIN_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE jobs SET user_id = '<ADMIN_USER_UUID>' WHERE user_id IS NULL;

-- ============================================
-- APPROACH 3: EMAIL COLLECTION & MANUAL CLAIM
-- ============================================

-- Requires building a UI flow:
-- 1. User signs in with email
-- 2. User provides profile_id from anonymous session
-- 3. API endpoint validates and transfers ownership
-- See section 6.3 for implementation details

-- ============================================
-- STATISTICS
-- ============================================

-- Count anonymous profiles
-- SELECT COUNT(*) FROM profiles WHERE user_id IS NULL;

-- Count anonymous jobs
-- SELECT COUNT(*) FROM jobs WHERE user_id IS NULL;
```

---

## 6. Data Migration Strategy

### 6.1 Migration Scenarios

#### Scenario A: Fresh Start (Simplest)
**Approach**: Delete all anonymous data, start with authenticated users only

**Pros**:
- Clean slate, no legacy data issues
- Simplest implementation
- No migration complexity

**Cons**:
- Lose all existing user data
- Bad user experience for existing users
- Not acceptable if MVP has paying customers

**Recommendation**: Only for early-stage MVP with no real users

#### Scenario B: Admin Consolidation
**Approach**: Assign all anonymous data to a single admin account

**Pros**:
- Simple one-time migration
- Preserves data for analysis
- No user interaction needed

**Cons**:
- Data not accessible to original users
- Not scalable if users have paid for reports

**Recommendation**: Acceptable for internal testing data

#### Scenario C: Session-Based Claim Flow (Recommended)
**Approach**: Allow users to claim their anonymous profiles after signing in

**Implementation**:
1. Store `profile_id` or `chart_id` in browser localStorage during anonymous session
2. When user signs in, check localStorage for profile IDs
3. Present UI: "We found existing data. Would you like to claim it?"
4. Backend API validates and transfers ownership:
   ```typescript
   // POST /api/profiles/claim
   UPDATE profiles 
   SET user_id = '<authenticated_user_id>' 
   WHERE id = '<profile_id>' 
   AND user_id IS NULL
   ```

**Pros**:
- Best user experience
- Preserves user data
- Allows gradual migration

**Cons**:
- More complex implementation
- Requires localStorage tracking
- Edge cases (localStorage cleared, different browser)

**Recommendation**: Best for production with real users

### 6.2 Migration Timeline

**Phase 1: Dual Mode (2-4 weeks)**
- Support both authenticated and anonymous users
- Feature flag: `FEATURE_AUTH_REQUIRED=false`
- Track anonymous profile IDs in localStorage
- Display "Sign in to save your data" banner

**Phase 2: Claim Flow (1-2 weeks)**
- Build claim UI and API endpoint
- Email campaign: "Create account to access your data"
- Set deadline for claiming data (e.g., 30 days)

**Phase 3: Auth Required (1 week)**
- Set `FEATURE_AUTH_REQUIRED=true`
- Disable anonymous profile creation
- Archived unclaimed data (move to backup table)

**Phase 4: Cleanup (Ongoing)**
- Delete anonymous profiles older than 90 days
- Monitor for orphaned records

### 6.3 Claim Flow Implementation

#### API Endpoint: `/api/profiles/claim.ts`
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  
  const authResult = await verifyBearerToken(req)
  if (!authResult) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' })
  }
  
  const { profile_ids } = req.body // Array of profile IDs to claim
  
  // Security: Only claim profiles that are currently anonymous
  const { data, error } = await supabaseService
    .from('profiles')
    .update({ user_id: authResult.user_id })
    .in('id', profile_ids)
    .is('user_id', null) // Only claim unclaimed profiles
    .select()
  
  if (error) {
    return res.status(500).json({ ok: false, message: error.message })
  }
  
  return res.json({ ok: true, claimed: data?.length || 0 })
}
```

#### Client-Side Tracking (`lib/claimTracking.ts`)
```typescript
const STORAGE_KEY = 'eastern_destiny_anonymous_profiles'

export function trackAnonymousProfile(profileId: string) {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  if (!existing.includes(profileId)) {
    existing.push(profileId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  }
}

export function getAnonymousProfiles(): string[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
}

export function clearAnonymousProfiles() {
  localStorage.removeItem(STORAGE_KEY)
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Auth Context**:
- [x] Renders children when user is authenticated
- [x] Redirects to login when user is not authenticated
- [x] Handles token refresh
- [x] Clears state on signOut()

**API Middleware**:
- [x] Rejects requests without Authorization header
- [x] Rejects requests with invalid token
- [x] Accepts requests with valid token
- [x] Extracts correct user_id from token

**Protected Routes**:
- [x] Blocks access when not authenticated
- [x] Allows access when authenticated
- [x] Shows loading state during auth check

### 7.2 Integration Tests

**Authentication Flow**:
- [x] User can sign up with email magic link
- [x] User receives email with magic link
- [x] Clicking magic link logs user in
- [x] Session persists after page reload
- [x] User can sign out

**Profile Creation**:
- [x] Authenticated user can create profile
- [x] Profile is assigned correct user_id
- [x] Profile is visible in dashboard
- [x] Anonymous profile creation is blocked (after Phase 3)

**Chart Computation**:
- [x] Authenticated user can compute chart for their profile
- [x] Cannot compute chart for another user's profile
- [x] Charts are visible in dashboard

**Report Generation**:
- [x] Authenticated user can purchase report for their chart
- [x] Cannot purchase report for another user's chart
- [x] Job is created with correct user_id
- [x] Worker processes job successfully

**Data Migration**:
- [x] User can claim anonymous profiles after sign-in
- [x] Only unclaimed profiles can be claimed
- [x] Cannot claim another user's profile
- [x] LocalStorage tracking works across sessions

### 7.3 Security Tests

**RLS Enforcement**:
- [x] User cannot read another user's profiles via direct Supabase query
- [x] User cannot read another user's charts via direct Supabase query
- [x] User cannot read another user's jobs via direct Supabase query
- [x] Service role can still bypass RLS (for worker)

**Token Validation**:
- [x] Expired token is rejected
- [x] Tampered token is rejected
- [x] Token from different Supabase project is rejected

**Ownership Verification**:
- [x] API routes verify resource ownership before mutation
- [x] User cannot delete another user's profile
- [x] User cannot generate report for another user's chart

### 7.4 Manual Testing Checklist

**Authentication**:
- [ ] Sign up with new email
- [ ] Sign in with existing email
- [ ] Check email for magic link
- [ ] Click magic link and verify redirect
- [ ] Sign out and verify session cleared
- [ ] Attempt to access dashboard without auth → Redirected

**Claim Flow**:
- [ ] Create anonymous profile (localStorage tracking enabled)
- [ ] Sign in and verify claim prompt appears
- [ ] Claim profile and verify ownership transfer
- [ ] Verify claimed profile appears in dashboard

**Data Access**:
- [ ] Create profile as User A
- [ ] Sign in as User B
- [ ] Verify User B cannot see User A's profiles/charts
- [ ] Verify dashboard shows only user-specific data

**Worker**:
- [ ] Create job as authenticated user
- [ ] Run worker with service role key
- [ ] Verify job processes successfully
- [ ] Verify result_url is accessible

---

## 8. Rollout Plan

### 8.1 Feature Flags

**Environment Variables** (`.env.local`):
```bash
# Feature flag: Require authentication for all operations
FEATURE_AUTH_REQUIRED=false  # Phase 1: false, Phase 3: true

# Feature flag: Enable claim flow UI
FEATURE_CLAIM_FLOW=false     # Phase 1: false, Phase 2: true

# Feature flag: Show auth prompts
FEATURE_AUTH_PROMPTS=true    # Always true after Phase 1
```

**Implementation** (`lib/featureFlags.ts`):
```typescript
export const FEATURES = {
  AUTH_REQUIRED: process.env.FEATURE_AUTH_REQUIRED === 'true',
  CLAIM_FLOW: process.env.FEATURE_CLAIM_FLOW === 'true',
  AUTH_PROMPTS: process.env.FEATURE_AUTH_PROMPTS === 'true',
}
```

### 8.2 Phased Rollout

#### Phase 1: Soft Launch (Week 1-2)
**Objective**: Deploy auth infrastructure without breaking existing flows

**Tasks**:
- Deploy AuthProvider and auth UI components
- Add "Sign In" button (optional, doesn't block usage)
- API routes support bearer tokens but don't require them
- Track anonymous profile IDs in localStorage
- Show banner: "Sign in to save your data permanently"

**Feature Flags**:
- `FEATURE_AUTH_REQUIRED=false`
- `FEATURE_CLAIM_FLOW=false`
- `FEATURE_AUTH_PROMPTS=true`

**Success Criteria**:
- [ ] No errors for existing anonymous users
- [ ] Auth flow works for new users who sign in
- [ ] Session persistence works
- [ ] Dashboard shows user-specific data for authenticated users

#### Phase 2: Claim Flow (Week 3-4)
**Objective**: Enable data migration from anonymous to authenticated users

**Tasks**:
- Deploy claim flow UI and API
- Email campaign to existing users (if email collected)
- Display claim prompt after sign-in (if localStorage has profile IDs)
- Monitor claim success rate

**Feature Flags**:
- `FEATURE_AUTH_REQUIRED=false` (still optional)
- `FEATURE_CLAIM_FLOW=true`
- `FEATURE_AUTH_PROMPTS=true`

**Success Criteria**:
- [ ] Users can successfully claim anonymous profiles
- [ ] Claimed profiles appear in dashboard
- [ ] No duplicate or lost data
- [ ] Claim success rate > 70%

#### Phase 3: Auth Required (Week 5-6)
**Objective**: Enforce authentication for all operations

**Tasks**:
- Set `FEATURE_AUTH_REQUIRED=true`
- Update API routes to return 401 for unauthenticated requests
- Show auth modal immediately on homepage
- Archive unclaimed anonymous data
- Run database migration to clean up orphan records

**Feature Flags**:
- `FEATURE_AUTH_REQUIRED=true`
- `FEATURE_CLAIM_FLOW=false` (claim window closed)
- `FEATURE_AUTH_PROMPTS=true`

**Success Criteria**:
- [ ] All new profiles have valid user_id
- [ ] No anonymous profiles created after cutoff date
- [ ] Authenticated user conversion rate > 80%
- [ ] No critical bugs reported

#### Phase 4: Hardening (Week 7+)
**Objective**: Optimize and finalize auth implementation

**Tasks**:
- Run database migration to set `user_id NOT NULL` constraint
- Remove MVP anonymous policies from RLS
- Delete unclaimed profiles older than 90 days
- Add OAuth providers (Google, GitHub)
- Performance optimization (reduce token validation overhead)
- Security audit (penetration testing)

**Success Criteria**:
- [ ] All RLS policies enforcing auth.uid() checks
- [ ] No performance degradation vs. MVP
- [ ] Security audit passed
- [ ] OAuth providers working (optional)

### 8.3 Rollback Plan

**Trigger Conditions**:
- Auth success rate < 60%
- Critical bug blocking user access
- High volume of support tickets

**Rollback Steps**:
1. Set `FEATURE_AUTH_REQUIRED=false` (immediate, no deploy needed)
2. Restore MVP API routes (commented-out auth checks)
3. Re-enable anonymous profile creation policy:
   ```sql
   CREATE POLICY "Allow anonymous profile creation"
     ON profiles
     FOR INSERT
     WITH CHECK (user_id IS NULL);
   ```
4. Deploy hotfix with rollback changes
5. Investigate and fix root cause
6. Resume rollout after fix is verified

**Rollback Impact**:
- Authenticated users continue to work normally
- Anonymous users can create profiles again
- No data loss

---

## 9. Dependencies & Risks

### 9.1 Dependencies

**External Services**:
- [x] Supabase Auth service availability
- [x] Email delivery for magic links (Supabase email provider)
- [x] OpenAI API (no changes needed)
- [x] Stripe API (no changes needed)

**Internal Dependencies**:
- [x] Supabase client library (`@supabase/supabase-js` v2.29.0)
- [x] React Context API (built-in)
- [x] Next.js API routes (no breaking changes)

**Migration Dependencies**:
- [x] LocalStorage availability (client-side tracking)
- [x] User cooperation (claim flow requires user action)

### 9.2 Risks & Mitigation

#### Risk 1: High User Drop-off During Auth Requirement
**Likelihood**: High  
**Impact**: High (loss of user acquisition)  

**Mitigation**:
- Implement soft auth first (optional sign-in)
- Use clear value proposition: "Save your charts, access anywhere"
- Gradual rollout with monitoring
- A/B test: prompt timing, messaging

**Contingency**: Revert to optional auth if conversion drops >30%

#### Risk 2: Data Loss During Migration
**Likelihood**: Medium  
**Impact**: Critical (user trust, paid reports)

**Mitigation**:
- Comprehensive testing of claim flow
- Database backups before migration
- Dry-run migration on staging environment
- Rollback plan ready

**Contingency**: Manual data recovery from backups

#### Risk 3: Email Delivery Issues (Magic Links)
**Likelihood**: Medium  
**Impact**: High (users cannot sign in)

**Mitigation**:
- Test with multiple email providers (Gmail, Outlook, etc.)
- Configure DKIM/SPF records for custom domain
- Fallback: Allow OAuth sign-in (Google, GitHub)
- Clear error messages: "Check spam folder"

**Contingency**: Switch to OAuth-only if email delivery fails

#### Risk 4: RLS Policy Misconfiguration
**Likelihood**: Low  
**Impact**: Critical (data breach, unauthorized access)

**Mitigation**:
- Thorough RLS testing with multiple test users
- Security audit before Phase 3
- Monitor Supabase logs for RLS violations
- Principle of least privilege (service role only for worker)

**Contingency**: Immediate rollback + security incident response

#### Risk 5: Worker Breaks After Auth Changes
**Likelihood**: Low  
**Impact**: High (reports not generated)

**Mitigation**:
- Worker uses service role (no changes needed)
- Integration tests for worker with authenticated jobs
- Staging environment testing

**Contingency**: Manual report generation until fix deployed

#### Risk 6: Performance Degradation (Token Validation)
**Likelihood**: Medium  
**Impact**: Medium (slower API responses)

**Mitigation**:
- Cache validated tokens (short TTL: 5 minutes)
- Use Supabase client's built-in token caching
- Monitor API latency with alerts
- Load testing before Phase 3

**Contingency**: Optimize token validation or add Redis cache

### 9.3 Open Questions

**Q1**: Should we collect email addresses during anonymous profile creation?  
**A1**: Yes (recommended) - add optional email field to profile form, use for migration outreach

**Q2**: How long should claim window remain open?  
**A2**: 30 days minimum, 90 days ideal - balance between user convenience and technical debt

**Q3**: What happens to paid reports in anonymous profiles?  
**A3**: Must allow claiming - store checkout_session_id in metadata, verify payment before claim

**Q4**: Should we support OAuth providers in Phase 1?  
**A4**: No - start with magic links, add OAuth in Phase 4 if needed (complexity vs. value)

**Q5**: Can users have multiple profiles per account?  
**A5**: Yes - one user_id, many profiles (already supported by schema)

---

## 10. Timeline & Phases

### 10.1 Estimated Effort

| Component | Effort | Priority | Dependencies |
|-----------|--------|----------|--------------|
| **Frontend** | | | |
| AuthContext & Provider | 4 hours | P0 | None |
| AuthModal component | 3 hours | P0 | AuthContext |
| ProtectedRoute component | 2 hours | P0 | AuthContext |
| Header/Navigation | 2 hours | P1 | AuthContext |
| Update pages (dashboard, etc.) | 3 hours | P0 | AuthContext |
| Claim flow UI | 4 hours | P1 | LocalStorage tracking |
| **Backend** | | | |
| Auth middleware | 3 hours | P0 | None |
| Update API routes (4 routes) | 4 hours | P0 | Auth middleware |
| Claim API endpoint | 2 hours | P1 | Auth middleware |
| Feature flags | 1 hour | P0 | None |
| **Database** | | | |
| Enable auth migration | 1 hour | P0 | None |
| Data migration script | 2 hours | P1 | Plan finalized |
| RLS policy updates | 1 hour | P2 | Phase 3 start |
| **Testing** | | | |
| Unit tests | 6 hours | P0 | Components ready |
| Integration tests | 8 hours | P0 | API routes ready |
| Security tests | 4 hours | P1 | RLS policies ready |
| Manual QA | 4 hours | P0 | All features deployed |
| **Deployment** | | | |
| Phase 1 deploy | 2 hours | P0 | All P0 tasks done |
| Phase 2 deploy | 1 hour | P1 | Claim flow ready |
| Phase 3 deploy | 2 hours | P2 | Migration complete |
| **Total** | **~53 hours** | | |

### 10.2 Timeline (Assumes 1 developer, part-time)

| Phase | Duration | Calendar Time | Deliverables |
|-------|----------|---------------|--------------|
| **Planning** | Complete | - | This document |
| **Phase 1: Soft Launch** | 20 hours | Week 1-2 | Auth infrastructure, optional sign-in |
| **Testing & QA** | 8 hours | Week 2 | Unit + integration tests |
| **Phase 2: Claim Flow** | 10 hours | Week 3 | Claim UI, API, localStorage tracking |
| **Monitoring & Adjustment** | - | Week 3-4 | User feedback, bug fixes |
| **Phase 3: Auth Required** | 8 hours | Week 5 | Feature flag flip, migration |
| **Phase 4: Hardening** | 7 hours | Week 6+ | OAuth, optimization, cleanup |

**Total Duration**: 6+ weeks (part-time) or 2-3 weeks (full-time)

### 10.3 Success Metrics

**Phase 1 Metrics**:
- [ ] Auth success rate > 90% (of users who attempt sign-in)
- [ ] Session persistence > 95% (after page reload)
- [ ] Zero critical bugs reported
- [ ] API latency increase < 100ms

**Phase 2 Metrics**:
- [ ] Claim success rate > 70% (of eligible users)
- [ ] Data integrity: zero lost profiles/charts
- [ ] Email delivery rate > 95%

**Phase 3 Metrics**:
- [ ] Authenticated user conversion > 80% (of new visitors)
- [ ] RLS policy violations: 0
- [ ] User-reported auth issues < 5 tickets/week

**Phase 4 Metrics**:
- [ ] OAuth sign-in adoption > 40% (if implemented)
- [ ] Anonymous profiles remaining < 1% of total
- [ ] Security audit passed with no critical findings

---

## 11. Post-Launch Considerations

### 11.1 Monitoring & Alerts

**Metrics to Track**:
- Auth success rate (sign-up, sign-in)
- Session duration and persistence
- API error rate (401 Unauthorized)
- RLS policy violations (Supabase logs)
- Magic link email delivery rate
- Claim flow conversion rate

**Alert Thresholds**:
- Auth success rate < 80% → PagerDuty alert
- API 401 error rate > 10% → Slack notification
- Email delivery rate < 90% → Email admin
- RLS violations > 0 → Immediate security review

### 11.2 Documentation Updates

**Update README.md**:
- Add authentication setup instructions
- Document environment variables (feature flags)
- Update Quick Start guide with sign-in step

**Update API Documentation**:
- Add bearer token requirement to all protected endpoints
- Document 401 Unauthorized error responses
- Add claim API endpoint documentation

**Create User Guides**:
- "How to Sign In" (with screenshots)
- "How to Claim Your Data" (for migration)
- "Troubleshooting: Magic Link Not Received"

### 11.3 Support Preparation

**Common Issues & Responses**:
- **Issue**: Magic link not received  
  **Response**: Check spam folder, whitelist noreply@supabase.io, try different email
  
- **Issue**: Cannot access old data  
  **Response**: Check localStorage for profile IDs, use claim flow before deadline
  
- **Issue**: Sign-out not working  
  **Response**: Clear cookies/cache, verify Supabase session cleared

**Support Ticket Templates**:
- Auth issue escalation
- Data migration assistance
- Account recovery (lost email access)

### 11.4 Future Enhancements

**Short-term (1-3 months)**:
- [ ] Add OAuth providers (Google, GitHub)
- [ ] Implement "Remember Me" option
- [ ] Add profile picture upload
- [ ] Email notifications for job completion

**Medium-term (3-6 months)**:
- [ ] Two-factor authentication (2FA)
- [ ] Account settings page (change email, delete account)
- [ ] Shared charts (public links)
- [ ] Team/family accounts

**Long-term (6+ months)**:
- [ ] Mobile app with native auth
- [ ] SSO for enterprise customers
- [ ] Advanced RBAC (admin, user, guest roles)

---

## 12. Conclusion

This plan provides a comprehensive roadmap for migrating Eastern Destiny from anonymous MVP authentication to a production-ready Supabase Auth implementation. The phased approach minimizes risk while maximizing user experience and data preservation.

**Key Takeaways**:
1. **Gradual rollout** with feature flags ensures minimal disruption
2. **Claim flow** preserves user data during migration
3. **RLS policies** already in place, just need enforcement
4. **Worker unchanged** (continues using service role)
5. **Timeline**: 6 weeks part-time or 2-3 weeks full-time
6. **Estimated effort**: ~53 hours of development

**Next Steps**:
1. Review and approve this plan with stakeholders
2. Prioritize phases based on business needs
3. Set up staging environment for testing
4. Begin Phase 1 development
5. Schedule security audit for Phase 3

**Decision Required**:
- [ ] Approve migration approach (Session-Based Claim Flow)
- [ ] Set claim window deadline (recommended: 30 days)
- [ ] Choose Phase 3 start date (coordinate with marketing)
- [ ] Allocate development resources (1 developer, 6 weeks)

---

**Document Status**: ✅ Planning Complete  
**Next Review**: After Phase 1 deployment  
**Owner**: Engineering Team  
**Last Updated**: 2024-11-04
