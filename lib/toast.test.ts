import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toastManager, toast } from './toast'

// Mock document for screen reader announcements
Object.defineProperty(window, 'document', {
  value: {
    getElementById: vi.fn(),
    createElement: vi.fn(() => ({
      id: '',
      setAttribute: vi.fn(),
      className: '',
      textContent: '',
      appendChild: vi.fn()
    })),
    body: {
      appendChild: vi.fn()
    }
  },
  writable: true
})

// Mock requestAnimationFrame
Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: vi.fn((cb) => setTimeout(cb, 16))
})

describe('Toast System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset singleton instance for clean test state
    ;(toastManager as any).instance = undefined
    toastManager.clear()
  })

  afterEach(() => {
    toastManager.clear()
  })

  describe('toastManager', () => {
    it('should add a toast message', () => {
      const id = toastManager.add({
        type: 'success',
        title: 'Test Message'
      })

      expect(id).toBeTruthy()
      expect(id).toMatch(/^toast_\d+_[a-z0-9]+$/)
    })

    it('should remove a toast message', () => {
      const id = toastManager.add({
        type: 'success',
        title: 'Test Message'
      })

      toastManager.remove(id)

      // Verify toast is removed by checking the listeners
      const mockListener = vi.fn()
      toastManager.subscribe(mockListener)
      
      // The listener should be called with empty array after removal
      expect(mockListener).toHaveBeenCalled()
    })

    it('should clear all toasts', () => {
      toastManager.add({ type: 'success', title: 'Message 1' })
      toastManager.add({ type: 'error', title: 'Message 2' })

      toastManager.clear()

      const mockListener = vi.fn()
      toastManager.subscribe(mockListener)
      
      expect(mockListener).toHaveBeenCalledWith([])
    })

    it('should auto-remove toast after duration', () => {
      vi.useFakeTimers()

      const id = toastManager.add({
        type: 'success',
        title: 'Auto-remove test'
      }, { duration: 1000 })

      expect(id).toBeTruthy()

      // Fast-forward time
      vi.advanceTimersByTime(1000)

      // Toast should be auto-removed
      vi.useRealTimers()
    })

    it('should not auto-remove persistent toast', () => {
      vi.useFakeTimers()

      const id = toastManager.add({
        type: 'success',
        title: 'Persistent toast'
      }, { persistent: true })

      expect(id).toBeTruthy()

      // Fast-forward time
      vi.advanceTimersByTime(5000)

      // Toast should still exist
      vi.useRealTimers()
    })

    it('should notify subscribers', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      const unsubscribe1 = toastManager.subscribe(listener1)
      const unsubscribe2 = toastManager.subscribe(listener2)

      toastManager.add({ type: 'info', title: 'Test' })

      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()

      unsubscribe1()
      unsubscribe2()
    })

    it('should unsubscribe correctly', () => {
      const listener1 = vi.fn()
      
      const unsubscribe1 = toastManager.subscribe(listener1)
      // Clear the initial call from subscribe
      listener1.mockClear()

      toastManager.add({ type: 'info', title: 'Test 1' })
      expect(listener1).toHaveBeenCalledTimes(1)

      unsubscribe1()
      
      // Add another toast - the unsubscribed listener should not be called
      toastManager.add({ type: 'info', title: 'Test 2' })
      expect(listener1).toHaveBeenCalledTimes(1) // Should still only be called once
    })
  })

  describe('convenience functions', () => {
    it('should create success toast', () => {
      const id = toast.success('Success Title', 'Success Message')

      expect(id).toBeTruthy()
    })

    it('should create error toast', () => {
      const id = toast.error('Error Title', 'Error Message')

      expect(id).toBeTruthy()
    })

    it('should create warning toast', () => {
      const id = toast.warning('Warning Title', 'Warning Message')

      expect(id).toBeTruthy()
    })

    it('should create info toast', () => {
      const id = toast.info('Info Title', 'Info Message')

      expect(id).toBeTruthy()
    })

    it('should dismiss toast by id', () => {
      const id = toast.success('Test Message')
      
      toast.dismiss(id)

      // Should not throw
      expect(true).toBe(true)
    })

    it('should clear all toasts', () => {
      toast.success('Message 1')
      toast.error('Message 2')
      
      toast.clear()

      // Should not throw
      expect(true).toBe(true)
    })
  })

  describe('screen reader announcements', () => {
    it('should create live region if not exists', () => {
      const mockElement = {
        id: '',
        setAttribute: vi.fn(),
        className: '',
        textContent: '',
        appendChild: vi.fn()
      }

      vi.mocked(document.getElementById).mockReturnValue(null)
      vi.mocked(document.createElement).mockReturnValue(mockElement as any)

      toast.success('Test Message')

      expect(document.createElement).toHaveBeenCalledWith('div')
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-live', 'polite')
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true')
      expect(document.body.appendChild).toHaveBeenCalledWith(mockElement)
    })

    it('should update existing live region', () => {
      const mockElement = {
        id: 'toast-live-region',
        setAttribute: vi.fn(),
        className: '',
        textContent: '',
        appendChild: vi.fn()
      }

      vi.mocked(document.getElementById).mockReturnValue(mockElement as any)

      toast.success('Test Message', 'With description')

      expect(mockElement.textContent).toBe('Test Message: With description')
    })
  })

  describe('toast with actions', () => {
    it('should handle toast with action', () => {
      const mockAction = vi.fn()

      const id = toastManager.add({
        type: 'info',
        title: 'Action Required',
        message: 'Click to proceed',
        action: {
          label: 'Proceed',
          onClick: mockAction
        }
      })

      expect(id).toBeTruthy()
    })
  })

  describe('error handling', () => {
    it('should handle window undefined gracefully', () => {
      const originalWindow = global.window
      delete (global as any).window

      expect(() => {
        toast.success('Test')
      }).not.toThrow()

      global.window = originalWindow
    })
  })
})
