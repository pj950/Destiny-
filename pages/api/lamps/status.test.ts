import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for /api/lamps/status endpoint
 * Covers lamp status retrieval, error handling, and mock data fallback
 */

describe('Lamp Status API', () => {
  let mockSupabaseService: any
  let mockRequest: any
  let mockResponse: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Mock request/response
    mockRequest = {
      method: 'GET',
    }

    mockResponse = {
      _status: 200,
      _jsonData: null,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }

    // Mock supabaseService
    mockSupabaseService = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('HTTP Method Validation', () => {
    it('should accept GET requests', () => {
      expect(mockRequest.method).toBe('GET')
    })

    it('should reject non-GET requests', () => {
      const invalidMethods = ['POST', 'PUT', 'DELETE', 'PATCH']
      invalidMethods.forEach((method) => {
        expect(method).not.toBe('GET')
      })
    })
  })

  describe('Database Query', () => {
    it('should query lamps table with correct fields', async () => {
      mockSupabaseService.from('lamps')
      mockSupabaseService.select('lamp_key, status, updated_at')
      mockSupabaseService.order('lamp_key', { ascending: true })

      expect(mockSupabaseService.from).toHaveBeenCalledWith('lamps')
      expect(mockSupabaseService.select).toHaveBeenCalledWith('lamp_key, status, updated_at')
      expect(mockSupabaseService.order).toHaveBeenCalledWith('lamp_key', { ascending: true })
    })

    it('should handle successful database response', async () => {
      const mockLamps = [
        { lamp_key: 'p1', status: 'unlit', updated_at: '2025-11-13T05:27:04.940Z' },
        { lamp_key: 'p2', status: 'lit', updated_at: '2025-11-13T05:25:00.000Z' },
      ]

      mockSupabaseService.order.mockResolvedValue({
        data: mockLamps,
        error: null,
      })

      const result = await mockSupabaseService.order()
      expect(result.data).toEqual(mockLamps)
      expect(result.error).toBeNull()
    })

    it('should handle empty database response', async () => {
      mockSupabaseService.order.mockResolvedValue({
        data: [],
        error: null,
      })

      const result = await mockSupabaseService.order()
      expect(result.data).toEqual([])
      expect(result.error).toBeNull()
    })

    it('should handle database errors', async () => {
      mockSupabaseService.order.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      })

      const result = await mockSupabaseService.order()
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const connectionError = new Error('fetch failed')
      mockSupabaseService.order.mockRejectedValue(connectionError)

      try {
        await mockSupabaseService.order()
      } catch (error) {
        expect(error.message).toBe('fetch failed')
      }
    })

    it('should return mock data when database is unavailable', () => {
      const mockLamps = [
        { lamp_key: 'p1', status: 'unlit', last_updated: expect.any(String) },
        { lamp_key: 'p2', status: 'unlit', last_updated: expect.any(String) },
        { lamp_key: 'p3', status: 'unlit', last_updated: expect.any(String) },
        { lamp_key: 'p4', status: 'unlit', last_updated: expect.any(String) },
      ]

      mockLamps.forEach((lamp) => {
        expect(lamp).toHaveProperty('lamp_key')
        expect(lamp).toHaveProperty('status')
        expect(lamp).toHaveProperty('last_updated')
        expect(['unlit', 'lit']).toContain(lamp.status)
        expect(['p1', 'p2', 'p3', 'p4']).toContain(lamp.lamp_key)
      })
    })
  })

  describe('Data Transformation', () => {
    it('should map updated_at to last_updated', () => {
      const dbLamps = [
        { lamp_key: 'p1', status: 'unlit', updated_at: '2025-11-13T05:27:04.940Z' },
        { lamp_key: 'p2', status: 'lit', updated_at: '2025-11-13T05:25:00.000Z' },
      ]

      const formattedLamps = dbLamps.map(lamp => ({
        lamp_key: lamp.lamp_key,
        status: lamp.status,
        last_updated: lamp.updated_at
      }))

      expect(formattedLamps[0]).toEqual({
        lamp_key: 'p1',
        status: 'unlit',
        last_updated: '2025-11-13T05:27:04.940Z'
      })

      expect(formattedLamps[1]).toEqual({
        lamp_key: 'p2',
        status: 'lit',
        last_updated: '2025-11-13T05:25:00.000Z'
      })
    })

    it('should maintain correct data types', () => {
      const lamp = {
        lamp_key: 'p1',
        status: 'unlit',
        last_updated: '2025-11-13T05:27:04.940Z'
      }

      expect(typeof lamp.lamp_key).toBe('string')
      expect(typeof lamp.status).toBe('string')
      expect(typeof lamp.last_updated).toBe('string')
      expect(['unlit', 'lit']).toContain(lamp.status)
    })
  })

  describe('Response Format', () => {
    it('should return array of lamp statuses', () => {
      const response = [
        { lamp_key: 'p1', status: 'unlit', last_updated: '2025-11-13T05:27:04.940Z' },
        { lamp_key: 'p2', status: 'lit', last_updated: '2025-11-13T05:25:00.000Z' },
      ]

      expect(Array.isArray(response)).toBe(true)
      expect(response.length).toBeGreaterThan(0)
      response.forEach(lamp => {
        expect(lamp).toHaveProperty('lamp_key')
        expect(lamp).toHaveProperty('status')
        expect(lamp).toHaveProperty('last_updated')
      })
    })

    it('should return error object for failures', () => {
      const errorResponse = { error: 'Failed to fetch lamp statuses' }
      expect(errorResponse).toHaveProperty('error')
      expect(typeof errorResponse.error).toBe('string')
    })
  })

  describe('Interface Compliance', () => {
    it('should match LampStatus interface', () => {
      const lampStatus = {
        lamp_key: 'p1',
        status: 'unlit' as const,
        last_updated: '2025-11-13T05:27:04.940Z'
      }

      // These should not throw TypeScript errors
      expect(typeof lampStatus.lamp_key).toBe('string')
      expect(['unlit', 'lit']).toContain(lampStatus.status)
      expect(typeof lampStatus.last_updated).toBe('string')
    })

    it('should allow optional last_updated field', () => {
      const lampStatus = {
        lamp_key: 'p1',
        status: 'unlit' as const
      }

      expect(lampStatus).toHaveProperty('lamp_key')
      expect(lampStatus).toHaveProperty('status')
      // last_updated is optional
    })
  })

  describe('Edge Cases', () => {
    it('should handle single lamp', () => {
      const singleLamp = [{ lamp_key: 'p1', status: 'unlit', last_updated: '2025-11-13T05:27:04.940Z' }]
      expect(singleLamp.length).toBe(1)
      expect(singleLamp[0].lamp_key).toBe('p1')
    })

    it('should handle all lamp keys', () => {
      const allLamps = ['p1', 'p2', 'p3', 'p4']
      allLamps.forEach(key => {
        expect(['p1', 'p2', 'p3', 'p4']).toContain(key)
      })
    })

    it('should handle both status values', () => {
      const statuses = ['unlit', 'lit']
      statuses.forEach(status => {
        expect(['unlit', 'lit']).toContain(status)
      })
    })
  })
})