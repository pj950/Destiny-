# Stripe Payment Integration

This document describes the Stripe payment integration for the subscription system, which replaced the previous Razorpay integration.

## Overview

The subscription system now uses Stripe Checkout for one-time payments. Users purchase subscription tiers (Basic, Premium, VIP) through Stripe's hosted checkout page, and webhooks handle payment confirmations and subscription updates.

## Architecture

### Payment Flow

```
1. User selects a subscription plan (e.g., Basic Monthly)
2. Frontend calls `/api/subscriptions/checkout`
3. Backend creates a Stripe Checkout Session
4. User redirected to Stripe Checkout page
5. User completes payment (test card: 4242 4242 4242 4242)
6. Stripe sends webhook to `/api/stripe/webhook`
7. Backend updates user subscription in database
8. User redirected to `/checkout/success`
```

### Components

#### 1. Stripe Client (`lib/stripe.ts`)
- Singleton Stripe instance
- Helper functions for checkout, subscriptions, webhooks
- Server-side only (throws error if used client-side)

#### 2. Checkout API (`pages/api/subscriptions/checkout.ts`)
- Creates Stripe Checkout Session
- Maps plan IDs to Stripe Price IDs
- Returns checkout URL
- Handles success/cancel redirects

#### 3. Webhook Handler (`pages/api/stripe/webhook.ts`)
- Verifies webhook signatures
- Handles events:
  - `checkout.session.completed` - Payment success
  - `customer.subscription.updated` - Subscription changes
  - `customer.subscription.deleted` - Cancellation
  - `invoice.payment_failed` - Payment failures
- Updates database with idempotency checks

#### 4. Cancel API (`pages/api/subscriptions/cancel.ts`)
- Cancels subscription in Stripe (if applicable)
- Updates database status
- Supports "cancel at end of period" or immediate cancellation

#### 5. Success/Cancel Pages
- `/pages/checkout/success.tsx` - Payment success confirmation
- `/pages/checkout/cancel.tsx` - Payment cancellation handling

## Database Schema

### New Columns in `user_subscriptions`

```sql
-- Stripe-specific columns
stripe_customer_id TEXT NULL           -- Stripe customer ID
stripe_subscription_id TEXT NULL       -- Stripe subscription ID (for recurring)
external_payment_id TEXT NULL          -- Stripe Payment Intent or Session ID

-- Existing columns (reused)
external_subscription_id TEXT          -- Can store Stripe subscription ID
payment_method TEXT                    -- Set to 'stripe'
metadata JSONB                         -- Stores webhook event IDs, etc.
```

See migration: `supabase/migrations/20241225000001_add_stripe_columns.sql`

## Configuration

### Environment Variables

Required environment variables (set in `.env.local` and Vercel):

```bash
# Stripe API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx  # Public key (client-side)
STRIPE_SECRET_KEY=sk_test_xxx                   # Secret key (server-side)
STRIPE_WEBHOOK_SECRET=whsec_xxx                 # Webhook signing secret

# Stripe Price IDs (from Stripe Dashboard)
STRIPE_PRICE_BASIC_MONTHLY=price_xxx
STRIPE_PRICE_BASIC_YEARLY=price_xxx
STRIPE_PRICE_PREMIUM_MONTHLY=price_xxx
STRIPE_PRICE_PREMIUM_YEARLY=price_xxx
STRIPE_PRICE_VIP_MONTHLY=price_xxx
STRIPE_PRICE_VIP_YEARLY=price_xxx

# Application URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Stripe Dashboard Setup

#### 1. Create Products and Prices

In Stripe Dashboard → Products:

**Basic Plan**
- Product Name: "Basic Subscription"
- Monthly Price: ₹299 (29900 paise)
- Yearly Price: ₹2,999 (299900 paise)
- Copy Price IDs to env vars

**Premium Plan**
- Product Name: "Premium Subscription"
- Monthly Price: ₹699 (69900 paise)
- Yearly Price: ₹6,999 (699900 paise)
- Copy Price IDs to env vars

**VIP Plan**
- Product Name: "VIP Subscription"
- Monthly Price: ₹1,499 (149900 paise)
- Yearly Price: ₹14,999 (1499900 paise)
- Copy Price IDs to env vars

#### 2. Configure Webhook

In Stripe Dashboard → Developers → Webhooks:

1. Add endpoint: `https://your-domain.com/api/stripe/webhook`
2. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
3. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

