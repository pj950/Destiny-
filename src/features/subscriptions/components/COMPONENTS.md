# Subscription Components

This directory contains React components for displaying and managing subscription plans.

## Components

### PlanCard

Displays a single subscription plan card with pricing, features, and action button.

**Props:**
- `plan: SubscriptionPlan` - Plan data from API
- `isCurrentPlan: boolean` - Whether this is the user's current plan
- `isBillingMonthly: boolean` - Monthly or yearly billing mode
- `onUpgrade: () => void` - Callback when upgrade button is clicked
- `loading?: boolean` - Loading state for the button
- `className?: string` - Additional CSS classes

**Features:**
- Displays plan name, description, and price
- Shows "推荐" badge for Premium plan
- Shows "当前计划" badge for active plan
- Lists 3-4 key features
- Highlights current plan with golden border and glow effect
- Shows annual savings for yearly billing
- Responsive with hover effects

**Example:**
```tsx
import { PlanCard } from '../components/subscription'

<PlanCard
  plan={premiumPlan}
  isCurrentPlan={false}
  isBillingMonthly={true}
  onUpgrade={() => handleUpgrade('premium')}
/>
```

### PlansSection

Complete section component that displays all subscription plans with billing toggle.

**Props:**
- `userId?: string` - Optional user ID to fetch current subscription
- `onSelectPlan?: (planId: SubscriptionTier) => void` - Custom callback for plan selection
- `className?: string` - Additional CSS classes

**Features:**
- Fetches all plans from `/api/subscriptions/plans`
- Fetches current subscription from `/api/subscriptions/current` if userId provided
- Monthly/yearly billing toggle
- Shows savings badge (15% off yearly)
- 4-column grid (desktop), 2-column (tablet), 1-column (mobile)
- Loading and error states
- Integrates all PlanCard components
- Default behavior redirects to checkout URL on upgrade

**Example:**
```tsx
import { PlansSection } from '../components/subscription'

<PlansSection 
  userId={currentUser?.id}
  onSelectPlan={(planId) => console.log('Selected:', planId)}
/>
```

## Subscription Plans

The system supports 4 tiers:

1. **Free** (₹0/month)
   - 1 yearly flow per month
   - No QA
   - No export
   - No family comparison

2. **Basic** (₹299/month, ₹2,999/year)
   - Unlimited yearly flows
   - 20 QA per month
   - PDF export
   - No family comparison

3. **Premium** (₹699/month, ₹6,999/year) - **Recommended**
   - Unlimited yearly flows
   - 100 QA per month
   - PDF + Excel export
   - Family comparison

4. **VIP** (₹1,499/month, ₹14,999/year)
   - Unlimited everything
   - All export formats (PDF, Excel, CSV, DOCX)
   - Family comparison
   - Priority support

## API Integration

### GET /api/subscriptions/plans

Returns all available subscription plans.

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "free",
      "name": "Free",
      "description": "Basic features, perfect for getting started",
      "price": { "monthly": 0, "yearly": 0 },
      "billing_cycles": ["monthly"],
      "features": {
        "character_profile": true,
        "yearly_flow": { "enabled": true, "limit": 1, "period": "monthly" },
        "qa": { "enabled": false, "limit": 0, "period": "monthly" },
        "family_comparison": false,
        "export": { "enabled": false, "formats": [] }
      }
    },
    // ... more plans
  ]
}
```

### GET /api/subscriptions/current?user_id=<id>

Fetches the user's current subscription.

**Response:**
```json
{
  "ok": true,
  "data": {
    "tier": "premium",
    "plan": "Premium",
    "subscription": {
      "status": "active",
      "current_period_start": "2024-01-01T00:00:00Z",
      "current_period_end": "2024-02-01T00:00:00Z",
      "auto_renew": true,
      "cancel_at": null
    },
    "quota": {
      "yearly_flow": { "used": 2, "limit": null },
      "qa": { "used": 45, "limit": 100 }
    }
  }
}
```

## Styling

All components use Tailwind CSS with the custom color palette defined in `tailwind.config.js`:

- **Mystical Colors:**
  - `mystical-gold-400`, `mystical-gold-500`, `mystical-gold-600`, `mystical-gold-700`
  - `mystical-purple-700`, `mystical-purple-900`, `mystical-purple-950`
  - `mystical-cyan-950`

- **Shadows & Effects:**
  - `shadow-gold-glow` - Golden glow effect
  - `shadow-gold-glow-lg` - Large golden glow for highlighted cards
  - `shadow-mystical-medium` - Medium shadow for cards
  - `animate-gold-glow-pulse` - Pulsing animation for current plan

## Testing

Both components include comprehensive test suites:

- `PlanCard.test.tsx` - 6 tests
  - Plan info rendering
  - Monthly/yearly price display
  - Current plan badge
  - Upgrade button
  - Features list
  - Annual savings calculation

- `PlansSection.test.tsx` - 9 tests
  - Plans rendering
  - Billing toggle
  - Recommended badge
  - Current plan tracking
  - Custom plan selection
  - Loading and error states
  - Savings display

Run tests:
```bash
npm run test -- components/subscription/PlanCard.test.tsx
npm run test -- components/subscription/PlansSection.test.tsx
```

## Integration Example

Create a subscription page that shows all plans:

```tsx
import { useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { PlansSection } from '../components/subscription'
import Container from '../components/ui/Container'
import Section from '../components/ui/Section'

export default function SubscriptionPage() {
  const router = useRouter()
  const [currentUserId] = useState(getUserId()) // Your auth logic

  const handleSelectPlan = (planId) => {
    router.push(`/checkout?plan=${planId}`)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Section background="mystical-dark" spacing="spacious">
        <Container size="xl">
          <PlansSection 
            userId={currentUserId}
            onSelectPlan={handleSelectPlan}
          />
        </Container>
      </Section>
      <Footer />
    </div>
  )
}
```

## Customization

To customize colors, modify the theme in `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      mystical: {
        gold: {
          600: '#daa520',
          700: '#d4af37',
          500: '#f4af37',
        },
        // ... other colors
      },
    },
  },
}
```

To change plan pricing or features, modify `lib/subscription.ts`:

```ts
export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  premium: {
    price: {
      monthly: 699,
      yearly: 6999,
    },
    // ... other fields
  },
}
```
