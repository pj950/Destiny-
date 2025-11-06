/**
 * Utility functions for managing prayer lamp animations
 * Provides performance-optimized animation class management with accessibility support
 */

export interface AnimationConfig {
  /** Base animation class for lit lamps */
  litClass: string
  /** Animation class for purchasing state */
  purchasingClass: string
  /** Reduced motion variant classes */
  reducedMotion?: {
    litClass: string
    purchasingClass: string
  }
}

export const LAMP_ANIMATION_CONFIG: AnimationConfig = {
  litClass: 'lamp-lit',
  purchasingClass: 'lamp-purchasing',
  reducedMotion: {
    litClass: 'lamp-lit-reduced-motion',
    purchasingClass: 'lamp-purchasing-reduced-motion'
  }
}

/**
 * Checks if user prefers reduced motion
 * @returns boolean indicating if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Gets appropriate animation classes based on lamp state and user preferences
 * @param state - Current lamp state
 * @param config - Animation configuration
 * @returns Object with appropriate CSS classes
 */
export function getLampAnimationClasses(
  state: 'unlit' | 'purchasing' | 'lit',
  config: AnimationConfig = LAMP_ANIMATION_CONFIG
): { container: string; image: string; overlay: string } {
  const useReducedMotion = prefersReducedMotion()
  
  switch (state) {
    case 'lit':
      return {
        container: useReducedMotion && config.reducedMotion 
          ? config.reducedMotion.litClass 
          : config.litClass,
        image: 'lamp-image-lit',
        overlay: 'lamp-overlay-lit'
      }
    
    case 'purchasing':
      return {
        container: useReducedMotion && config.reducedMotion 
          ? config.reducedMotion.purchasingClass 
          : config.purchasingClass,
        image: 'lamp-image-purchasing',
        overlay: 'lamp-overlay-purchasing'
      }
    
    default:
      return {
        container: '',
        image: '',
        overlay: ''
      }
  }
}

/**
 * Toggles animation classes on DOM elements with performance optimization
 * Uses requestAnimationFrame for smooth transitions
 * @param element - DOM element to modify
 * @param classes - Object with class names to apply
 * @param previousClasses - Previous classes to remove (optional)
 */
export function toggleAnimationClasses(
  element: HTMLElement,
  classes: { container: string; image: string; overlay: string },
  previousClasses?: { container: string; image: string; overlay: string }
): void {
  if (!element) return
  
  // Use requestAnimationFrame for smooth performance
  requestAnimationFrame(() => {
    // Remove previous classes if provided
    if (previousClasses) {
      Object.values(previousClasses).forEach(cls => {
        if (cls) element.classList.remove(cls)
      })
    }
    
    // Add new classes
    Object.values(classes).forEach(cls => {
      if (cls) element.classList.add(cls)
    })
  })
}

/**
 * Creates a performance-optimized flicker effect for candle simulation
 * Returns CSS animation keyframes dynamically
 * @param intensity - Flicker intensity (0.1 to 1.0)
 * @returns CSS keyframes string
 */
export function createFlickerKeyframes(intensity: number = 0.3): string {
  const scaledIntensity = Math.max(0.1, Math.min(1.0, intensity))
  
  return `
    @keyframes candle-flicker {
      0%, 100% { 
        opacity: ${1 - scaledIntensity * 0.1}; 
        transform: scale(1) translateY(0); 
      }
      25% { 
        opacity: ${1 - scaledIntensity * 0.3}; 
        transform: scale(${1 + scaledIntensity * 0.02}) translateY(-${scaledIntensity}px); 
      }
      50% { 
        opacity: ${1 - scaledIntensity * 0.2}; 
        transform: scale(${1 - scaledIntensity * 0.01}) translateY(${scaledIntensity * 0.5}px); 
      }
      75% { 
        opacity: ${1 - scaledIntensity * 0.4}; 
        transform: scale(${1 + scaledIntensity * 0.01}) translateY(-${scaledIntensity * 0.3}px); 
      }
    }
  `
}

/**
 * Creates a soft glow effect with configurable parameters
 * @param color - Glow color (default: orange)
 * @param size - Glow size multiplier (default: 1)
 * @returns CSS string for glow effect
 */
export function createGlowEffect(
  color: 'orange' | 'yellow' | 'blue' | 'green' = 'orange',
  size: number = 1
): string {
  const colors = {
    orange: '251, 146, 60',
    yellow: '250, 204, 21',
    blue: '59, 130, 246',
    green: '34, 197, 94'
  }
  
  const rgbString = colors[color]
  const scaledSize = Math.max(0.5, Math.min(3, size))
  
  return `
    box-shadow: 
      0 0 ${20 * scaledSize}px rgba(${rgbString}, 0.3),
      0 0 ${40 * scaledSize}px rgba(${rgbString}, 0.2),
      0 0 ${60 * scaledSize}px rgba(${rgbString}, 0.1);
  `
}

/**
 * Performance monitoring for animations
 * Tracks frame rate and provides optimization suggestions
 */
export class AnimationPerformanceMonitor {
  private static instance: AnimationPerformanceMonitor
  private frameCount = 0
  private lastTime = 0
  private fps = 60
  private isMonitoring = false
  
  static getInstance(): AnimationPerformanceMonitor {
    if (!AnimationPerformanceMonitor.instance) {
      AnimationPerformanceMonitor.instance = new AnimationPerformanceMonitor()
    }
    return AnimationPerformanceMonitor.instance
  }
  
  startMonitoring(): void {
    if (this.isMonitoring || typeof window === 'undefined') return
    
    this.isMonitoring = true
    this.lastTime = performance.now()
    
    const measure = () => {
      if (!this.isMonitoring) return
      
      this.frameCount++
      const currentTime = performance.now()
      
      if (currentTime - this.lastTime >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime))
        this.frameCount = 0
        this.lastTime = currentTime
        
        // Log performance warnings
        if (this.fps < 30) {
          console.warn(`[AnimationPerformance] Low FPS detected: ${this.fps}`)
        }
      }
      
      requestAnimationFrame(measure)
    }
    
    requestAnimationFrame(measure)
  }
  
  stopMonitoring(): void {
    this.isMonitoring = false
  }
  
  getCurrentFPS(): number {
    return this.fps
  }
  
  isPerformantWell(): boolean {
    return this.fps >= 50
  }
}
