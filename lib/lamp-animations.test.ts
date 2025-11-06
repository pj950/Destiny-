import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  LAMP_ANIMATION_CONFIG,
  prefersReducedMotion,
  getLampAnimationClasses,
  toggleAnimationClasses,
  createFlickerKeyframes,
  createGlowEffect,
  AnimationPerformanceMonitor
} from './lamp-animations'

// Mock window and matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock requestAnimationFrame
Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: vi.fn((cb) => setTimeout(cb, 16)), // ~60fps
})

// Mock performance
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: vi.fn(() => Date.now()),
  },
})

describe('Lamp Animation Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('prefersReducedMotion', () => {
    it('should return false when reduced motion is not preferred', () => {
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      expect(prefersReducedMotion()).toBe(false)
    })

    it('should return true when reduced motion is preferred', () => {
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      expect(prefersReducedMotion()).toBe(true)
    })

    it('should return false when window is undefined', () => {
      const originalWindow = global.window
      delete (global as any).window
      
      expect(prefersReducedMotion()).toBe(false)
      
      global.window = originalWindow
    })
  })

  describe('getLampAnimationClasses', () => {
    beforeEach(() => {
      // Reset mock to return false for reduced motion
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })
    })

    it('should return correct classes for lit state', () => {
      const classes = getLampAnimationClasses('lit')
      
      expect(classes.container).toBe('lamp-lit')
      expect(classes.image).toBe('lamp-image-lit')
      expect(classes.overlay).toBe('lamp-overlay-lit')
    })

    it('should return correct classes for purchasing state', () => {
      const classes = getLampAnimationClasses('purchasing')
      
      expect(classes.container).toBe('lamp-purchasing')
      expect(classes.image).toBe('lamp-image-purchasing')
      expect(classes.overlay).toBe('lamp-overlay-purchasing')
    })

    it('should return empty classes for unlit state', () => {
      const classes = getLampAnimationClasses('unlit')
      
      expect(classes.container).toBe('')
      expect(classes.image).toBe('')
      expect(classes.overlay).toBe('')
    })

    it('should use reduced motion classes when preferred', () => {
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      const classes = getLampAnimationClasses('lit')
      
      expect(classes.container).toBe('lamp-lit-reduced-motion')
      expect(classes.image).toBe('lamp-image-lit')
      expect(classes.overlay).toBe('lamp-overlay-lit')
    })

    it('should use custom config when provided', () => {
      const customConfig = {
        litClass: 'custom-lit',
        purchasingClass: 'custom-purchasing',
        reducedMotion: {
          litClass: 'custom-lit-reduced',
          purchasingClass: 'custom-purchasing-reduced'
        }
      }

      const classes = getLampAnimationClasses('lit', customConfig)
      
      expect(classes.container).toBe('custom-lit')
      expect(classes.image).toBe('lamp-image-lit')
      expect(classes.overlay).toBe('lamp-overlay-lit')
    })
  })

  describe('toggleAnimationClasses', () => {
    it('should add classes to element', async () => {
      const element = document.createElement('div')
      const classes = {
        container: 'test-container',
        image: 'test-image',
        overlay: 'test-overlay'
      }

      toggleAnimationClasses(element, classes)

      // Wait for requestAnimationFrame to complete
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(element.classList.contains('test-container')).toBe(true)
      expect(element.classList.contains('test-image')).toBe(true)
      expect(element.classList.contains('test-overlay')).toBe(true)
    })

    it('should remove previous classes and add new ones', async () => {
      const element = document.createElement('div')
      const previousClasses = {
        container: 'old-container',
        image: 'old-image',
        overlay: 'old-overlay'
      }
      const newClasses = {
        container: 'new-container',
        image: 'new-image',
        overlay: 'new-overlay'
      }

      // Add initial classes
      toggleAnimationClasses(element, previousClasses)
      
      // Wait for requestAnimationFrame
      await new Promise(resolve => setTimeout(resolve, 20))
      
      // Toggle to new classes
      toggleAnimationClasses(element, newClasses, previousClasses)

      // Wait for requestAnimationFrame
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(element.classList.contains('old-container')).toBe(false)
      expect(element.classList.contains('old-image')).toBe(false)
      expect(element.classList.contains('old-overlay')).toBe(false)
      
      expect(element.classList.contains('new-container')).toBe(true)
      expect(element.classList.contains('new-image')).toBe(true)
      expect(element.classList.contains('new-overlay')).toBe(true)
    })

    it('should handle null element gracefully', () => {
      const classes = {
        container: 'test-container',
        image: 'test-image',
        overlay: 'test-overlay'
      }

      expect(() => {
        toggleAnimationClasses(null as any, classes)
      }).not.toThrow()
    })

    it('should use requestAnimationFrame', () => {
      const element = document.createElement('div')
      const classes = {
        container: 'test-container',
        image: 'test-image',
        overlay: 'test-overlay'
      }

      toggleAnimationClasses(element, classes)

      expect(window.requestAnimationFrame).toHaveBeenCalled()
    })
  })

  describe('createFlickerKeyframes', () => {
    it('should create flicker keyframes with default intensity', () => {
      const keyframes = createFlickerKeyframes()
      
      expect(keyframes).toContain('@keyframes candle-flicker')
      expect(keyframes).toContain('opacity:')
      expect(keyframes).toContain('transform:')
    })

    it('should scale intensity correctly', () => {
      const lowIntensity = createFlickerKeyframes(0.1)
      const highIntensity = createFlickerKeyframes(0.8)
      
      expect(lowIntensity).toContain('opacity: 0.99')
      expect(highIntensity).toContain('opacity: 0.6')
    })

    it('should clamp intensity to valid range', () => {
      const tooLow = createFlickerKeyframes(-1)
      const tooHigh = createFlickerKeyframes(2)
      
      expect(tooLow).toContain('opacity: 0.99')
      expect(tooHigh).toContain('opacity: 0.6')
    })
  })

  describe('createGlowEffect', () => {
    it('should create orange glow by default', () => {
      const glow = createGlowEffect()
      
      expect(glow).toContain('251, 146, 60')
      expect(glow).toContain('box-shadow:')
    })

    it('should create glow for different colors', () => {
      const yellowGlow = createGlowEffect('yellow')
      const blueGlow = createGlowEffect('blue')
      
      expect(yellowGlow).toContain('250, 204, 21')
      expect(blueGlow).toContain('59, 130, 246')
    })

    it('should scale size correctly', () => {
      const smallGlow = createGlowEffect('orange', 0.5)
      const largeGlow = createGlowEffect('orange', 2)
      
      expect(smallGlow).toContain('0 0 10px')
      expect(largeGlow).toContain('0 0 40px')
    })

    it('should clamp size to valid range', () => {
      const tooSmall = createGlowEffect('orange', 0.1)
      const tooLarge = createGlowEffect('orange', 5)
      
      expect(tooSmall).toContain('0 0 10px')
      expect(tooLarge).toContain('0 0 60px')
    })
  })

  describe('AnimationPerformanceMonitor', () => {
    let monitor: AnimationPerformanceMonitor

    beforeEach(() => {
      monitor = AnimationPerformanceMonitor.getInstance()
      vi.useFakeTimers()
    })

    afterEach(() => {
      monitor.stopMonitoring()
      vi.useRealTimers()
    })

    it('should be a singleton', () => {
      const monitor1 = AnimationPerformanceMonitor.getInstance()
      const monitor2 = AnimationPerformanceMonitor.getInstance()
      
      expect(monitor1).toBe(monitor2)
    })

    it('should start monitoring', () => {
      monitor.startMonitoring()
      
      expect(monitor.getCurrentFPS()).toBeDefined()
    })

    it('should stop monitoring', () => {
      monitor.startMonitoring()
      monitor.stopMonitoring()
      
      // Advance time to check if monitoring stopped
      vi.advanceTimersByTime(1000)
      
      // Should not throw error
      expect(monitor.getCurrentFPS()).toBeDefined()
    })

    it('should calculate FPS correctly', () => {
      monitor.startMonitoring()
      
      // Simulate 60 frames in 1 second
      for (let i = 0; i < 60; i++) {
        vi.advanceTimersByTime(16) // ~60fps
      }
      
      expect(monitor.getCurrentFPS()).toBe(60)
    })

    it('should detect performance issues', () => {
      monitor.startMonitoring()
      
      // Manually set low FPS for testing
      monitor['fps'] = 25
      
      expect(monitor.isPerformantWell()).toBe(false)
    })

    it('should detect good performance', () => {
      monitor.startMonitoring()
      
      // Manually set high FPS for testing
      monitor['fps'] = 60
      
      expect(monitor.isPerformantWell()).toBe(true)
    })
  })
})
