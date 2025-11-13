# Fix: lamp_id Handling in Checkout Flow

## Problem Statement

The lamp purchase flow had an issue where placeholder UUIDs (e.g., `00000000-0000-0000-0000-27b9ddc60000`) were being sent to the backend instead of real UUIDs. This caused:

1. Backend checkout API to fail with 404 errors
2. Lamps never being marked as "lit" after payment
3. No way to track lamp purchases in the database

## Root Cause

The `getLampsConfig()` function in `lib/lamps.config.ts` was using a fallback logic that generated placeholder UUIDs when:
- The database query returned results but the UUID mapping failed
- Or when fallback logic kicked in to scan image files

These placeholder UUIDs didn't exist in the database, so when the frontend sent them to the checkout API, the query `WHERE id = placeholder_uuid` would return no results.

## Solution Overview

The fix involves three main components:

### 1. Database Layer: Ensure Real UUIDs Exist

**Files Created:**
- `supabase/migrations/20251113135204_regenerate_lamps_with_proper_uuids.sql`
- `supabase/migrations/20251113135205_add_webhook_tracking_to_lamps.sql`

**Changes:**
- Regenerated all lamps with real, auto-generated UUIDs (not placeholders)
- Added `last_webhook_event_id` column for idempotent webhook processing
- Ensured consistency between database records and API responses

### 2. Backend: Reliable UUID Retrieval & Validation

**File Modified:** `lib/lamps.config.ts`

**Changes to `getLampsConfig()`:**
- Prioritizes fetching lamps directly from database (primary source of truth)
- Returns database lamps with real UUIDs instead of scanning files
- Added comprehensive logging to track UUID retrieval
- Only falls back to file scanning if database lamps unavailable
- Warns when placeholder UUIDs are being used

**File Modified:** `pages/api/lamps/checkout.ts`

**Enhanced Validation:**
- Detects placeholder UUIDs being sent and logs diagnostic errors
- Better error handling with specific HTTP status codes:
  - 400: Invalid lamp_id format
  - 403: Permission denied
  - 404: Lamp not found in database
  - 500: Database error
- Logs successful lamp lookup and database updates
- Provides helpful error messages to guide debugging

### 3. Frontend: Prevent Invalid UUIDs

**File Modified:** `pages/lamps.tsx`

**Validation Added:**
- Validates `lamp.id` exists and is a string before sending
- Detects and rejects placeholder UUIDs with user-friendly error messages
- Logs all lamp UUIDs on load with warnings for placeholders
- Comprehensive error logging for debugging purchase flow

## Data Flow After Fix

```
1. User loads lamps page
   ↓
2. Frontend calls /api/lamps/config
   ↓
3. Config API queries database lamps table
   ↓
4. Database returns lamps with real UUIDs (from migration)
   ↓
5. Frontend receives real UUIDs
   ↓
6. Frontend validates UUIDs (rejects placeholders)
   ↓
7. User clicks "点亮" button
   ↓
8. Frontend sends real UUID to /api/lamps/checkout
   ↓
9. Backend queries: SELECT * FROM lamps WHERE id = real_uuid
   ↓
10. Lamp found! Backend creates Stripe checkout session
    ↓
11. Backend updates lamp with checkout_session_id
    ↓
12. Frontend redirects to Stripe checkout
    ↓
13. User completes payment
    ↓
14. Stripe sends webhook event
    ↓
15. Webhook handler finds lamp by checkout_session_id
    ↓
16. Webhook marks lamp as "lit" with idempotency tracking
    ↓
17. Frontend refreshes and shows updated lamp status ✓
```

## Changes Summary

### Database Migrations
1. **`20251113135204_regenerate_lamps_with_proper_uuids.sql`**
   - Deletes all existing lamps
   - Recreates all 34 lamps with proper auto-generated UUIDs
   - Ensures no duplicate lamp_keys

2. **`20251113135205_add_webhook_tracking_to_lamps.sql`**
   - Adds `last_webhook_event_id` TEXT NULL column
   - Adds index for webhook event tracking
   - Enables idempotent webhook processing

### Backend Changes

