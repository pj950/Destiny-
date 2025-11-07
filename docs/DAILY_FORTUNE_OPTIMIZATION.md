# Daily Fortune (每日一签) Optimization - Complete Flow & Enhanced UX

## Overview
This document describes the complete optimization of the Daily Fortune feature with an enhanced interactive flow, improved visual effects, and better user experience.

## Architecture & State Machine

### States
The Daily Fortune feature follows a clear state machine with 6 states:

```
idle → select → selected → shake → fallen → result
                   ↓                           ↑
                   ←───────── reset ──────────┘
```

1. **idle**: Initial state during page load
2. **select**: Category selection interface (15 categories grid)
3. **selected**: Show "Start Shaking" CTA button after selection
4. **shake**: Fortune stick shaking animation (3D perspective)
5. **fallen**: Fortune stick falling animation with rotation
6. **result**: Display fortune card with AI analysis

### Flow

1. User lands on `/fortune` page
2. Page checks if already drew fortune today
3. If yes, shows result; if no, shows category selection grid
4. User selects a category → moves to "selected" state
5. Shows prominent "开始摇签" (Start Shaking) CTA button
6. User clicks button → enters "shake" state with 3D animation
7. After 3 seconds, automatically enters "fallen" state
8. Animation plays as fortune stick falls
9. After 1.8 seconds, transitions to "result" state
10. Shows fortune card (签牌) with fortune details and AI analysis

## Interactive Flow Enhancements

### 1. Category Selection (select state)
- **Grid Layout**: 3 columns on mobile, 4-6 on larger screens
- **Visual Feedback**: 
  - Gradient backgrounds matching category colors
  - Category-specific emoji icons
  - Hover effects with scale and shadow
  - Focus indicators for keyboard navigation
- **Accessibility**: 
  - ARIA labels for each category button
  - Keyboard navigation (Tab, Enter/Space to select)

### 2. Category Confirmation (selected state)
- **Purpose**: Allow user to reconsider before animation
- **Display**:
  - Large category badge showing selected category
  - Category icon and name prominently displayed
  - Motivational text: "诚心祈祷，虔心向神灵请求指引"
  - Two buttons: "开始摇签" (Start) and "返回选择" (Back)

### 3. Shake Animation (shake state)
- **Duration**: 3 seconds (3000ms)
- **Visual Elements**:
  - 3D fortune stick with perspective effects
  - 3D rotation and translation
  - Multiple axes: X, Y, Z rotations
  - Glow effect that pulses
  - Status message with loading dots
- **API Call**: Initiated after shake animation completes

### 4. Falling Animation (fallen state)
- **Duration**: 1.8 seconds
- **Visual Elements**:
  - Fortune stick falls from top with 3D flip
  - Multiple 360° rotations during fall
  - Opacity changes for visibility
  - Shadow disappears as stick falls
  - Scale adjustments for realism
  - Bouncy easing: `cubic-bezier(0.25, 0.46, 0.45, 0.94)`

### 5. Result Display (result state)
- **Fortune Card**:
  - Ancient-style design with gold borders
  - Gradient background for elegance
  - Category badge at top
  - Fortune stick number (第 N 签)
  - Fortune level with color coding:
    - 上上 (Best): Red
    - 上吉 (Good): Orange
    - 中吉 (Medium): Yellow
    - 下吉 (Low): Blue
    - 凶 (Bad): Gray
  - Main fortune text in highlighted section
- **AI Analysis Section**:
  - Heading with robot emoji
  - Multi-paragraph AI interpretation
  - Wrapped text for readability

## Visual Optimizations

### 3D Fortune Stick Component
- **File**: `components/FortuneStick.tsx`
- **Features**:
  - 3D perspective: `perspective: 1000px`
  - Gradient body matching category color
  - Cylindrical effect with left/right edges
  - Top and bottom metal-like caps (gold gradient)
  - Center "签" character (traditional Chinese character)
  - Left edge shadow (3D depth)
  - Right edge highlight (3D depth)
  - Top shine effect
  - Optional glow effect during shaking
  - Shadow under stick (disappears during falling)

