# Prayer Lamps Animation System

This document describes the enhanced prayer lamps animation system, including visual effects, persistence, accessibility features, and performance optimizations.

## Overview

The prayer lamps feature includes:
- Smooth CSS animations for lit states
- LocalStorage caching for offline resilience
- Accessible user interface with screen reader support
- Performance monitoring and optimization
- Comprehensive error handling with toast notifications

## Animation System

### Core Components

#### Animation Classes
- **`lamp-lit`**: Main animation for lit lamps with glow and pulse effects
- **`lamp-purchasing`**: Animation for purchasing state with loading indicator
- **`lamp-lit-reduced-motion`**: Reduced motion variant for accessibility
- **`lamp-purchasing-reduced-motion`**: Reduced motion purchasing variant

#### Visual Effects
1. **Soft Glow Effect**: Multi-layer box-shadow creating warm orange glow
2. **Pulsing Aura**: Subtle scale and opacity animations
3. **Candle Flicker**: Realistic flame-like movement
4. **Glow Particles**: Floating light particles for added ambiance

### Customization

#### Animation Timing
You can adjust animation timing by modifying the CSS variables in `/public/lamp-animations.css`:

```css
/* Main glow animation (3s duration) */
@keyframes lamp-glow {
  0% { /* ... */ }
  50% { /* ... */ }
  100% { /* ... */ }
}

/* Flicker animation (4s duration) */
@keyframes image-flicker {
  /* ... */
}
```

#### Glow Intensity
Adjust glow intensity by modifying the box-shadow values:

```css
/* For subtle glow */
box-shadow: 0 0 10px rgba(251, 146, 60, 0.2);

/* For intense glow */
box-shadow: 0 0 40px rgba(251, 146, 60, 0.6);
```

#### Flicker Speed
Change flicker animation duration:

```css
.lamp-image-lit {
  animation: image-flicker 2s ease-in-out infinite; /* Faster */
  /* or */
  animation: image-flicker 6s ease-in-out infinite; /* Slower */
}
```

## Performance Optimization

### Animation Performance
- Uses `transform` and `opacity` for GPU acceleration
- `will-change` property for optimization hints
- `backface-visibility: hidden` for smooth rendering
- Performance monitoring with FPS tracking

### Monitoring
The system includes performance monitoring:

```typescript
import { AnimationPerformanceMonitor } from '../lib/lamp-animations'

const monitor = AnimationPerformanceMonitor.getInstance()
monitor.startMonitoring()

console.log('Current FPS:', monitor.getCurrentFPS())
console.log('Is performing well:', monitor.isPerformantWell())
```

### Optimization Tips
1. **Reduce animation complexity** if FPS drops below 50
2. **Use reduced-motion** for users with performance constraints
3. **Limit concurrent animations** on lower-end devices
4. **Monitor memory usage** with the storage stats utility

## Persistence System

### LocalStorage Caching
The system caches lamp states in localStorage for:
- **Offline resilience**: Works even when API is unavailable
- **Instant UI**: Shows cached data immediately while fetching fresh data
- **State preservation**: Maintains state across page refreshes

### Cache Strategy
1. **Immediate Display**: Show cached data on page load
2. **Background Refresh**: Fetch fresh data from API
3. **Smart Merging**: Cache takes precedence for recent updates
4. **Expiration**: Cache expires after 5 minutes

### Cache Management
```typescript
import { 
  saveLampStatesToStorage, 
  getLampStatesFromStorage,
  clearLampStatesFromStorage 
} from '../lib/lamp-storage'

// Save current states
saveLampStatesToStorage(lamps)

// Retrieve cached states
const cached = getLampStatesFromStorage()

// Clear cache if needed
clearLampStatesFromStorage()
```

## Accessibility Features

### Screen Reader Support
- **ARIA Live Regions**: Announces status changes to screen readers
- **Semantic HTML**: Proper use of headings, landmarks, and roles
- **Descriptive Labels**: Clear button and image descriptions
- **Status Announcements**: "已点亮" (lit) state announcements

### Reduced Motion
- **Detection**: Automatically detects `prefers-reduced-motion`
- **Alternative Styles**: Static styles for motion-sensitive users
- **Graceful Degradation**: Maintains functionality without animations

### Keyboard Navigation
- **Focus Management**: Visible focus outlines on interactive elements
- **Tab Order**: Logical navigation sequence
- **Keyboard Access**: All functions accessible via keyboard

