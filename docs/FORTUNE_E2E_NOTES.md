# Daily Fortune (每日一签) End-to-End Testing Notes

## Feature Overview
The Daily Fortune feature allows users to draw daily fortune sticks with AI-powered interpretations. The feature enforces a one-draw-per-day limit using session-based tracking.

## End-to-End Test Scenarios

### 1. Initial Page Load

**Test Case: Page loads correctly**
- User navigates to `/fortune`
- Expected behavior:
  - Page shows title "每日一签" and tagline
  - Special notice displays: "每天限制抽签一次，请明天再来"
  - Skip to main content link is available for keyboard users
  - Page transitions from 'idle' state to 'select' state within 300ms
  - Category buttons are visible and enabled

**Test Case: Check for existing today's fortune**
- On page load, API calls `/api/fortune/today`
- Expected behavior:
  - If fortune exists: page shows result state directly
  - If no fortune: page shows category selection state
  - Network errors are handled gracefully with cached data fallback

### 2. Category Selection

**Test Case: Select each category**
- User clicks on each of the 15 category buttons (事业运, 财富运, 感情运, 婚姻运, 家庭运, 健康运, 考试运, 官司诉讼, 旅行出行, 求子育儿, 置业投资, 买房置业, 风水运势, 寻物失物, 综合运途)
- Expected behavior:
  - Button receives focus outline on keyboard navigation
  - Icon scales up on hover (transform animation)
  - Cursor changes to pointer on hover
  - State transitions to 'shake' when clicked
  - Corresponding aria-label announces "求签类别：[category]"
  - Each category has its own gradient color and icon

