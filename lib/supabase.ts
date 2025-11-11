import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Validate environment variables are present
if (!supabaseUrl) {
  console.warn(
    '[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
    'Please check your .env.local file and ensure it contains the correct Supabase URL.'
  )
}

if (!supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. ' +
    'Please check your .env.local file and ensure it contains the correct anon key.'
  )
}

if (!supabaseServiceKey && typeof window === 'undefined') {
  console.warn(
    '[Supabase] Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
    'This is required for server-side operations. Please check your .env.local file.'
  )
}

// Create clients with fallback to prevent initialization errors
// The clients will fail gracefully at runtime if keys are missing
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

export const supabaseService = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key'
)
