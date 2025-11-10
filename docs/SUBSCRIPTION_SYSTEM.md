# Subscription System Documentation

Complete subscription management system with Razorpay integration for Eastern Destiny.

## Overview

The subscription system manages user access to premium features through a tiered pricing model with automatic renewal, quota tracking, and feature gating.

## Subscription Tiers

### Free Tier
- **Monthly Cost**: ₹0
- **Yearly Cost**: ₹0
- **Character Profile**: ✅
- **Yearly Flow Reports**: 1 per month
- **AI Q&A**: 0 questions (disabled)
- **Family Comparison**: ❌
- **Export Formats**: None

### Basic Tier
- **Monthly Cost**: ₹299
- **Yearly Cost**: ₹2,999
- **Character Profile**: ✅
- **Yearly Flow Reports**: Unlimited
- **AI Q&A**: 20 questions per month
- **Family Comparison**: ❌
- **Export Formats**: PDF

### Premium Tier
- **Monthly Cost**: ₹699
- **Yearly Cost**: ₹6,999
- **Character Profile**: ✅
- **Yearly Flow Reports**: Unlimited
- **AI Q&A**: 100 questions per month
- **Family Comparison**: ✅
- **Export Formats**: PDF, Excel

### VIP Tier
- **Monthly Cost**: ₹1,499
- **Yearly Cost**: ₹14,999
- **Character Profile**: ✅
- **Yearly Flow Reports**: Unlimited
- **AI Q&A**: Unlimited
- **Family Comparison**: ✅
- **Export Formats**: PDF, Excel, CSV, DOCX

## API Endpoints

### Subscription Management

#### GET `/api/subscriptions/plans`

Get all available subscription plans.

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "free",
      "name": "Free",
      "description": "Basic features, perfect for getting started",
      "price": {
        "monthly": 0,
        "yearly": 0
      },
      "billing_cycles": ["monthly"],
      "features": {
        "character_profile": true,
        "yearly_flow": {
          "enabled": true,
          "limit": 1,
          "period": "monthly"
        },
        "qa": {
          "enabled": false,
          "limit": 0,
          "period": "monthly"
        },
        "family_comparison": false,
        "export": {
          "enabled": false,
          "formats": []
        }
      }
    },
    ...
  ]
}
```

#### POST `/api/subscriptions/checkout`

Create a Razorpay payment link for subscription checkout.

**Request:**
```json
{
  "plan_id": "premium",
  "billing_cycle": "monthly",
  "user_id": "user-uuid",
  "customer_email": "user@example.com",
  "customer_name": "John Doe"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "payment_link_id": "plink_123abc",
    "payment_url": "https://rzp.io/i/abc123",
    "amount": 699,
    "currency": "INR",
    "plan": "Premium",
    "billing_cycle": "monthly",
    "expires_at": 1699999999
  }
}
```

**Errors:**
- `400`: Missing or invalid `plan_id`, `billing_cycle`, or `user_id`
- `400`: Free tier doesn't require payment

#### GET `/api/subscriptions/current`

Get current user's subscription status.

**Query Parameters:**
- `user_id`: User UUID (required)

**Response:**
```json
{
  "ok": true,
  "data": {
    "tier": "premium",
    "plan": "Premium",
    "subscription": {
      "status": "active",
      "current_period_start": "2024-01-15T10:00:00Z",
      "current_period_end": "2024-02-15T10:00:00Z",
      "auto_renew": true,
      "cancel_at": null
    },
    "quota": {
      "yearly_flow": {
        "used": 2,
        "limit": null,
        "reset_at": "2024-02-15T10:00:00Z"
      },
      "qa_questions": {
        "used": 45,
        "limit": 100,
        "reset_at": "2024-02-15T10:00:00Z"
      }
    }
  }
}
```

#### GET `/api/subscriptions/quota`

Get current user's quota usage for limited features.

**Query Parameters:**
- `user_id`: User UUID (required)

**Response:**
```json
{
  "ok": true,
  "data": {
    "tier": "basic",
    "quota": {
      "yearly_flow": {
        "used": 1,
        "limit": 1,
        "reset_at": "2024-02-01T00:00:00Z"
      },
      "qa_questions": {
        "used": 8,
        "limit": 20,
        "reset_at": "2024-02-01T00:00:00Z"
      }
    },
    "limits": {
      "yearly_flow": 1,
      "qa_questions": 20
    }
  }
}
```

#### POST `/api/subscriptions/cancel`

Cancel user's subscription.

**Query Parameters:**
- `user_id`: User UUID (required)

**Request Body:**
```json
{
  "cancel_at_end": true
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Subscription will be canceled at the end of current period"
}
```

### Quota Tracking

#### POST `/api/subscriptions/track-usage` (Internal API)

Track feature usage for quota enforcement. Called internally when features are used.

**Request:**
```json
{
  "user_id": "user-uuid",
  "feature": "qa",
  "amount": 1,
  "report_id": "report-uuid"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Usage tracked: qa +1"
}
```

## Webhook Events

Razorpay webhook events are handled at `/api/razorpay/webhook`.

### payment_link.paid

Triggered when a subscription payment is completed.

**Webhook Processing:**
1. Verify webhook signature
2. Extract payment and subscription metadata
3. Create or update user subscription in database
4. Store payment and billing cycle info in metadata

**Database Updates:**
- `user_subscriptions.tier`: Updated to new tier
- `user_subscriptions.status`: Set to 'active'
- `user_subscriptions.current_period_end`: Set to 30 days (monthly) or 365 days (yearly)
- `user_subscriptions.metadata`: Includes payment ID and billing cycle

## Integration Points

### Yearly Flow Report Endpoint

`POST /api/reports/yearly-flow`

Now includes quota checking:

```typescript
if (user_id) {
  const quotaCheck = await checkQuota(user_id, 'yearly_flow')
  if (!quotaCheck.available) {
    return res.status(429).json({
      ok: false,
      message: upgradePrompt(subscription_tier, 'yearly_flow_unlimited'),
      quota_limit_reached: true,
      used: quotaCheck.current,
      limit: quotaCheck.limit,
    })
  }
}
```

### QA Endpoint

When Q&A endpoint is implemented, add similar quota checking:

```typescript
const quotaCheck = await checkQuota(user_id, 'qa')
if (!quotaCheck.available) {
  return res.status(429).json({
    error: 'QA quota exceeded',
    message: upgradePrompt(tier, 'qa'),
  })
}

