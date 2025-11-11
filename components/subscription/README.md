# Subscription Components

This directory contains React components for displaying subscription and quota information.

## Components

### QuotaCard

A card component that displays quota information for a single feature.

**Props:**
- `title: string` - Feature name
- `used: number` - Current usage amount
- `limit: number | null` - Usage limit (null for unlimited)
- `enabled: boolean` - Whether the feature is enabled
- `period?: string` - Usage period (e.g., 'monthly', 'yearly')
- `resetAt?: string` - Reset timestamp
- `onUpgrade?: () => void` - Callback for upgrade button
- `className?: string` - Additional CSS classes

**Features:**
- Progress bar with color coding (green < 50%, yellow 50-80%, red > 80%)
- Status display (unlimited, used/limit, disabled, locked)
- Upgrade button for locked features
- Reset time display when available

### QuotaSection

A section component that displays quota information for all features.

**Props:**
- `userId: string` - User ID to fetch quota data for
- `className?: string` - Additional CSS classes

**Features:**
- Fetches quota data from `/api/subscriptions/quota`
- Displays 5 feature cards:
  1. 性格简报 (Character Profile) - Always unlimited
  2. 流年报告 (Yearly Flow) - Based on tier limits
  3. 智能问答 (QA) - Based on tier limits
  4. 家人对比 (Family Comparison) - Premium+ only
  5. 导出报告 (Export) - Based on tier limits
- Loading skeleton while fetching
- Error handling with retry button
- Responsive grid layout (1/2/3 columns)

### SubscriptionStatusCard

A card component that displays current subscription status.

**Props:**
- `userId: string` - User ID to fetch subscription data for
- `className?: string` - Additional CSS classes

## Usage Examples

### QuotaCard

```tsx
import { QuotaCard } from '../components/subscription'

<QuotaCard
  title="流年报告"
  used={5}
  limit={10}
  enabled={true}
  period="monthly"
  resetAt="2024-12-31T23:59:59Z"
  onUpgrade={() => navigate('/subscription')}
/>
```

### QuotaSection

```tsx
import { QuotaSection } from '../components/subscription'

<QuotaSection userId="user-123" className="my-8" />
```

## Styling

Components use Tailwind CSS with consistent design patterns:
- Cards use rounded-xl with shadow effects
- Progress bars use semantic color coding
- Responsive grid layouts
- Consistent spacing and typography

## Integration

Components integrate with:
- Subscription system from `lib/subscription.ts`
- Quota API at `/api/subscriptions/quota`
- Existing UI components (Card, Button)
- Supabase for data fetching