#### `lib/lamps.config.ts`
```typescript
// Before: Used fallback logic, generated placeholder UUIDs
// After:  Prioritizes database, returns real UUIDs
- Only generates placeholders as fallback
+ Queries database first, uses real UUIDs as primary source
+ Logs UUID retrieval for debugging
+ Warns if placeholders are used
```

#### `pages/api/lamps/checkout.ts`
```typescript
// Before: Basic validation, minimal logging
// After:  Comprehensive validation and error handling
+ Detects placeholder UUIDs
+ Better error handling with specific status codes
+ Detailed logging for each step
+ User-friendly error messages
```

### Frontend Changes

#### `pages/lamps.tsx`
```typescript
// Before: Sent lamp.id directly without validation
// After:  Validates before sending, logs for debugging
+ Validates lamp.id exists and is string
+ Detects placeholder UUIDs
+ Logs all lamp UUIDs on load
+ Comprehensive error messages
```

## Validation Steps

### Testing the Fix

1. **Verify Database**
   ```sql
   SELECT id, lamp_key, status FROM lamps ORDER BY lamp_key;
   -- All ids should be real UUIDs (NOT starting with 00000000-0000-0000-0000-)
   ```

2. **Check Frontend Logs**
   - Open browser console
   - Load lamps page
   - Look for log messages like: `[Lamps] Lamp "平安灯" has real UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - NO warnings like: `[Lamps] WARNING: Placeholder UUID`

3. **Test Checkout Flow**
   - Load lamps page
   - Click "点亮" on any lamp
   - Check browser console for: `[Lamps] Sending checkout request with lamp_id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - Check that it redirects to Stripe checkout (not 404 error)
   - Complete test payment
   - Verify lamp shows as "已点" after payment

4. **Monitor API Logs**
   - Check `/api/lamps/checkout` logs for:
     - `[Lamp Checkout] Found lamp: {name} (id: {uuid}, status: {status})`
     - `[Lamp Checkout] Successfully updated lamp {uuid} with checkout session {session_id}`
   - NO errors like: `[Lamp Checkout] Lamp not found in database`

## Error Resolution Guide

### Issue: "Placeholder UUID received instead of real UUID"
**Cause:** Database migration hasn't been applied
**Solution:** Run migrations: `npm run db:push`

### Issue: "Lamp not found" 404 error in checkout
**Cause 1:** Frontend is sending placeholder UUID
**Solution:** Verify `[Lamps]` console logs show real UUIDs, not placeholders

**Cause 2:** Database was modified or corrupted
**Solution:** Re-run migration `20251113135204_regenerate_lamps_with_proper_uuids.sql`

### Issue: Webhook not updating lamp status
**Cause:** Lamp record has no `checkout_session_id`
**Solution:** Verify checkout API successfully updated lamp (check logs for "Successfully updated lamp")

## Code Quality Metrics

### Logging Coverage
- ✅ Frontend: Logs lamp_id before sending, validates UUIDs
- ✅ Backend: Logs lamp lookup, database updates, errors
- ✅ Webhook: Logs lamp purchase processing (existing)

### Error Handling
- ✅ 400: Invalid input validation
- ✅ 403: Permission denied (RLS)
- ✅ 404: Resource not found with guidance
- ✅ 500: Server errors with context

### Validation Layers
- ✅ Frontend: Client-side UUID validation
- ✅ Backend API: Server-side UUID validation
- ✅ Database: Type checking and uniqueness constraints
- ✅ Webhook: Idempotency via event ID tracking

## Future Improvements

1. **Add UUID validation library** - Use a proper UUID validation package instead of regex
2. **Migrate fallback lamp configuration** - Sunset file-based lamp scanning once database is stable
3. **Add monitoring** - Track placeholder UUID occurrences to catch configuration issues early
4. **Add integration tests** - Test full checkout flow from frontend to webhook processing
5. **Add database health checks** - Verify all lamps have real UUIDs periodically

## Conclusion

This fix ensures:
1. ✅ Frontend gets real UUIDs from backend
2. ✅ Frontend validates UUIDs before sending
3. ✅ Backend can find lamps by UUID
4. ✅ Purchase information is correctly saved
5. ✅ Webhook can process payments and update lamp status
6. ✅ Users see updated lamp status after payment

The issue is now resolved with comprehensive logging to catch any future UUID-related issues early.
