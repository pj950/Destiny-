// Mock database service for testing API endpoints without real Supabase
// This simulates the database responses to verify API logic

export interface MockFortune {
  id: string
  category: string
  stick_id: number
  stick_text: string
  stick_level: string
  ai_analysis: string | null
  created_at: string
}

export interface MockLamp {
  lamp_key: string
  status: 'unlit' | 'lit'
  updated_at: string
}

// Mock data
const mockFortunes: Record<string, MockFortune> = {}
const mockLamps: MockLamp[] = [
  { lamp_key: 'p1', status: 'unlit', updated_at: new Date().toISOString() },
  { lamp_key: 'p2', status: 'lit', updated_at: new Date().toISOString() },
  { lamp_key: 'p3', status: 'unlit', updated_at: new Date().toISOString() },
  { lamp_key: 'p4', status: 'unlit', updated_at: new Date().toISOString() },
]

// Mock Supabase client methods
export const mockSupabaseService = {
  from: (table: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: any) => ({
        maybeSingle: () => {
          if (table === 'fortunes') {
            const key = `${value}-${columns}` // Simple mock key
            return Promise.resolve({ data: mockFortunes[key] || null, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        },
        gte: () => ({
          lte: () => ({
            then: (callback: any) => {
              if (table === 'bazi_reports') {
                return callback({ data: [], error: null })
              }
              return callback({ data: null, error: null })
            }
          })
        })
      }),
      order: () => ({
        then: (callback: any) => {
          if (table === 'lamps') {
            return callback({ data: mockLamps, error: null })
          }
          return callback({ data: [], error: null })
        }
      })
    }),
    insert: (data: any) => ({
      select: () => ({
        maybeSingle: () => {
          if (table === 'fortunes') {
            const fortune = {
              ...data[0],
              id: 'mock-id-' + Date.now(),
              created_at: new Date().toISOString()
            }
            const key = `${fortune.session_id}-${fortune.draw_date}`
            mockFortunes[key] = fortune
            return Promise.resolve({ data: fortune, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        }
      })
    })
  })
}

// Function to detect if we should use mock (for testing)
export function shouldUseMockDatabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !url || url.includes('test') || url.includes('placeholder') || url.includes('your-')
}