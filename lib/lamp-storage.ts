/**
 * localStorage utility for prayer lamp state caching
 * Provides fallback storage when API is temporarily unavailable
 */

export interface LampState {
  lamp_key: string
  status: 'unlit' | 'lit'
  last_updated?: string
}

export interface LampStorageData {
  lamps: LampState[]
  version: string
  timestamp: number
}

const STORAGE_KEY = 'eastern-destiny-lamps'
const STORAGE_VERSION = '1.0.0'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Saves lamp states to localStorage with timestamp
 * @param lamps - Array of lamp states to cache
 */
export function saveLampStatesToStorage(lamps: LampState[]): void {
  if (typeof window === 'undefined') return
  
  try {
    const storageData: LampStorageData = {
      lamps,
      version: STORAGE_VERSION,
      timestamp: Date.now()
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData))
  } catch (error) {
    console.warn('[LampStorage] Failed to save lamp states:', error)
  }
}

/**
 * Retrieves lamp states from localStorage if cache is valid
 * @returns Array of lamp states or null if cache is invalid/expired
 */
export function getLampStatesFromStorage(): LampState[] | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    
    const data: LampStorageData = JSON.parse(stored)
    
    // Check version compatibility
    if (data.version !== STORAGE_VERSION) {
      console.warn('[LampStorage] Version mismatch, clearing cache')
      clearLampStatesFromStorage()
      return null
    }
    
    // Check cache expiration
    if (Date.now() - data.timestamp > CACHE_DURATION) {
      console.log('[LampStorage] Cache expired')
      clearLampStatesFromStorage()
      return null
    }
    
    return data.lamps
  } catch (error) {
    console.warn('[LampStorage] Failed to retrieve lamp states:', error)
    clearLampStatesFromStorage()
    return null
  }
}

/**
 * Clears lamp states from localStorage
 */
export function clearLampStatesFromStorage(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('[LampStorage] Failed to clear lamp states:', error)
  }
}

/**
 * Updates a single lamp state in localStorage
 * @param lampKey - The lamp key to update
 * @param status - New status for the lamp
 */
export function updateLampStateInStorage(lampKey: string, status: 'unlit' | 'lit'): void {
  const currentStates = getLampStatesFromStorage() || []
  
  const updatedStates = currentStates.map(lamp =>
    lamp.lamp_key === lampKey
      ? { ...lamp, status, last_updated: new Date().toISOString() }
      : lamp
  )
  
  // If lamp doesn't exist in storage, add it
  if (!updatedStates.some(lamp => lamp.lamp_key === lampKey)) {
    updatedStates.push({
      lamp_key: lampKey,
      status,
      last_updated: new Date().toISOString()
    })
  }
  
  saveLampStatesToStorage(updatedStates)
}

/**
 * Merges API data with localStorage cache (localStorage takes precedence for recently updated items)
 * @param apiLamps - Lamp states from API
 * @param cacheLamps - Lamp states from localStorage cache
 * @returns Merged lamp states
 */
export function mergeLampStates(
  apiLamps: LampState[],
  cacheLamps: LampState[]
): LampState[] {
  const merged = new Map<string, LampState>()
  
  // Add API data first
  apiLamps.forEach(lamp => {
    merged.set(lamp.lamp_key, lamp)
  })
  
  // Overlay cache data for more recent updates
  cacheLamps.forEach(cacheLamp => {
    const apiLamp = merged.get(cacheLamp.lamp_key)
    
    if (!apiLamp) {
      // Lamp not in API data, use cache
      merged.set(cacheLamp.lamp_key, cacheLamp)
    } else {
      // Use more recent update
      const cacheTime = cacheLamp.last_updated ? new Date(cacheLamp.last_updated).getTime() : 0
      const apiTime = apiLamp.last_updated ? new Date(apiLamp.last_updated).getTime() : 0
      
      if (cacheTime > apiTime) {
        merged.set(cacheLamp.lamp_key, cacheLamp)
      }
    }
  })
  
  return Array.from(merged.values())
}

/**
 * Checks if localStorage is available and functional
 * @returns boolean indicating if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    const test = '__storage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

/**
 * Gets storage usage statistics
 * @returns Object with storage usage info
 */
export function getStorageStats(): { used: number; available: number; percentage: number } | null {
  if (typeof window === 'undefined' || !isLocalStorageAvailable()) return null
  
  try {
    let used = 0
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length
      }
    }
    
    // Most browsers have ~5MB limit
    const available = 5 * 1024 * 1024 // 5MB in bytes
    const percentage = (used / available) * 100
    
    return { used, available, percentage }
  } catch (error) {
    console.warn('[LampStorage] Failed to get storage stats:', error)
    return null
  }
}
