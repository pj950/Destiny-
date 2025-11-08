import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  saveLampStatesToStorage,
  getLampStatesFromStorage,
  clearLampStatesFromStorage,
  updateLampStateInStorage,
  mergeLampStates,
  isLocalStorageAvailable
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

describe('Lamp Storage Utilities (Simplified)', () => {
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
        { lamp_key: 'lamp_1', status: 'lit' as const, last_updated: '2024-01-01T00:00:00Z' },
        { lamp_key: 'lamp_2', status: 'unlit' as const, last_updated: '2024-01-01T00:00:00Z' }
      ]

      saveLampStatesToStorage(lamps)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'eastern-destiny-lamps',
        expect.stringContaining('"lamps"')
      )
    })
  })

  describe('getLampStatesFromStorage', () => {
    it('should retrieve valid lamp states from storage', () => {
      const lamps = [
        { lamp_key: 'lamp_1', status: 'lit' as const, last_updated: '2024-01-01T00:00:00Z' }
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
  })

  describe('clearLampStatesFromStorage', () => {
    it('should clear lamp states from storage', () => {
      localStorageMock.setItem('eastern-destiny-lamps', 'some data')

      clearLampStatesFromStorage()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('eastern-destiny-lamps')
    })
  })

  describe('updateLampStateInStorage', () => {
    it('should update existing lamp state', () => {
      const existingLamps = [
        { lamp_key: 'lamp_1', status: 'unlit' as const, last_updated: '2024-01-01T00:00:00Z' }
      ]

      localStorageMock.setItem('eastern-destiny-lamps', JSON.stringify({
        lamps: existingLamps,
        version: '1.0.0',
        timestamp: Date.now()
      }))

      updateLampStateInStorage('lamp_1', 'lit')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'eastern-destiny-lamps',
        expect.stringContaining('"status":"lit"')
      )
    })

    it('should add new lamp state if not exists', () => {
      updateLampStateInStorage('lamp_1', 'lit')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'eastern-destiny-lamps',
        expect.stringContaining('"lamp_key":"lamp_1"')
      )
    })
  })

  describe('mergeLampStates', () => {
    it('should merge API data with cache data', () => {
      const apiLamps = [
        { lamp_key: 'lamp_1', status: 'unlit' as const, last_updated: '2024-01-01T00:00:00Z' },
        { lamp_key: 'lamp_2', status: 'unlit' as const, last_updated: '2024-01-01T00:00:00Z' }
      ]

      const cacheLamps = [
        { lamp_key: 'lamp_1', status: 'lit' as const, last_updated: '2024-01-01T01:00:00Z' }, // More recent
        { lamp_key: 'lamp_3', status: 'lit' as const, last_updated: '2024-01-01T00:00:00Z' } // Not in API
      ]

      const result = mergeLampStates(apiLamps, cacheLamps)

      expect(result).toHaveLength(3)
      expect(result.find(l => l.lamp_key === 'lamp_1')?.status).toBe('lit') // Cache wins
      expect(result.find(l => l.lamp_key === 'lamp_2')?.status).toBe('unlit') // API data
      expect(result.find(l => l.lamp_key === 'lamp_3')?.status).toBe('lit') // Cache only
    })

    it('should use API data when cache is older', () => {
      const apiLamps = [
        { lamp_key: 'lamp_1', status: 'lit' as const, last_updated: '2024-01-01T02:00:00Z' }
      ]

      const cacheLamps = [
        { lamp_key: 'lamp_1', status: 'unlit' as const, last_updated: '2024-01-01T01:00:00Z' } // Older
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
  })
})
