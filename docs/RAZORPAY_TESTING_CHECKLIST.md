# Razorpay Testing Checklist

This document provides a comprehensive testing checklist for Razorpay payment flows in Eastern Destiny.

---

## Table of Contents

1. [Environment Setup](#1-environment-setup)
2. [Test Environment](#2-test-environment)
3. [Payment Flow Testing](#3-payment-flow-testing)
4. [Webhook Testing](#4-webhook-testing)
5. [Error Handling Testing](#5-error-handling-testing)
6. [Production Verification](#6-production-verification)

---

## 1. Environment Setup

### Prerequisites
- [ ] Razorpay test account created at [razorpay.com](https://razorpay.com)
- [ ] Test API keys configured in `.env.local`:
  ```env
  RAZORPAY_KEY_ID=rzp_test_xxx
  RAZORPAY_KEY_SECRET=rzp_test_xxx
  RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
  ```
- [ ] Development server running: `pnpm dev`
- [ ] Supabase database accessible

### Test Data Preparation
- [ ] Test profile created in Supabase
- [ ] Test BaZi chart computed
- [ ] Chart ID available for testing

---

## 2. Test Environment

### Razorpay Dashboard Configuration
- [ ] Test mode enabled in Razorpay dashboard
- [ ] Webhook endpoint configured: `https://your-ngrok-url.ngrok.io/api/razorpay/webhook`
- [ ] Test events selected:
  - [x] `payment.captured`
  - [x] `payment.failed` (optional)
- [ ] Webhook secret copied to environment variables

### Local Testing Tools
- [ ] ngrok installed and running (for webhook testing)
- [ ] ngrok URL pointing to local server (port 3000)
- [ ] Webhook endpoint accessible via ngrok URL

---

## 3. Payment Flow Testing

### Deep Report Purchase Flow

#### 3.1 API Endpoint Testing
```bash
curl -X POST http://localhost:3000/api/reports/generate \
  -H "Content-Type: application/json" \
  -d '{
    "chart_id": "YOUR_CHART_ID_HERE"
  }'
```

- [ ] API returns 200 status
- [ ] Response contains Razorpay payment URL (`rzp.io/rzp/...`)
- [ ] Job created in Supabase `jobs` table with:
  - [ ] `status = 'pending'`
  - [ ] `job_type = 'deep_report'`
  - [ ] `razorpay_payment_link_id` in metadata
  - [ ] `payment_confirmed = false` (initially)

#### 3.2 Payment Completion
- [ ] User redirected to Razorpay checkout page
- [ ] Payment page loads correctly with product details
- [ ] Test payment method selected (card, UPI, net banking, etc.)
- [ ] Payment completed successfully using test credentials
- [ ] User redirected back to success URL

#### 3.3 Post-Payment Verification
- [ ] Webhook event received by `/api/razorpay/webhook`
- [ ] Job updated in database:
  - [ ] `status = 'pending'` (ready for worker)
  - [ ] `payment_confirmed = true`
  - [ ] `razorpay_payment_id` added to metadata
- [ ] Background worker processes job and generates report
- [ ] Job status changes to `done`
- [ ] `result_url` populated with report link

### Prayer Lamp Purchase Flow

#### 3.4 Lamp Purchase API
```bash
curl -X POST http://localhost:3000/api/lamps/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "lamp_key": "p1"
  }'
```

- [ ] API returns 200 status
- [ ] Response contains Razorpay payment URL
- [ ] Lamp record created/updated in `lamps` table

#### 3.5 Lamp Payment Completion
- [ ] Payment flow completed successfully
- [ ] Lamp status updated to `lit` in database
- [ ] Lamp displays as lit on frontend
- [ ] Lamp has glow/pulse animation effects

---

## 4. Webhook Testing

### 4.1 Signature Verification
- [ ] Webhook signature validation working
- [ ] Invalid signatures rejected with 401 status
- [ ] Valid signatures processed successfully

### 4.2 Event Processing
- [ ] `payment.captured` events processed correctly
- [ ] `payment.failed` events handled gracefully (if configured)
- [ ] Duplicate events ignored (idempotency working)
- [ ] Webhook responds quickly (under 5 seconds)

### 4.3 Error Scenarios
- [ ] Malformed webhook payloads rejected
- [ ] Missing required fields handled gracefully
- [ ] Database connection errors logged appropriately
- [ ] Webhook retry mechanism working (if applicable)

---

## 5. Error Handling Testing

### 5.1 Payment Failures
- [ ] Card declined scenarios handled
- [ ] Insufficient funds scenarios handled
- [ ] Network timeout scenarios handled
- [ ] User shown appropriate error messages
- [ ] Job status updated to `failed` with error details

### 5.2 API Error Handling
- [ ] Invalid chart_id returns 400 error
- [ ] Missing chart returns 404 error
- [ ] Invalid lamp_key returns 400 error
- [ ] Database errors return 500 with logging

### 5.3 Edge Cases
- [ ] Concurrent payments for same chart handled
- [ ] Payment after job already processed handled
- [ ] Webhook received before payment link created handled
- [ ] Currency mismatch scenarios handled

---

## 6. Production Verification

### 6.1 Live Environment Testing
- [ ] Production API keys configured (`rzp_live_...`)
- [ ] Production webhook endpoint configured
- [ ] HTTPS/SSL certificates valid
- [ ] Production domain accessible

### 6.2 Real Payment Testing
- [ ] Small real payment test completed (₹1-₹10)
- [ ] Payment confirmation email received
- [ ] Report generation completed successfully
- [ ] Funds appearing in Razorpay dashboard

### 6.3 Monitoring Setup
- [ ] Webhook event logs monitored
- [ ] Payment success/failure rates tracked
- [ ] Error alerts configured
- [ ] Database job status monitored

---

## Test Payment Methods

### Razorpay Test Cards
Use these test payment methods in Razorpay test mode:

#### Card Payments
- **Success**: `4111 1111 1111 1111` (any future expiry, any CVV)
- **Failure**: `4111 1111 1111 1110` (card declined)
- **International**: `4000 0000 0000 0002`

#### UPI Testing
- **Success**: Use test UPI ID: `test@razorpay`
- **Failure**: Use invalid UPI ID format

#### Net Banking
- **Success**: Select any test bank
- **Failure**: Choose bank with "failure" in name

---

## Common Issues & Solutions

### Issue: Webhook not received
**Solution**: 
1. Check ngrok is running and accessible
2. Verify webhook URL in Razorpay dashboard
3. Check webhook secret matches environment variable

### Issue: Payment not updating job status
**Solution**:
1. Check webhook logs for signature verification errors
2. Verify `razorpay_payment_link_id` matches job metadata
3. Check database connection and permissions

### Issue: Test payments failing
**Solution**:
1. Ensure Razorpay account is in test mode
2. Use valid test payment methods
3. Check currency settings (INR for test mode)

---

## Success Criteria

A Razorpay integration is considered ready for production when:

- [ ] All payment flows complete successfully
- [ ] Webhooks process events reliably
- [ ] Error scenarios handled gracefully
- [ ] Test payments work consistently
- [ ] Production environment verified
- [ ] Monitoring and logging in place
- [ ] Documentation updated with Razorpay-specific instructions

---

## Additional Resources

- [Razorpay Test Cards Documentation](https://razorpay.com/docs/payment-gateway/test-card-details)
- [Razorpay Webhook Guide](https://razorpay.com/docs/webhooks)
- [Razorpay API Reference](https://razorpay.com/docs/api)
- [Razorpay Dashboard](https://dashboard.razorpay.com/)