## Testing

### Test Card Numbers

Use these test cards in sandbox mode:

- **Success**: `4242 4242 4242 4242`
- **Requires Authentication**: `4000 0025 0000 3155`
- **Declined**: `4000 0000 0000 0002`
- **Expiry**: Any future date (e.g., 12/25)
- **CVC**: Any 3 digits (e.g., 123)

### Testing Webhooks Locally

Use Stripe CLI to forward webhooks to localhost:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy webhook signing secret to .env.local
```

### Test Flow

1. Start dev server: `npm run dev`
2. Navigate to `/pricing`
3. Click "Upgrade" on a plan
4. Complete checkout with test card
5. Verify redirect to `/checkout/success`
6. Check database for updated subscription

## API Endpoints

### POST `/api/subscriptions/checkout`

Create a Stripe Checkout Session.

**Request:**
```json
{
  "plan_id": "basic",
  "billing_cycle": "monthly",
  "user_id": "user-uuid",
  "customer_email": "user@example.com"
}
```

**Response:**
```json
{
  "ok": true,
  "url": "https://checkout.stripe.com/pay/...",
  "session_id": "cs_test_..."
}
```

### POST `/api/stripe/webhook`

Handle Stripe webhook events.

**Headers:**
- `stripe-signature`: Webhook signature for verification

**Events Handled:**
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

### POST `/api/subscriptions/cancel`

Cancel a subscription.

**Request:**
```json
{
  "cancel_at_end": true
}
```

**Query:**
- `user_id`: User UUID

**Response:**
```json
{
  "ok": true,
  "message": "Subscription will be canceled at the end of current period"
}
```

## Security

### Webhook Verification

All webhooks are verified using Stripe's signature verification:

```typescript
const event = stripeHelpers.verifyWebhookSignature(
  rawBody,
  signature,
  webhookSecret
)
```

This prevents unauthorized webhook requests.

### Idempotency

Webhook events are processed idempotently using `last_webhook_event_id` in subscription metadata. This prevents duplicate processing if Stripe retries webhooks.

### Service Role Access

API endpoints use Supabase service role to bypass RLS policies, ensuring proper access control.

## Migration from Razorpay

### Changes Made

1. ✅ Replaced `lib/razorpay.ts` with `lib/stripe.ts`
2. ✅ Updated `/api/subscriptions/checkout` to use Stripe
3. ✅ Replaced `/api/razorpay/webhook` with `/api/stripe/webhook`
4. ✅ Updated `/api/subscriptions/cancel` to handle Stripe
5. ✅ Added database columns for Stripe data
6. ✅ Created checkout success/cancel pages
7. ✅ Updated `.env.example` with Stripe configuration

### Backward Compatibility

Existing database records with Razorpay data remain intact. The system now uses:
- `payment_method: 'stripe'` for new subscriptions
- `stripe_customer_id`, `stripe_subscription_id` for Stripe data
- Legacy `external_subscription_id` can still be used

## Troubleshooting

### Issue: "Stripe price not configured"

**Solution:** Ensure all Stripe Price IDs are set in environment variables.

### Issue: "Webhook signature verification failed"

**Solution:** 
1. Check `STRIPE_WEBHOOK_SECRET` is correct
2. Ensure webhook endpoint URL is correct in Stripe Dashboard
3. Verify webhook events are selected correctly

### Issue: Payment succeeds but subscription not updated

**Solution:**
1. Check webhook logs in Stripe Dashboard
2. Verify webhook endpoint is publicly accessible
3. Check server logs for errors in `/api/stripe/webhook`
4. Ensure database has proper permissions

## Deployment Checklist

- [ ] Set all environment variables in Vercel
- [ ] Create products and prices in Stripe Dashboard (production mode)
- [ ] Configure webhook endpoint with production URL
- [ ] Update `NEXT_PUBLIC_SITE_URL` to production domain
- [ ] Test payment flow in production with test mode
- [ ] Switch to live mode when ready
- [ ] Monitor webhook logs in Stripe Dashboard

## Support

For Stripe API documentation: https://stripe.com/docs/api
For webhook testing: https://stripe.com/docs/webhooks/test

## Notes

- Prices are in INR (Indian Rupees)
- Stripe handles currency conversion if needed
- Test mode uses sandbox data only
- Production requires live API keys and real payment methods
