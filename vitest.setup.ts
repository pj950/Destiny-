import '@testing-library/jest-dom'
import { vi } from 'vitest'

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