### Fortune Card Component
- **File**: `components/FortuneCard.tsx`
- **Design Elements**:
  - White gradient background (paper-like)
  - Gold borders (3px solid #d4af37)
  - Decorative corners (subtle 8×8px borders)
  - Ancient background pattern (diagonal striping)
  - Multiple dividers with gradient effect
  - Shadow and inset effects for depth
  - Reflection effect at bottom

### Animation Stage Component
- **File**: `components/FortuneAnimationStage.tsx`
- **Features**:
  - Full-width container with category gradient
  - Decorative background blobs (glassmorphism effect)
  - Backdrop blur effect
  - Centered content layout
  - Loading dots with staggered animation
  - Status message display

### CSS Animations
- **File**: `styles/globals.css`
- **Key Animations**:
  - `stickShake` (3s): 3D rotation and translation on multiple axes
  - `stickFall` (1.8s): Falling with multiple 360° rotations
  - `cardReveal` (0.8s): Card appears with 3D flip effect
  - `shake`: Original simple shake (for fallback)
  - `fall`: Original simple fall (for fallback)
  - `glow`: Opacity pulsing effect
  - `fade-in`: Smooth state transitions

### Color System
- **Categories**: Each has unique gradient pair:
  - 事业运: blue-500 → blue-600
  - 财富运: yellow-500 → yellow-600
  - 感情运: red-500 → pink-600
  - 婚姻运: pink-500 → rose-600
  - 家庭运: orange-500 → orange-600
  - 健康运: green-500 → green-600
  - 考试运: purple-500 → purple-600
  - 官司诉讼: indigo-500 → indigo-600
  - 旅行出行: cyan-500 → cyan-600
  - 求子育儿: amber-500 → amber-600
  - 置业投资: emerald-500 → emerald-600
  - 买房置业: stone-500 → stone-600
  - 风水运势: violet-500 → violet-600
  - 寻物失物: lime-500 → lime-600
  - 综合运途: fuchsia-500 → fuchsia-600

## UX Enhancements

### Loading States
- **Shake State**: Animated dots with status "正在为您求签..."
- **Fallen State**: Animated dots with status "正在为您解读..."
- **Visual**: Three dots with staggered 0/150/300ms delays

### Error Handling
- **Network Errors**: "网络错误，请稍后重试"
- **API Errors**: Custom error message from API
- **Cache Fallback**: Shows cached fortune from localStorage if available
- **Error Toast**: Red background with error icon and explanatory text

### One-Draw-Per-Day Limit
- **Initial Check**: API checks `fortunes` table for today's entry
- **Protection**: Unique constraint on `(session_id, draw_date)` in DB
- **User Message**: "今日已抽签，请明天再来"
- **Clear Communication**: Message shown during session

### Responsive Design
- **Mobile (< 640px)**:
  - 3-column category grid
  - Compact card padding
  - Smaller text sizes
  - Touch-friendly button sizes
- **Small (640px - 768px)**:
  - 4-column grid
  - Medium card padding
  - Adjusted spacing
- **Medium (768px - 1024px)**:
  - 5-column grid
  - Normal card padding
  - Full text sizes
- **Large (1024px+)**:
  - 6-column grid
  - Spacious card padding
  - All effects visible

### Accessibility Features
- **Keyboard Navigation**:
  - Tab through category buttons and action buttons
  - Enter/Space to activate buttons
  - Logical focus order maintained
- **Focus Indicators**:
  - 3px solid #0ea5e9 outline
  - 2px offset for visibility
  - Visible on all interactive elements
- **Screen Reader Support**:
  - aria-live region for status messages
  - aria-label on category buttons
  - aria-hidden on decorative emojis
  - Semantic HTML structure
  - Skip to main content link
- **Reduced Motion**:
  - All animations disabled for users with `prefers-reduced-motion: reduce`
  - CSS rules override animations
  - Content still displays correctly

## Database Integration

### Tables
- **fortunes**: Stores daily fortune draws
  - `session_id`: Browser session identifier
  - `draw_date`: Date in YYYY-MM-DD format
  - `category`: Fortune category
  - `stick_id`: ID from 1-100
  - `stick_text`: Fortune text
  - `stick_level`: 上上, 上吉, 中吉, 下吉, 凶
  - `ai_analysis`: Gemini AI interpretation (nullable)
  - `created_at`: Timestamp

### Cache Strategy
- **LocalStorage**: 
  - Key: `daily_fortune_cache_v1`
  - Stores: `{ date, fortune }`
  - Expires: Daily (checked against current date)
  - Fallback: Used when network unavailable

## API Endpoints

### GET /api/fortune/today
- **Purpose**: Check if user already drew today
- **Returns**: `{ ok: boolean, hasFortune: boolean, fortune?: Fortune }`
- **Session Cookie**: Automatically set if missing
- **Cache**: Uses session ID to identify user

### POST /api/fortune/draw
- **Purpose**: Draw new fortune and get AI analysis
- **Input**: `{ category: FortuneCategory }`
- **Returns**: `{ ok: boolean, alreadyDrawn: boolean, fortune: Fortune }`
- **AI Model**: Gemini 2.5 Pro (configurable via GEMINI_MODEL_SUMMARY)
- **Timeout**: 30 seconds for AI call
- **Error Handling**: 
  - Returns cached fortune if already exists
  - Returns error message if category invalid
  - Returns partial result if AI fails

## Performance Optimizations

### Animation Performance
- **GPU Acceleration**: Using `transform` and `opacity` only
- **No Layout Shifts**: No width/height changes during animation
- **Hardware 3D**: `perspective` and `transform-style: preserve-3d`
- **Smooth 60fps**: Cubic-bezier easing for smooth timing

### Component Structure
- **Separate Components**: FortuneStick, FortuneCard, FortuneAnimationStage
- **Lazy Rendering**: Components only render in specific states
- **Minimal Re-renders**: State management prevents unnecessary updates
- **Event Cleanup**: Timeouts properly cleared on unmount

### Network Optimization
- **Caching**: LocalStorage backup for network failures
- **Fast API**: Quick response from fortune draw endpoint
- **AI Streaming**: (Future) Could implement streaming for long responses

## Testing Recommendations

### Manual Testing Checklist
1. **Category Selection**:
   - [ ] All 15 categories display correctly
   - [ ] Hover effects work on desktop
   - [ ] Categories highlight when selected
   - [ ] Grid is responsive on mobile

2. **Animation Stage**:
   - [ ] Shake animation runs for 3 seconds
   - [ ] Fortune stick rotates on multiple axes
   - [ ] Glow effect pulses smoothly
   - [ ] Fallen state shows stick falling

3. **Result Display**:
   - [ ] Fortune card appears with gold borders
   - [ ] All decorative elements visible
   - [ ] Text wraps correctly
   - [ ] AI analysis section displays properly

4. **One-Draw-Per-Day**:
   - [ ] First draw works normally
   - [ ] Second draw shows "已抽签" message
   - [ ] Cache persists across page refreshes
   - [ ] New day resets ability to draw

5. **Error Handling**:
   - [ ] Network error shows fallback message
   - [ ] API errors display error message
   - [ ] Invalid category handled gracefully

6. **Accessibility**:
   - [ ] Tab through all elements works
   - [ ] Focus indicators visible
   - [ ] Keyboard Enter/Space activates buttons
   - [ ] Screen reader announces state changes

7. **Mobile Experience**:
   - [ ] Touch buttons are large enough
   - [ ] No horizontal overflow
   - [ ] Text is readable
   - [ ] Animations smooth on mobile

### Automated Testing (Vitest)
- Unit tests for state transitions
- API response mocking
- Animation timing verification
- Accessibility feature tests
- 30+ existing tests in fortune.test.ts

## Browser Compatibility
- **3D Effects**: Requires CSS 3D Transforms support (all modern browsers)
- **Fallback**: Simple animations still work if 3D not supported
- **Mobile**: Tested on iOS Safari, Android Chrome
- **Desktop**: Chrome, Firefox, Safari, Edge

## Future Enhancements
1. **Fortune Details**: Click to see deeper fortune card interpretation
2. **Sharing**: Share fortune on social media
3. **History**: View past week's fortunes
4. **Personalization**: User accounts and fortune history
5. **Animations**: More elaborate stick models (VR style)
6. **Sound Effects**: Optional audio feedback (if enabled)
7. **Statistics**: Show category distribution over time

## Files Modified/Created

### New Files
- `lib/fortuneConstants.ts`: Centralized constants for categories, icons, gradients, colors
- `components/FortuneStick.tsx`: 3D fortune stick component
- `components/FortuneCard.tsx`: Ancient-style fortune card display
- `components/FortuneAnimationStage.tsx`: Full-screen animation stage
- `docs/DAILY_FORTUNE_OPTIMIZATION.md`: This file

### Modified Files
- `pages/fortune.tsx`: Complete rewrite with new state machine and flow
- `styles/globals.css`: Added new 3D animations and updated reduced-motion support

### API Routes (No Changes)
- `pages/api/fortune/draw.ts`: Works as before
- `pages/api/fortune/today.ts`: Works as before

## Deployment Checklist
- [ ] All TypeScript types are correct
- [ ] No console errors in production
- [ ] Animations smooth on target devices
- [ ] Mobile layout is responsive
- [ ] Accessibility features work
- [ ] API endpoints respond correctly
- [ ] Cache strategy works properly
- [ ] One-draw-per-day enforced
- [ ] Error messages display properly
- [ ] Build completes without errors

## Support & Troubleshooting

### Animations Stuttering
- Check GPU acceleration in browser DevTools
- Ensure no other heavy processes running
- Try reducing number of simultaneous animations
- Check `prefers-reduced-motion` setting

### 3D Effects Not Showing
- Verify browser supports CSS 3D Transforms
- Check graphics card drivers
- Ensure hardware acceleration enabled
- Try different browser

### API Errors
- Check GOOGLE_API_KEY environment variable
- Verify Gemini API key is valid
- Check Supabase connection
- Review API logs for specific errors

### Cache Issues
- Clear browser localStorage
- Check localStorage quota not exceeded
- Verify date format in cache (YYYY-MM-DD)
- Check console for cache read/write errors
