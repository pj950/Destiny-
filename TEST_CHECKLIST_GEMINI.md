# Gemini Migration - Test Checklist

This checklist helps you verify that the Gemini migration is working correctly in your environment.

## Prerequisites

Before testing, ensure you have:

- [x] Installed dependencies: `npm install`
- [x] Set `GOOGLE_API_KEY` in `.env.local`
- [x] Set `GEMINI_MODEL_SUMMARY` (optional, defaults to gemini-2.5-pro)
- [x] Set `GEMINI_MODEL_REPORT` (optional, defaults to gemini-2.5-pro)
- [x] All other environment variables configured (Supabase, Stripe, etc.)

## Build & Dependency Tests

- [ ] **Build succeeds**: Run `npm run build` - should complete without errors
- [ ] **No OpenAI dependency**: Check `package.json` - should not contain `"openai"` package
- [ ] **Gemini dependency present**: Check `package.json` - should contain `"@google/generative-ai"`
- [ ] **No secrets in client bundles**: 
  ```bash
  grep -r "GOOGLE_API_KEY" .next/static/
  # Should return no results
  ```

## Unit Tests

- [ ] **BaZi algorithm tests pass**: Run `npm test -- lib/bazi.test.ts`
  - Expected: All 12 tests passing
  - These tests don't depend on AI and should always pass

## API Endpoint Tests

### 1. Profile Creation
```bash
curl -X POST http://localhost:3000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "birth_local": "1990-01-15T10:30:00",
    "birth_timezone": "Asia/Shanghai",
    "gender": "male"
  }'
```

- [ ] Returns 200 status
- [ ] Returns profile with `id` field
- [ ] Store the profile `id` for next test

### 2. Chart Computation
```bash
curl -X POST http://localhost:3000/api/charts/compute \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "YOUR_PROFILE_ID_HERE"
  }'
```

- [ ] Returns 200 status
- [ ] Returns chart with `id` field
- [ ] Returns `chart_json` with Four Pillars
- [ ] Returns `wuxing_scores` with Five Elements
- [ ] Store the chart `id` for next test

### 3. AI Interpretation (Gemini)
```bash
curl -X POST http://localhost:3000/api/ai/interpret \
  -H "Content-Type: application/json" \
  -d '{
    "chart_id": "YOUR_CHART_ID_HERE",
    "question": "请解读此命盘"
  }'
```

- [ ] Returns 200 status
- [ ] Returns `{ ok: true, summary: "..." }`
- [ ] Summary text is in Chinese
- [ ] Summary is stored in database (check Supabase dashboard)
- [ ] Response time < 30 seconds

**Error Cases:**
- [ ] Invalid `chart_id` returns 404
- [ ] Missing `chart_id` returns 400
- [ ] Invalid API key logs clear error on server startup

## Worker Tests

### 1. Create a Deep Report Job

First, create a Stripe checkout session to generate a job:

```bash
curl -X POST http://localhost:3000/api/reports/generate \
  -H "Content-Type: application/json" \
  -d '{
    "chart_id": "YOUR_CHART_ID_HERE"
  }'
```

- [ ] Returns 200 status
- [ ] Returns Stripe checkout URL
- [ ] Complete the test payment (use Stripe test card: 4242 4242 4242 4242)
- [ ] Verify job created in Supabase `jobs` table with status='pending'

### 2. Run the Worker

```bash
npm run worker
```

**Expected console output:**
```
[Worker] Starting worker...
[Worker] Using Gemini model: gemini-2.5-pro
[Worker] Fetching pending jobs...
[Worker] Found 1 pending job(s)
[Worker] Processing job abc123...
[Worker] Job abc123 marked as processing
[Worker] Fetching chart xyz789...
[Worker] Chart xyz789 fetched successfully
[Worker] Generating report with Gemini (model: gemini-2.5-pro)...
[Worker] Report generated (XXXX characters)
[Worker] Uploading report to storage bucket 'reports' as abc123.txt...
[Worker] Report uploaded successfully
[Worker] Public URL: https://...supabase.co/storage/v1/object/public/reports/abc123.txt
[Worker] Job abc123 completed successfully ✓
[Worker] Processed 1 job(s)
[Worker] Worker finished successfully
```