**Test Case: Category buttons are keyboard accessible**
- User tabs through category buttons and presses Enter
- Expected behavior:
  - All buttons are keyboard focusable
  - Enter key triggers click event
  - Focus outline is visible (3px solid #0ea5e9)
  - Category selection works same as mouse click

**Test Case: Disabled state during draw**
- While drawing (loading=true):
  - User attempts to click another category
  - Expected behavior:
    - Button has disabled attribute set
    - Opacity reduced to 60%
    - Cursor not-allowed
    - Click is ignored
    - aria-disabled="true" announces disabled state

### 3. Shake Animation Phase

**Test Case: Shake animation displays correctly**
- User selects a category
- Expected behavior:
  - Page transitions to 'shake' state
  - Shaking emoji (🎯) appears and animates
  - Shake animation uses `transform` and `rotate` only (no layout shift)
  - Animation duration: 2 seconds
  - Loading dots appear with staggered bounce animation (delay: 0ms, 150ms, 300ms)
  - Selected category badge displays with icon

**Test Case: Reduced-motion preference respected**
- User has `prefers-reduced-motion: reduce` set in OS
- Expected behavior:
  - Shake animation is disabled
  - Only static emoji displays
  - Loading indicator still shows but without animation
  - State transitions still work normally

**Test Case: Status message for screen readers**
- Expected aria-live announcement:
  - "正在为您求签..." (initial state)
  - "正在与神灵沟通..." (during API call)
- Status updates to aria-live region with polite priority

### 4. API Call & Error Handling

**Test Case: Successful fortune draw**
- Shake animation completes, API call to `/api/fortune/draw` succeeds
- Expected behavior:
  - State transitions to 'fallen'
  - Status message updates: "签文已出，正在为您解读..."
  - API response includes: id, category, stick_id, stick_text, stick_level, ai_analysis, created_at

**Test Case: Already drawn today error**
- User had already drawn fortune earlier today
- Expected behavior:
  - API returns: `{ ok: true, alreadyDrawn: true, message: '今日已抽签...', fortune: {...} }`
  - State transitions to 'result'
  - Notice displays: "今日已抽签，请明天再来"
  - Redirect to result screen (cached data shown)

**Test Case: Network error handling**
- Network request fails
- Expected behavior:
  - Loading state cleared
  - Error toast displays: "错误：网络错误，请稍后重试"
  - State reverts to 'select'
  - Cached fortune fallback message shows if available
  - aria-live announces error message

**Test Case: API rate limit (429)**
- Gemini API returns rate limit error
- Expected behavior:
  - Error message: "AI解签暂时不可用，请稍后再试。"
  - Fortune still drawn but without AI analysis
  - Result state shows with empty ai_analysis section
  - No hard error, graceful degradation

**Test Case: Timeout handling**
- Gemini AI response takes > 30 seconds
- Expected behavior:
  - Request times out
  - Error caught: "AI analysis timeout"
  - Fortune shown without AI interpretation
  - State transitions to result normally

### 5. Fallen Animation Phase

**Test Case: Fall animation displays correctly**
- After API call succeeds
- Expected behavior:
  - Scroll effect with emoji falling (📜)
  - Animation uses `transform: translateY()` and `rotate()` only
  - Opacity fades in from 0 to 1
  - Animation duration: 1.5 seconds
  - After animation completes, state transitions to 'result'
  - No layout shift during animation

**Test Case: Reduced-motion: animation disabled**
- With `prefers-reduced-motion: reduce`:
  - Emoji appears instantly without fall animation
  - State transitions to result immediately
  - Loading dots still present briefly then removed

### 6. Result Display State

**Test Case: Fortune result displays correctly**
- State is 'result' and fortune data exists
- Expected behavior:
  - Category badge shows: icon + category name
  - Stick number displays: "第 X 签"
  - Stick level shows with color: 上上(red), 上吉(orange), 中吉(yellow), 下吉(blue), 凶(gray)
  - Stick text displays in styled container
  - AI analysis section shows (if available)
  - Draw time displays: "抽签时间：[localized datetime]"
  - "重新选择" button is enabled

**Test Case: AI analysis displays correctly**
- If ai_analysis is not null:
  - Section shows: "🤖 AI 解签"
  - Content displays with `whitespace-pre-wrap` for formatting
  - Leading/trailing whitespace preserved
  - Text is left-aligned and readable

**Test Case: No AI analysis fallback**
- If ai_analysis is null or empty:
  - AI analysis section is hidden
  - Result still shows fortune stick text normally
  - No error indication

**Test Case: One-draw-per-day notice prominent**
- At bottom of result page:
  - Bold text: "✓ 每日仅可抽签一次，请明日再来"
  - Clear visual hierarchy indicating daily limit

### 7. State Transitions & Reset

**Test Case: Reset from result to select**
- User clicks "重新选择" button on result page
- Expected behavior:
  - Button is enabled (loading must be false)
  - Click sets state to 'select'
  - Clears all state: selectedCategory, error, notice, statusMessage
  - Category buttons are enabled again
  - Page scrolls to category selection

**Test Case: Back button behavior**
- User uses browser back button during:
  - Select state: normal back navigation
  - Shake/fallen state: clears timeouts, navigates back normally
- Expected behavior:
  - Timeouts cleared (shakeTimeoutRef, revealTimeoutRef)
  - No memory leaks
  - Page state resets properly on re-entry

### 8. Local Storage Caching

**Test Case: Fortune cache stored locally**
- After successful draw:
  - localStorage key: `daily_fortune_cache_v1`
  - Value: `{ date: 'YYYY-MM-DD', fortune: {...} }`
- Expected behavior:
  - Cache persists across page reloads
  - Same-day reload shows cached fortune immediately
  - Next-day: cache cleared automatically

**Test Case: Cache invalidation**
- Cache exists with yesterday's date
- Expected behavior:
  - Page detects date mismatch
  - Calls `localStorage.removeItem(STORAGE_KEY)`
  - Page allows new draw
  - If network fails: no old fortune shown

**Test Case: Storage error handling**
- localStorage throws quota exceeded error
- Expected behavior:
  - Console warning logged
  - Feature continues to work
  - Network fallback used

### 9. Accessibility Testing

**Test Case: Screen reader announces state changes**
- User uses screen reader (NVDA, JAWS, VoiceOver)
- Expected aria-live announcements:
  - Category selection: "请选择求签类别"
  - During draw: "开始为您求签..."
  - Shaking: "正在与神灵沟通..."
  - Fallen: "签文已出，正在为您解读..."
  - Result: "结果已生成"
  - Errors: "错误：[error message]"

**Test Case: Keyboard navigation flow**
- User navigates with Tab/Shift+Tab only
- Expected behavior:
  - Skip to main content link focusable first
  - All 5 category buttons are in tab order
  - "重新选择" button is focusable
  - Focus is visible (3px outline)
  - Focus order is logical left-to-right

**Test Case: Alt text for decorative elements**
- Expected behavior:
  - Emojis marked with `aria-hidden="true"`
  - Category icons marked with `aria-hidden="true"`
  - Icons in result section marked with `aria-hidden="true"`
  - No duplicate announcements

**Test Case: Color contrast**
- Run through Lighthouse/WAVE checker
- Expected:
  - All text meets WCAG AA contrast ratios (4.5:1 normal, 3:1 large)
  - Error text (red) contrast sufficient
  - Level colors readable for colorblind users

### 10. Performance Testing

**Test Case: No layout shift during animations**
- Use Chrome DevTools Cumulative Layout Shift metric
- Expected:
  - Fortune animations use `transform` and `opacity` only
  - CLS score remains minimal (< 0.1)
  - Glow animation uses opacity, not box-shadow

**Test Case: Lighthouse Accessibility Score**
- Run Lighthouse audit
- Expected:
  - Accessibility score: ≥ 90
  - No console errors or warnings
  - Proper heading hierarchy
  - Image alt text present

**Test Case: Animation performance**
- Expected:
  - Animations run at 60fps (use `requestAnimationFrame`)
  - No jank during shake/fall animations
  - Mobile devices: animations smooth on 60fps displays
  - With reduced-motion: animations disabled completely

### 11. Session & Cookie Management

**Test Case: Session cookie created**
- First visit to fortune page
- Expected behavior:
  - Cookie set: `fortune_session=<UUID>`
  - HttpOnly flag set
  - Secure flag set in production
  - SameSite=Lax set
  - Max-Age: 365 days (1 year)

**Test Case: Same session across page reloads**
- Draw fortune, reload page
- Expected behavior:
  - Same session ID used
  - "Already drawn" check uses session ID
  - Fortune shown immediately

**Test Case: Different sessions isolated**
- Open fortune in 2 different browsers/incognito windows
- Expected behavior:
  - Each gets unique session ID
  - Each can draw once per day independently
  - Cookies don't mix

### 12. Responsive Design

**Test Case: Mobile view (< 768px)**
- Expected:
  - Category grid: 2 columns on mobile, 3 on tablet, 5 on desktop
  - Touch targets: ≥ 44×44 pixels
  - Text readable without zoom
  - Animations still smooth

**Test Case: Tablet view (768px - 1024px)**
- Expected:
  - Grid adapts to 3 columns
  - Touch-friendly spacing maintained
  - Animations work smoothly

**Test Case: Desktop view (> 1024px)**
- Expected:
  - Grid shows all 5 categories in one row
  - Animations run at full quality
  - Hover effects on desktop

### 13. Data Validation

**Test Case: Invalid category rejection**
- Attempt direct API call with invalid category
- Expected:
  - API returns 400: "Invalid category"
  - UI prevents this naturally through button selection

**Test Case: Malformed response handling**
- API returns response missing fields
- Expected behavior:
  - Error handling catches missing fields
  - Graceful error message shown
  - No console errors

### 14. Cookie & Session Edge Cases

**Test Case: Session ID persists across fortunate draws**
- First draw creates session
- Reset button shown, user clicks "重新选择"
- Expected:
  - Session ID remains same in cookie
  - Next day reset check still uses same session ID

**Test Case: Expired session handling**
- Simulate session cookie removed/expired
- Expected:
  - New session ID generated
  - User can draw again (but only once new day)

## Manual Testing Checklist

- [ ] Click each category button and verify shake animation
- [ ] Verify loading dots bounce correctly
- [ ] Watch fall animation complete smoothly
- [ ] Read AI analysis text is readable and well-formatted
- [ ] Click "重新选择" and verify category grid reappears
- [ ] Test on mobile: verify touch targets work
- [ ] Test with keyboard only: Tab through all controls
- [ ] Test with screen reader: verify announcements
- [ ] Test in Incognito: verify separate session
- [ ] Reload page during shake: verify cleanup/timeout handling
- [ ] Toggle reduced-motion: verify animations disabled
- [ ] Check DevTools: no console errors
- [ ] Check Lighthouse: score ≥ 90 for accessibility
- [ ] Verify next day: fortune limit resets

## Monitoring & Debugging

### Log Points
- State transitions: `console.log('State:', state)`
- API calls: `console.log('Draw API response:', data)`
- Cache operations: `console.log('Cache:', {date, fortune})`
- Session ID: `console.log('Session:', sessionId)`

### Common Issues
- **Animations jank**: Check for layout shifts (use DevTools rendering)
- **FOUC (Flash of Unstyled Content)**: Check CSS is loaded before JS
- **Session mismatch**: Verify cookie is HttpOnly and persists
- **Timeout on Gemini**: Check API key is valid, network connectivity
- **Cache not persisting**: Check localStorage enabled, quota not exceeded

## API Endpoints Reference

### GET /api/fortune/today
- Purpose: Check if user has drawn today
- Returns: `{ ok: true, hasFortune: boolean, fortune?: Fortune }`
- Sets: `fortune_session` cookie if not exists

### POST /api/fortune/draw
- Purpose: Draw a new fortune
- Input: `{ category: '事业' | '财富' | '感情' | '健康' | '学业' }`
- Returns: `{ ok: true, alreadyDrawn: boolean, fortune: Fortune, message?: string }`
- Status: 400 if invalid category, 500 if server error
- Side effects: Creates new fortune record, may call Gemini AI

## Related Documentation
- `/pages/fortune.tsx` - React component with state machine
- `/pages/api/fortune/today.ts` - Check daily draw endpoint
- `/pages/api/fortune/draw.ts` - Draw fortune endpoint
- `/lib/fortune.test.ts` - Unit tests for fortune feature
- `/styles/globals.css` - Animation definitions with reduced-motion
