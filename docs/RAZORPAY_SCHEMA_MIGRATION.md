# Razorpay Payment Schema Migration

## Overview
This migration adds Razorpay payment identifiers to the database schema while preserving legacy Stripe data for backward compatibility during the migration period.

## Migration Details

### File: `20241106000003_add_razorpay_columns.sql`

#### Changes Made

1. **New Columns Added to `lamps` table:**
   - `razorpay_payment_link_id` (TEXT, NULLABLE) - For pending payment links
   - `razorpay_payment_id` (TEXT, NULLABLE) - For completed payments

2. **Legacy Data Preservation:**
   - Existing `checkout_session_id` column remains intact
   - Legacy Stripe data is copied to `razorpay_payment_link_id` for reference
   - Updated column comments to mark Stripe as deprecated

3. **Indexes Created:**
   - `idx_lamps_razorpay_payment_link_id` - For webhook lookups
   - `idx_lamps_razorpay_payment_id` - For payment confirmation lookups

4. **Documentation Updates:**
   - Column comments describe usage patterns
   - `jobs.metadata` comment updated to reflect Razorpay transition

#### Schema Impact

**Before:**
```sql
lamps (
  id UUID,
  lamp_key TEXT UNIQUE,
  status TEXT CHECK (status IN ('unlit', 'lit')),
  checkout_session_id TEXT NULL,  -- Stripe only
  ...
)
```

**After:**
```sql
lamps (
  id UUID,
  lamp_key TEXT UNIQUE,
  status TEXT CHECK (status IN ('unlit', 'lit')),
  checkout_session_id TEXT NULL,        -- LEGACY: Stripe
  razorpay_payment_link_id TEXT NULL,    -- NEW: Razorpay pending
  razorpay_payment_id TEXT NULL,         -- NEW: Razorpay completed
  ...
)
```

## Usage Patterns

### New Razorpay Workflow
1. **Payment Initiation:** Store `razorpay_payment_link_id` when creating payment link
2. **Payment Completion:** Store `razorpay_payment_id` when webhook confirms payment
3. **Query Patterns:** Use new indexes for efficient webhook processing

### Legacy Support
1. **Existing Data:** All Stripe `checkout_session_id` values preserved
2. **Backward Compatibility:** Existing code continues to work
3. **Migration Path:** Legacy data copied to new column for reference

## API Impact

### Current State
- All Stripe API endpoints are already commented out with TODOs
- No breaking changes to existing functionality
- Migration safe to deploy

### Future Updates (Separate Tickets)
- Update `/api/lamps/checkout` to use `razorpay_payment_link_id`
- Update `/api/stripe/webhook` → `/api/razorpay/webhook` 
- Update `/api/reports/generate` to use Razorpay
- Update `jobs.metadata` structure

## Testing

### Test Script: `99_test_razorpay_migration.sql`

Run this script in Supabase SQL Editor after migration to verify:

1. ✅ Lamps table exists
2. ✅ New Razorpay columns added with correct types
3. ✅ Legacy Stripe column still exists  
4. ✅ New indexes created
5. ✅ Column comments properly set
6. ✅ Jobs metadata comment updated
7. ✅ Data migration verification (if applicable)

## Rollback Plan

If rollback is needed:
1. No data loss - legacy Stripe data preserved
2. New columns can be safely dropped: `ALTER TABLE lamps DROP COLUMN razorpay_payment_link_id, DROP COLUMN razorpay_payment_id;`
3. New indexes can be safely dropped
4. Column comments can be reverted

## Next Steps

1. **Deploy this migration** to production Supabase
2. **Run test script** to verify successful migration
3. **Proceed with API migration** tickets to implement Razorpay functionality
4. **Monitor legacy data** and plan eventual Stripe deprecation

## Notes

- Migration is designed to be zero-downtime
- All changes are backward compatible
- Existing functionality remains intact
- New Razorpay columns are optional (NULLABLE)
- Legacy data preservation ensures smooth transition period