// After QA is processed, track usage
await trackUsage(user_id, 'qa', 1, reportId)
```

## Helper Functions

All helpers are available in `lib/subscription.ts`:

### getUserSubscription(userId: string)
Returns the active subscription for a user or null if none exists.

### getUserTier(userId: string)
Returns the current subscription tier or 'free' if no subscription.

### hasFeature(userId: string, feature: string)
Checks if user has access to a feature based on their tier.

### checkQuota(userId: string, feature: 'yearly_flow' | 'qa')
Checks if user has remaining quota for the feature.

Returns:
```typescript
{
  available: boolean
  current: number        // Current usage
  limit: number | null   // Limit or null for unlimited
  resets_at?: string    // ISO timestamp when quota resets
}
```

### trackUsage(userId: string, feature: string, amount: number, reportId?: string)
Records usage of a feature against the user's quota.

### getQuotaUsage(userId: string)
Returns full quota usage info for all limited features.

### upgradePrompt(currentTier: string, requiredFeature: string)
Generates a user-friendly upgrade prompt message.

### createOrUpdateSubscription(userId: string, tier: string, externalId?: string, paymentMethod?: string)
Creates or updates a user subscription.

### cancelSubscription(userId: string, cancelAtEnd: boolean = true)
Cancels a user's subscription.

## Database Schema

### user_subscriptions Table

```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'basic', 'premium', 'vip')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'expired')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN DEFAULT true,
  external_subscription_id TEXT,
  payment_method TEXT,
  cancel_at TIMESTAMPTZ NULL,
  canceled_at TIMESTAMPTZ NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### qa_usage_tracking Table

```sql
CREATE TABLE qa_usage_tracking (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  report_id UUID NOT NULL REFERENCES bazi_reports(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL DEFAULT 'free',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  questions_used SMALLINT NOT NULL DEFAULT 0,
  extra_questions SMALLINT NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Configuration

### Environment Variables

```bash
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
```

### Pricing Configuration

Edit `lib/subscription.ts` to update pricing:

```typescript
export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  basic: {
    price: {
      monthly: 299,  // in paise
      yearly: 2999,
    },
    // ... other config
  },
}
```

## Testing

Run subscription tests:

```bash
npm test lib/subscription.test.ts
npm test pages/api/subscriptions/
```

## Flow Examples

### Upgrading from Free to Premium

1. User clicks "Upgrade" button
2. Frontend calls `POST /api/subscriptions/checkout` with `plan_id: 'premium'`
3. Backend creates Razorpay payment link
4. Frontend redirects user to payment URL
5. User completes payment on Razorpay
6. Razorpay sends `payment_link.paid` webhook
7. Backend creates subscription record
8. User now has Premium access

### Creating a Yearly Flow Report

1. User clicks "Generate Report"
2. Frontend calls `POST /api/reports/yearly-flow` with `user_id`
3. Backend checks quota: `checkQuota(user_id, 'yearly_flow')`
4. If quota exceeded: Returns 429 with upgrade prompt
5. If quota available: Creates job, reduces available quota
6. Frontend shows success or upgrade prompt

### Monthly Quota Reset

- Quotas reset at the start of the calendar month
- `period_start`: First day of month at 00:00 UTC
- `period_end`: Last day of month at 23:59 UTC
- When user reaches their limit, they can't use feature until next month

## Future Enhancements

- [ ] Razorpay Subscriptions API for automatic renewal
- [ ] Webhook handling for subscription events (pause, resume, renewal failed)
- [ ] Email notifications for renewal success/failure
- [ ] Admin dashboard for subscription analytics
- [ ] Discount codes and coupon system
- [ ] Trial periods
- [ ] Family plan sharing
- [ ] Usage alerts when approaching quota limits