### Focus Styles
```css
.lamp-button:focus {
  outline: 2px solid #fb923c;
  outline-offset: 2px;
}
```

## Error Handling

### Toast Notifications
The system includes a comprehensive toast notification system:

```typescript
import { toast } from '../lib/toast'

// Success message
toast.success('支付成功', '祈福灯已点亮')

// Error message
toast.error('购买失败', '请重试')

// Info message
toast.info('使用缓存数据', '网络连接异常')

// Warning message
toast.warning('即将过期', '请及时完成支付')
```

### Error Recovery
- **Graceful Fallbacks**: Uses cached data when API fails
- **User Feedback**: Clear error messages with retry options
- **State Recovery**: Maintains UI state during errors
- **Network Resilience**: Handles intermittent connectivity issues

## Testing

### Unit Tests
The system includes comprehensive unit tests:

```bash
# Run all tests
npm test

# Run specific test files
npm test lib/lamp-animations.test.ts
npm test lib/lamp-storage.test.ts
npm test lib/toast.test.ts
```

### Test Coverage
- **Animation Utilities**: Class management and performance monitoring
- **Storage System**: Caching, merging, and error handling
- **Toast System**: Message display and user interactions
- **Accessibility**: Screen reader announcements and reduced motion

### Performance Testing
Monitor animation performance with built-in tools:

```typescript
// Enable performance monitoring
const monitor = AnimationPerformanceMonitor.getInstance()
monitor.startMonitoring()

// Check performance
if (!monitor.isPerformantWell()) {
  console.warn('Animation performance below optimal')
}
```

## Browser Compatibility

### Supported Browsers
- **Chrome/Chromium**: 80+
- **Firefox**: 75+
- **Safari**: 13+
- **Edge**: 80+

### CSS Features Used
- **CSS Grid**: Layout system
- **CSS Custom Properties**: Dynamic styling
- **CSS Animations**: Smooth transitions
- **Media Queries**: Responsive design
- **Backdrop Filter**: Modern blur effects

### JavaScript Features
- **ES6+**: Modern JavaScript syntax
- **Async/Await**: Promise handling
- **LocalStorage**: Client-side storage
- **RequestAnimationFrame**: Smooth animations
- **Intersection Observer**: Performance optimization

## Troubleshooting

### Common Issues

#### Animations Not Working
1. Check CSS file path: `/public/lamp-animations.css`
2. Verify Tailwind CSS is properly configured
3. Ensure JavaScript modules are loading correctly

#### Cache Issues
1. Clear browser localStorage
2. Check storage quota availability
3. Verify cache expiration logic

#### Performance Issues
1. Monitor FPS with performance monitor
2. Reduce animation complexity
3. Enable reduced motion for performance-sensitive users

#### Accessibility Issues
1. Test with screen readers (NVDA, VoiceOver)
2. Verify keyboard navigation
3. Check color contrast ratios

### Debug Mode
Enable debug logging:

```typescript
// Enable performance monitoring
const monitor = AnimationPerformanceMonitor.getInstance()
monitor.startMonitoring()

// Check storage stats
import { getStorageStats } from '../lib/lamp-storage'
console.log('Storage usage:', getStorageStats())
```

## Future Enhancements

### Planned Features
1. **WebP Images**: Optimized image formats
2. **Service Worker**: Offline-first architecture
3. **Web Animations API**: JavaScript-controlled animations
4. **Custom Themes**: User-selectable color schemes
5. **Animation Presets**: Pre-defined animation styles

### Performance Improvements
1. **Lazy Loading**: Load animations on-demand
2. **Web Workers**: Background processing
3. **Memory Optimization**: Reduce memory footprint
4. **GPU Acceleration**: Enhanced GPU utilization

### Accessibility Enhancements
1. **Voice Commands**: Voice control support
2. **High Contrast Mode**: Enhanced visibility
3. **Text Scaling**: Better typography scaling
4. **Gesture Support**: Touch-friendly interactions

## Contributing

When contributing to the animation system:

1. **Test thoroughly**: Include unit tests for new features
2. **Performance first**: Monitor FPS and memory usage
3. **Accessibility**: Ensure screen reader compatibility
4. **Documentation**: Update this README with changes
5. **Browser testing**: Test across supported browsers

## Resources

- [Web Performance Best Practices](https://web.dev/performance/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [CSS Animation Performance](https://developer.mozilla.org/en-US/docs/Web/Performance/CSS_JavaScript_animation_performance)
- [LocalStorage Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API)
