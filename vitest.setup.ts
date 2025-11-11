import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Make React available globally
global.React = React

// Mock environment variables that are required
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.RAZORPAY_KEY_ID = 'test-key-id'
process.env.RAZORPAY_KEY_SECRET = 'test-key-secret'

// Mock React
vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return {
    ...actual,
    // Add any React mocks if needed
  }
})

// Setup globals for Jest compatibility
Object.defineProperty(window, 'jest', {
  value: vi,
  writable: true
})