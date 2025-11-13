# Quick Migration Guide - Fortunes RLS Fix

## 🎯 Quick Summary

This migration fixes the "permission denied for table fortunes" error in the Daily Fortune feature.

## 📝 What to Do

### Step 1: Access Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on **SQL Editor** in the left sidebar

### Step 2: Run the Migration

1. Click **New Query** button
2. Copy and paste the entire content from:
   ```
   supabase/migrations/20251112000001_fix_fortunes_rls_policies.sql
   ```
3. Click **Run** (or press `Ctrl+Enter`)

### Step 3: Verify Success

Run this query to check the policies:

```sql
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'fortunes';
```

**Expected Output:**

| policyname | cmd | qual |
|------------|-----|------|
| Allow users to view their own fortunes | SELECT | (user_id = auth.uid()) OR (user_id IS NULL) |
| Allow anonymous fortune inserts | INSERT | (user_id IS NULL) AND (session_id IS NOT NULL) |

### Step 4: Test the Feature

1. Visit your application
2. Go to `/fortune` page
3. Select a category (e.g., "事业运")
4. Draw a fortune
5. Verify it displays without errors ✅

## 🔍 Troubleshooting

### If you see "policy already exists" error:
- The migration might have already been applied
- Check existing policies with the verification query above

### If you still get permission errors:
1. Check that your `.env.local` has correct `SUPABASE_SERVICE_ROLE_KEY`
2. Verify the API endpoints are using `supabaseService` (not `supabase`)
3. Check console for any other errors

### If fortune draws don't work:
1. Check browser console for errors
2. Verify API endpoints return 200:
   - `GET /api/fortune/today`
   - `POST /api/fortune/draw`
3. Check Supabase logs in the dashboard

## 📚 More Information

- **Technical Details**: See `docs/FORTUNES_RLS_FIX.md`
- **Chinese Summary**: See `FORTUNES_RLS_FIX_SUMMARY.md`
- **Migration File**: `supabase/migrations/20251112000001_fix_fortunes_rls_policies.sql`

## ✅ Success Criteria

After applying the migration:
- ✅ No "permission denied" errors
- ✅ Users can draw daily fortunes
- ✅ Fortunes display correctly
- ✅ No console errors

---

**Need Help?** Check the documentation files or contact the development team.
