# SubscriptionActions Component

## Overview

The `SubscriptionActions` component provides a complete interface for managing user subscriptions, including upgrade, cancellation, and auto-renewal settings.

## Features

### 1. Upgrade Flow
- Displays available upgrade options based on current tier
- Shows confirmation modal with:
  - Current plan vs. target plan
  - Price comparison
  - Monthly price difference
- Calls `/api/subscriptions/checkout` to create payment link
- Redirects to Razorpay payment page
- Auto-refreshes subscription data after successful payment

### 2. Cancel Flow
- Shows warning modal with feature loss information
- Lists all features that will be lost upon cancellation
- Offers two cancellation options:
  - **Cancel at end of period** (recommended): Maintains access until current period ends
  - **Cancel immediately**: Terminates subscription right away
- Calls `/api/subscriptions/cancel` API
- Shows success message and refreshes subscription data

### 3. Auto-Renewal Toggle
- Simple toggle switch for enabling/disabling auto-renewal
- Calls `/api/subscriptions/update` API immediately
- Shows loading state during API call
- Displays success confirmation

## Props

```typescript
interface SubscriptionActionsProps {
  subscription: UserSubscription     // Current subscription data
  userId: string                     // User ID for API calls
  onSubscriptionChange?: () => void  // Optional callback after changes
}
```

## Usage

### Basic Usage

```tsx
import { SubscriptionActions } from '@/components/subscription'

function SubscriptionPage() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  
  useEffect(() => {
    // Fetch subscription data
    fetchSubscription()
  }, [])
  
  const handleSubscriptionChange = () => {
    // Refetch subscription data
    fetchSubscription()
  }
  
  if (!subscription) return <Loading />
  
  return (
    <SubscriptionActions
      subscription={subscription}
      userId={user.id}
      onSubscriptionChange={handleSubscriptionChange}
    />
  )
}
```

### With Custom Error Handling

```tsx
<SubscriptionActions
  subscription={subscription}
  userId={userId}
  onSubscriptionChange={() => {
    toast.success('Subscription updated!')
    refetchSubscription()
  }}
/>
```

## Component Structure

```
SubscriptionActions
├── Current Plan Info
│   └── Shows tier, description, price
├── Auto-Renew Toggle
│   └── Toggle switch with immediate effect
├── Upgrade Options
│   └── List of available higher-tier plans
├── Cancel Subscription Button
│   └── Only shown for paid plans
├── Upgrade Modal
│   ├── Title: "确认升级"
│   ├── Body: Price comparison, benefits
│   └── Footer: Cancel + Confirm buttons
└── Cancel Modal
    ├── Title: "确认取消订阅"
    ├── Body: Warning, lost features, timing options
    └── Footer: Keep + Cancel buttons
```

## API Integration

### Upgrade: POST /api/subscriptions/checkout

```typescript
// Request
{
  tier: 'premium',
  billing_cycle: 'monthly'
}

// Response
{
  ok: true,
  data: {
    payment_url: 'https://razorpay.com/...'
  }
}
```

### Cancel: POST /api/subscriptions/cancel

```typescript
// Request
{
  cancel_at_end: true  // or false for immediate
}

// Response
{
  ok: true,
  message: 'Subscription will be canceled at the end of current period'
}
```

### Update: POST /api/subscriptions/update

```typescript
// Request
{
  auto_renew: false
}

// Response
{
  ok: true,
  data: { ...updatedSubscription },
  message: 'Auto-renewal disabled successfully'
}
```

## UI States

### Loading States
- Auto-renew toggle: Disabled with opacity during API call
- Upgrade modal: Shows loading spinner on confirm button
- Cancel modal: Shows loading spinner on confirm button

### Error States
- API errors displayed at the top of component
- Red error box with error message
- User can retry the action

### Success States
- Upgrade: Redirects to payment page
- Cancel: Modal closes, callback triggered
- Auto-renew: Immediate visual feedback, callback triggered

## Styling

The component uses the mystical theme with:
- Gold accent colors (`mystical-gold-*`)
- Purple backgrounds (`mystical-purple-*`)
- Consistent border radius and shadows
- Responsive design for mobile/tablet/desktop

### Color Palette
- Primary: `mystical-gold-500` for text
- Secondary: `mystical-gold-600` for muted text
- Background: `mystical-purple-900/50` for cards
- Borders: `mystical-gold-700/30` for subtle borders
- Danger: `red-500` for cancel actions

## Accessibility

- Keyboard navigation support
- ESC key closes modals
- Focus management in modals
- Semantic HTML elements
- Clear button labels in Chinese

## Testing

The component has comprehensive test coverage:

```bash
# Run tests
npm test SubscriptionActions.test.tsx

# Test coverage
- ✅ Renders current plan info
- ✅ Shows/hides upgrade options based on tier
- ✅ Opens/closes modals correctly
- ✅ Handles API calls successfully
- ✅ Displays errors appropriately
- ✅ Toggles auto-renewal
- ✅ Cancels subscription (immediate/end of period)
- ✅ Upgrades to higher tier
```

## Example Scenarios

### Scenario 1: Basic User Upgrading to Premium

1. User clicks "Premium" in upgrade options
2. Modal opens showing:
   - Current: Basic (₹299/月)
   - New: Premium (₹699/月)
   - Difference: +₹400/月
3. User clicks "确认升级"
4. Redirected to Razorpay payment page
5. After payment, returns to app
6. Subscription automatically updated

### Scenario 2: Premium User Canceling Subscription

1. User clicks "取消订阅" button
2. Warning modal shows lost features:
   - 无限流年分析
   - 每月100条QA
   - 导出功能 (pdf, excel)
   - 家族对比分析
3. User selects "在当前周期结束时取消"
4. Shows expiry date: 2024-02-28
5. User clicks "确认取消"
6. Success message shown
7. Subscription marked for cancellation

### Scenario 3: VIP User Disabling Auto-Renewal

1. User sees auto-renew toggle (currently ON)
2. User clicks toggle
3. Toggle animates to OFF position
4. API call updates subscription
5. Success (toggle stays OFF)
6. User will manually renew next period

## Related Components

- **Modal**: Base modal component for dialogs
- **Button**: Styled buttons with variants
- **PlanCard**: Individual plan display
- **PlansSection**: Full plans comparison page

## Dependencies

- `next/router`: For page navigation and reloading
- `../../types/database`: TypeScript types
- `../../lib/subscription`: Subscription plans and helpers
- `../ui/Modal`: Modal component
- `../ui/Button`: Button component

## Notes

- All API calls use query parameter `user_id` (in production, use auth headers)
- Razorpay payment links are used instead of direct Razorpay SDK
- Component handles both success callbacks and router.reload()
- Free tier users don't see cancel button (nothing to cancel)
- VIP tier users don't see upgrade options (already at top tier)
