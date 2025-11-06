/**
 * Toast notification system for user feedback
 * Provides accessible, non-intrusive notifications
 */

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ToastOptions {
  duration?: number
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left'
  persistent?: boolean
}

class ToastManager {
  private static instance: ToastManager
  private toasts: ToastMessage[] = []
  private listeners: ((toasts: ToastMessage[]) => void)[] = []
  private timeouts: Map<string, NodeJS.Timeout> = new Map()

  static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager()
    }
    return ToastManager.instance
  }

  subscribe(listener: (toasts: ToastMessage[]) => void): () => void {
    this.listeners.push(listener)
    listener(this.toasts)
    
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.toasts))
  }

  add(toast: Omit<ToastMessage, 'id'>, options: ToastOptions = {}): string {
    const id = this.generateId()
    const duration = options.persistent ? 0 : (toast.duration || options.duration || 5000)
    
    const newToast: ToastMessage = {
      ...toast,
      id
    }
    
    this.toasts.push(newToast)
    this.notifyListeners()
    
    // Auto-remove after duration
    if (duration > 0) {
      const timeout = setTimeout(() => {
        this.remove(id)
      }, duration)
      
      this.timeouts.set(id, timeout)
    }
    
    // Announce to screen readers
    this.announceToScreenReader(newToast)
    
    return id
  }

  remove(id: string): void {
    const index = this.toasts.findIndex(toast => toast.id === id)
    if (index > -1) {
      this.toasts.splice(index, 1)
      this.notifyListeners()
    }
    
    // Clear timeout if exists
    const timeout = this.timeouts.get(id)
    if (timeout) {
      clearTimeout(timeout)
      this.timeouts.delete(id)
    }
  }

  clear(): void {
    this.toasts = []
    this.timeouts.forEach(timeout => clearTimeout(timeout))
    this.timeouts.clear()
    this.notifyListeners()
  }

  private generateId(): string {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private announceToScreenReader(toast: ToastMessage): void {
    if (typeof document === 'undefined') return
    
    const announcement = `${toast.title}${toast.message ? ': ' + toast.message : ''}`
    
    // Create or update live region
    let liveRegion = document.getElementById('toast-live-region')
    if (!liveRegion) {
      liveRegion = document.createElement('div')
      liveRegion.id = 'toast-live-region'
      liveRegion.setAttribute('aria-live', 'polite')
      liveRegion.setAttribute('aria-atomic', 'true')
      liveRegion.className = 'sr-only'
      document.body.appendChild(liveRegion)
    }
    
    liveRegion.textContent = announcement
  }
}

// Export singleton instance
export const toastManager = ToastManager.getInstance()

// Convenience functions
export const toast = {
  success: (title: string, message?: string, options?: ToastOptions) =>
    toastManager.add({ type: 'success', title, message }, options),
  
  error: (title: string, message?: string, options?: ToastOptions) =>
    toastManager.add({ type: 'error', title, message }, options),
  
  warning: (title: string, message?: string, options?: ToastOptions) =>
    toastManager.add({ type: 'warning', title, message }, options),
  
  info: (title: string, message?: string, options?: ToastOptions) =>
    toastManager.add({ type: 'info', title, message }, options),
  
  dismiss: (id: string) => toastManager.remove(id),
  
  clear: () => toastManager.clear()
}

import React from 'react'

// React hook for using toasts
export function useToast() {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([])
  
  React.useEffect(() => {
    const unsubscribe = toastManager.subscribe(setToasts)
    return unsubscribe
  }, [])
  
  return {
    toasts,
    add: toastManager.add.bind(toastManager),
    remove: toastManager.remove.bind(toastManager),
    clear: toastManager.clear.bind(toastManager),
    success: toast.success,
    error: toast.error,
    warning: toast.warning,
    info: toast.info,
    dismiss: toast.dismiss
  }
}
