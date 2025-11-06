import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  saveLampStatesToStorage,
  getLampStatesFromStorage,
  clearLampStatesFromStorage,
  updateLampStateInStorage,
  mergeLampStates,
  isLocalStorageAvailable,
  getStorageStats
} from './lamp-storage'

// Mock localStorage
let localStorageStore: Record<string, string> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key]
  }),
  clear: vi.fn(() => {
    localStorageStore = {}
  }),
  get length() {
    return Object.keys(localStorageStore).length
  },
  key: vi.fn((index: number) => {
    const keys = Object.keys(localStorageStore)
    return keys[index] || null
  })
}

// Mock window object
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

describe('Lamp Storage Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageStore = {}
    localStorageMock.clear()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('saveLampStatesToStorage', () => {
    it('should save lamp states to localStorage', () => {
      const lamps = [
        { lamp_key: 'p1', status: 'lit' as const, last_updated: '2024-01-01T00:00:00Z' },
        { lamp_key: 'p2', status: 'unlit' as const, last_updated: '2024-01-01T00:00:00Z' }
      ]

      saveLampStatesToStorage(lamps)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'eastern-destiny-lamps',
        expect.stringContaining('"lamps"')
      )
    })

    it('should handle window undefined gracefully', () => {
      const originalWindow = global.window
      delete (global as any).window

      expect(() => {
        saveLampStatesToStorage([])
      }).not.toThrow()

      global.window = originalWindow
    })

    it('should handle localStorage errors gracefully', () => {
      const originalSetItem = localStorageMock.setItem
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      expect(() => {
        saveLampStatesToStorage([])
      }).not.toThrow()

      // Restore mock
      localStorageMock.setItem = originalSetItem
    })
  })

  describe('getLampStatesFromStorage', () => {
    it('should retrieve valid lamp states from storage', () => {
      const lamps = [
        { lamp_key: 'p1', status: 'lit' as const, last_updated: '2024-01-01T00:00:00Z' }
      ]

      localStorageMock.setItem('eastern-destiny-lamps', JSON.stringify({
        lamps,
        version: '1.0.0',
        timestamp: Date.now()
      }))

      const result = getLampStatesFromStorage()
      expect(result).toEqual(lamps)
    })

    it('should return null for invalid storage data', () => {
      localStorageMock.setItem('eastern-destiny-lamps', 'invalid json')

      const result = getLampStatesFromStorage()
      expect(result).toBeNull()
    })

    it('should return null for expired cache', () => {
      const expiredData = {
        lamps: [],
        version: '1.0.0',
        timestamp: Date.now() - (6 * 60 * 1000) // 6 minutes ago
      }

      localStorageMock.setItem('eastern-destiny-lamps', JSON.stringify(expiredData))

      const result = getLampStatesFromStorage()
      expect(result).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('eastern-destiny-lamps')
    })

    it('should return null for version mismatch', () => {
      const wrongVersionData = {
        lamps: [],
        version: '2.0.0',
        timestamp: Date.now()
      }

      localStorageMock.setItem('eastern-destiny-lamps', JSON.stringify(wrongVersionData))

      const result = getLampStatesFromStorage()
      expect(result).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('eastern-destiny-lamps')
    })

    it('should return null when window is undefined', () => {
      const originalWindow = global.window
      delete (global as any).window

      const result = getLampStatesFromStorage()
      expect(result).toBeNull()

      global.window = originalWindow
    })
  })

  describe('clearLampStatesFromStorage', () => {
    it('should clear lamp states from storage', () => {
      localStorageMock.setItem('eastern-destiny-lamps', 'some data')

      clearLampStatesFromStorage()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('eastern-destiny-lamps')
    })

    it('should handle window undefined gracefully', () => {
      const originalWindow = global.window
      delete (global as any).window

      expect(() => {
        clearLampStatesFromStorage()
      }).not.toThrow()

      global.window = originalWindow
    })
  })

  describe('updateLampStateInStorage', () => {
    it('should update existing lamp state', () => {
      const existingLamps = [
        { lamp_key: 'p1', status: 'unlit' as const, last_updated: '2024-01-01T00:00:00Z' }
      ]

      localStorageMock.setItem('eastern-destiny-lamps', JSON.stringify({
        lamps: existingLamps,
        version: '1.0.0',
        timestamp: Date.now()
      }))

      updateLampStateInStorage('p1', 'lit')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'eastern-destiny-lamps',
        expect.stringContaining('"status":"lit"')
      )
    })

    it('should add new lamp state if not exists', () => {
      updateLampStateInStorage('p1', 'lit')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'eastern-destiny-lamps',
        expect.stringContaining('"lamp_key":"p1"')
      )
    })
  })

  describe('mergeLampStates', () => {
    it('should merge API data with cache data', () => {
      const apiLamps = [
        { lamp_key: 'p1', status: 'unlit' as const, last_updated: '2024-01-01T00:00:00Z' },
        { lamp_key: 'p2', status: 'unlit' as const, last_updated: '2024-01-01T00:00:00Z' }
      ]

      const cacheLamps = [
        { lamp_key: 'p1', status: 'lit' as const, last_updated: '2024-01-01T01:00:00Z' }, // More recent
        { lamp_key: 'p3', status: 'lit' as const, last_updated: '2024-01-01T00:00:00Z' } // Not in API
      ]

      const result = mergeLampStates(apiLamps, cacheLamps)

      expect(result).toHaveLength(3)
      expect(result.find(l => l.lamp_key === 'p1')?.status).toBe('lit') // Cache wins
      expect(result.find(l => l.lamp_key === 'p2')?.status).toBe('unlit') // API data
      expect(result.find(l => l.lamp_key === 'p3')?.status).toBe('lit') // Cache only
    })

    it('should use API data when cache is older', () => {
      const apiLamps = [
        { lamp_key: 'p1', status: 'lit' as const, last_updated: '2024-01-01T02:00:00Z' }
      ]

      const cacheLamps = [
        { lamp_key: 'p1', status: 'unlit' as const, last_updated: '2024-01-01T01:00:00Z' } // Older
      ]

      const result = mergeLampStates(apiLamps, cacheLamps)

      expect(result[0].status).toBe('lit') // API wins
    })
  })

  describe('isLocalStorageAvailable', () => {
    it('should return true when localStorage is available', () => {
      expect(isLocalStorageAvailable()).toBe(true)
    })

    it('should return false when window is undefined', () => {
      const originalWindow = global.window
      delete (global as any).window

      expect(isLocalStorageAvailable()).toBe(false)

      global.window = originalWindow
    })

    it('should return false when localStorage throws error', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage disabled')
      })

      expect(isLocalStorageAvailable()).toBe(false)
    })
  })

  describe('getStorageStats', () => {
    it('should return storage statistics', () => {
      localStorageMock.setItem('test1', 'data1')
      localStorageMock.setItem('test2', 'data2')

      const stats = getStorageStats()

      expect(stats).toBeTruthy()
      expect(stats?.used).toBeGreaterThan(0)
      expect(stats?.available).toBe(5 * 1024 * 1024) // 5MB
      expect(stats?.percentage).toBeGreaterThanOrEqual(0)
    })

    it('should return null when window is undefined', () => {
      const originalWindow = global.window
      delete (global as any).window

      const stats = getStorageStats()
      expect(stats).toBeNull()

      global.window = originalWindow
    })

    it('should return null when localStorage is not available', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage disabled')
      })

      const stats = getStorageStats()
      expect(stats).toBeNull()
    })
  })
})
