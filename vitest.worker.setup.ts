import { config } from 'dotenv'

// Load test environment variables
config({ path: '.env.test' })

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log
const originalConsoleError = console.error

console.log = (...args: any[]) => {
  // Only show logs that contain [Worker] to reduce noise
  if (args.some(arg => typeof arg === 'string' && arg.includes('[Worker]'))) {
    originalConsoleLog(...args)
  }
}

console.error = (...args: any[]) => {
  // Only show errors that contain [Worker] to reduce noise
  if (args.some(arg => typeof arg === 'string' && arg.includes('[Worker]'))) {
    originalConsoleError(...args)
  }
}