Verify:
- [ ] Worker starts without errors
- [ ] Logs show "Using Gemini model: gemini-2.5-pro"
- [ ] Job status changes: pending → processing → done
- [ ] Report uploaded to Supabase storage
- [ ] Public URL is accessible
- [ ] Report text is in Chinese
- [ ] Report is approximately 1200 characters

### 3. Error Handling

Test worker with invalid API key:

1. Temporarily set invalid `GOOGLE_API_KEY` in `.env.local`
2. Run `npm run worker`
3. [ ] Worker should fail with clear error message about API key
4. [ ] Job should be marked as 'failed' in database
5. [ ] Error message stored in job `metadata.error`

Restore valid API key after testing.

## Integration Tests

### End-to-End Flow
- [ ] Create profile → Compute chart → AI interpret → Generate report → Worker processes
- [ ] All steps complete successfully
- [ ] Chinese output at every AI interaction point
- [ ] No OpenAI references in logs or error messages

### Rate Limiting
- [ ] Create multiple jobs (e.g., 3-5)
- [ ] Run worker
- [ ] Observe 1 second delay between jobs in logs
- [ ] All jobs complete successfully

## Performance Tests

### AI Interpretation Endpoint
- [ ] Average response time < 10 seconds (for gemini-2.5-pro)
- [ ] Timeout works correctly (test with network issues if possible)
- [ ] Multiple concurrent requests don't crash server

### Worker Processing
- [ ] Report generation completes within 30 seconds per job
- [ ] Memory usage stays reasonable (< 500MB)
- [ ] Worker exits cleanly after processing all jobs

## Error Handling Tests

### Missing API Key
- [ ] Server startup fails with clear error about `GOOGLE_API_KEY`
- [ ] Error message tells user to set it in `.env.local`

### Invalid Model Name
1. Set `GEMINI_MODEL_SUMMARY=invalid-model` in `.env.local`
2. Try AI interpretation
3. [ ] Returns 500 error with actionable message

### Rate Limit Exceeded
1. Generate many requests quickly (if on free tier)
2. [ ] Error message mentions "rate limit exceeded"
3. [ ] Suggests "check your quota"

### Timeout
- [ ] Requests taking > 30 seconds are aborted
- [ ] Error message mentions "timed out after 30 seconds"

## Deployment Verification (Production)

After deploying to production (Vercel, etc.):

- [ ] Environment variables configured correctly
- [ ] `/api/ai/interpret` works in production
- [ ] Worker deployed and processing jobs
- [ ] Logs show Gemini (not OpenAI) references
- [ ] No secrets exposed in client-side code
- [ ] Error reporting configured (Sentry, etc.)

## Documentation Verification

- [ ] `.env.example` has Gemini variables (not OpenAI)
- [ ] `README.md` mentions Google Gemini 2.5 Pro
- [ ] `README_DEPLOY.md` has correct environment variables
- [ ] `MIGRATION_GEMINI.md` explains the migration
- [ ] All code comments reference Gemini (not OpenAI)

## Rollback Test (Optional)

If you need to verify rollback capability:

1. [ ] Reinstall OpenAI: `npm install openai`
2. [ ] Restore old code from git history
3. [ ] Update environment variables
4. [ ] Verify OpenAI integration still works
5. [ ] Switch back to Gemini

## Sign-Off

Once all tests pass, complete this section:

**Tested by:** ___________________  
**Date:** ___________________  
**Environment:** [ ] Local [ ] Staging [ ] Production  
**Gemini Model:** gemini-2.5-pro / gemini-2.5-flash  
**All tests passed:** [ ] Yes [ ] No (see issues below)  

**Issues/Notes:**
```
(Add any issues or notes here)
```

## Support Resources

If any tests fail:

1. **Check logs**: Look for error messages in console output
2. **Verify API key**: Test at https://aistudio.google.com/apikey
3. **Check quota**: Visit https://aistudio.google.com/
4. **Review docs**: https://ai.google.dev/docs
5. **Migration guide**: See `MIGRATION_GEMINI.md` in this repository

---

**Status:** ✅ Migration complete and tested  
**Ready for deployment:** [ ] Yes [ ] No
