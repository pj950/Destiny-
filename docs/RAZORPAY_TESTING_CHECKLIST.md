# Razorpay Integration Testing Checklist

This document provides a comprehensive testing guide for the Razorpay payment integration, covering local development, Vercel deployment, and production verification.

## Prerequisites

Before testing, ensure you have:
- ✅ Razorpay account (sign up at [razorpay.com](https://razorpay.com))
- ✅ Test API keys from Razorpay Dashboard
- ✅ Webhook secret configured
- ✅ Supabase project with migrations applied
- ✅ Next.js development environment set up

## Environment Setup

### 1. Get Razorpay Credentials

1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Navigate to **Settings** > **API Keys**
3. Generate **Test Mode** API keys:
   - **Key ID**: `rzp_test_...`
   - **Key Secret**: `...` (click to reveal)
4. Save these credentials securely

### 2. Configure Webhook Secret

1. In Razorpay Dashboard, go to **Settings** > **Webhooks**
2. Click **Create New Webhook**
3. For local testing:
   - **Webhook URL**: `https://your-ngrok-url.ngrok.io/api/razorpay/webhook`
   - **Secret**: Generate a strong secret (save this)
   - **Events**: Select `payment_link.paid`
4. For Vercel deployment:
   - **Webhook URL**: `https://your-app.vercel.app/api/razorpay/webhook`
   - Use the same webhook secret

### 3. Set Environment Variables

Create `.env.local` (or configure in Vercel):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Google Gemini
GOOGLE_API_KEY=AIzaSy...
GEMINI_MODEL_SUMMARY=gemini-2.5-pro
GEMINI_MODEL_REPORT=gemini-2.5-pro

# Razorpay (Test Mode)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_test_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # or your Vercel URL
```

## Local Development Testing

### 1. Run Automated Tests

```bash
# Run all tests (278+ tests including payment tests)
npm test

# Run payment tests specifically
npm test pages/api/lamps/checkout.test.ts
npm test pages/api/reports/generate.test.ts
npm test pages/api/razorpay/webhook.test.ts
npm test lib/razorpay.test.ts

# Run tests in watch mode
npm run test:watch
```

**Expected Result**: All 278+ tests pass, including 138 payment-related tests.

### 2. Start Development Server

```bash
npm run dev
# Server should start on http://localhost:3000
```

### 3. Set Up ngrok (for webhook testing)

```bash
# Install ngrok (if not already installed)
# Visit https://ngrok.com/ for installation instructions

# Start ngrok tunnel
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update Razorpay webhook URL in dashboard with: https://abc123.ngrok.io/api/razorpay/webhook
```

### 4. Test Prayer Lamps Checkout

1. Navigate to `http://localhost:3000/lamps`
2. Click "点亮" on any lamp (e.g., 福运灯)
3. **Expected**: Redirect to Razorpay payment page
4. **Verify**:
   - Amount shows $19.90
   - Description shows lamp name
   - Callback URL is set to `/lamps`
5. Complete test payment using Razorpay test card:
   - **Card Number**: `4111 1111 1111 1111`
   - **Expiry**: Any future date
   - **CVV**: Any 3 digits
6. **Expected**: Redirect back to `/lamps` with query params
7. **Verify**: Lamp status changes to "已点亮" (lit)
8. **Check Database**:
   ```sql
   SELECT lamp_key, status, razorpay_payment_link_id, razorpay_payment_id
   FROM lamps
   WHERE lamp_key = 'p1';
   ```
   - `status` should be `'lit'`
   - `razorpay_payment_id` should be populated

### 5. Test Report Generation Checkout

1. Create a BaZi chart:
   - Go to `http://localhost:3000/`
   - Enter birth details and submit
   - Note the `chart_id` from URL or console
2. Navigate to `http://localhost:3000/pricing`
3. Click "立即购买" on any pricing tier
4. **Expected**: Redirect to Razorpay payment page
5. **Verify**:
   - Amount shows $19.99
   - Description shows "Deep Destiny Report"
   - Callback URL is set to `/dashboard`
6. Complete test payment
7. **Expected**: Redirect to `/dashboard`
8. **Verify**: Job status shows "处理中" or "已完成"
9. **Check Database**:
   ```sql
   SELECT id, status, metadata->>'razorpay_payment_link_id' as payment_link_id,
          metadata->>'payment_confirmed' as payment_confirmed
   FROM jobs
   WHERE chart_id = 'your-chart-id';
   ```
   - `status` should be `'pending'` or `'done'`
   - `payment_confirmed` should be `true`

### 6. Test Webhook Handler

1. Trigger a payment_link.paid event (via test payment above)
2. Check ngrok logs:
   ```bash
   # In ngrok terminal, you should see:
   POST /api/razorpay/webhook   200 OK
   ```
3. Check Next.js server logs:
   ```
   [Razorpay Webhook] Received event: payment_link.paid
   [Razorpay Webhook] Processing lamp payment for lamp_key: p1
   [Razorpay Webhook] Lamp updated successfully
   ```
4. **Verify Idempotency**: Send the same webhook event again
   - **Expected**: 200 OK with message "Event already processed"
   - Database should not update again

### 7. Test Error Scenarios

#### Invalid Lamp Key
```bash
curl -X POST http://localhost:3000/api/lamps/checkout \
  -H "Content-Type: application/json" \
  -d '{"lamp_key": "invalid"}'

# Expected: 400 Bad Request with error message
```

#### Already Lit Lamp
1. Try to purchase a lamp that's already lit
2. **Expected**: 400 Bad Request with "Lamp already lit" message

#### Invalid Webhook Signature
```bash
curl -X POST http://localhost:3000/api/razorpay/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: invalid_signature" \
  -d '{"event": "payment_link.paid"}'

# Expected: 401 Unauthorized
```

## Vercel Deployment Testing

### 1. Deploy to Vercel

```bash
# Push code to GitHub
git add .
git commit -m "Razorpay integration complete"
git push origin main

# Deploy via Vercel Dashboard or CLI
vercel --prod
```

### 2. Configure Environment Variables in Vercel

1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Add all environment variables (see "Environment Setup" section above)
3. **Important**: Use your Vercel deployment URL for `NEXT_PUBLIC_SITE_URL`
4. Redeploy after adding variables

### 3. Update Razorpay Webhook URL

1. In Razorpay Dashboard, update webhook URL to:
   ```
   https://your-app.vercel.app/api/razorpay/webhook
   ```
2. Keep the same webhook secret

### 4. Test Production Flow

Repeat all tests from "Local Development Testing" section using your Vercel URL:
- Test lamp checkout and payment
- Test report generation and payment
- Verify webhook processing
- Check database updates

## Production Readiness Checklist

### Environment Variables
- [ ] `RAZORPAY_KEY_ID` set to **live** key (starts with `rzp_live_`)
- [ ] `RAZORPAY_KEY_SECRET` set to **live** secret
- [ ] `RAZORPAY_WEBHOOK_SECRET` configured in Razorpay Dashboard
- [ ] `NEXT_PUBLIC_SITE_URL` set to production domain
- [ ] All Supabase credentials configured
- [ ] `GOOGLE_API_KEY` configured

### Razorpay Dashboard
- [ ] Live mode enabled
- [ ] Payment links enabled
- [ ] Webhook configured with production URL
- [ ] Test payment successful in test mode
- [ ] Bank account verified for settlements

### Database
- [ ] All migrations applied (including `20241106000003_add_razorpay_columns.sql`)
- [ ] Indexes created for `razorpay_payment_link_id` and `razorpay_payment_id`
- [ ] Storage bucket `reports` configured
- [ ] RLS policies enabled

### API Endpoints
- [ ] `/api/lamps/checkout` returns valid payment links
- [ ] `/api/lamps/confirm` successfully updates lamp status
- [ ] `/api/reports/generate` creates jobs with payment links
- [ ] `/api/razorpay/webhook` processes events and updates database

### Frontend
- [ ] Lamp purchase flow works end-to-end
- [ ] Report purchase flow works end-to-end
- [ ] Success/error messages display correctly
- [ ] Redirect URLs work correctly

### Security
- [ ] Webhook signature verification enabled
- [ ] Service role key never exposed to client
- [ ] HTTPS enabled for all payment flows
- [ ] Environment variables secured

## Troubleshooting

### Payment Link Creation Fails

**Error**: `RAZORPAY_KEY_ID is not defined`

**Solution**: Ensure environment variables are set correctly:
```bash
# Check .env.local file exists
cat .env.local | grep RAZORPAY

# For Vercel, verify in Dashboard > Settings > Environment Variables
```

### Webhook Not Triggering

**Error**: Webhook events not received

**Solution**:
1. Verify webhook URL is correct in Razorpay Dashboard
2. Check ngrok is running (for local testing)
3. Verify webhook secret matches environment variable
4. Check Razorpay Dashboard > Webhooks > Logs for delivery status

### Signature Verification Fails

**Error**: `401 Unauthorized` from webhook endpoint

**Solution**:
1. Verify `RAZORPAY_WEBHOOK_SECRET` matches Razorpay Dashboard
2. Check webhook payload is not modified in transit
3. Ensure webhook secret is the same in all environments

### Database Updates Fail

**Error**: Lamp/job not updating after payment

**Solution**:
1. Check Supabase service role key is correct
2. Verify migrations are applied (check for new columns)
3. Check server logs for database errors
4. Verify webhook event contains correct metadata

### Redirect URLs Don't Work

**Error**: User not redirected after payment

**Solution**:
1. Verify `NEXT_PUBLIC_SITE_URL` is set correctly
2. Check payment link `callback_url` parameter
3. Ensure callback URL is HTTPS in production

## Support Resources

- **Razorpay Documentation**: [razorpay.com/docs](https://razorpay.com/docs)
- **Payment Links API**: [razorpay.com/docs/api/payment-links](https://razorpay.com/docs/api/payment-links)
- **Webhooks Guide**: [razorpay.com/docs/webhooks](https://razorpay.com/docs/webhooks)
- **Test Cards**: [razorpay.com/docs/payments/payments/test-card-details](https://razorpay.com/docs/payments/payments/test-card-details)

## Next Steps

After verifying all tests pass:
1. ✅ All automated tests pass (278+ tests)
2. ✅ Local development flow works end-to-end
3. ✅ Vercel deployment successful
4. ✅ Production checklist complete
5. ✅ Monitor production payments and webhooks
6. ✅ Set up alerts for webhook failures
7. ✅ Review Razorpay dashboard for payment analytics

---

**Last Updated**: 2024-11-08
