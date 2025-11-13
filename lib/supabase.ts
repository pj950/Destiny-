import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Validate environment variables are present
if (!supabaseUrl) {
  console.error(
    '[Supabase] ❌ Missing NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
    'Please check your .env.local file and ensure it contains the correct Supabase URL.'
  )
}

if (!supabaseAnonKey) {
  console.error(
    '[Supabase] ❌ Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. ' +
    'Please check your .env.local file and ensure it contains the correct anon key.'
  )
}

if (!supabaseServiceKey && typeof window === 'undefined') {
  console.error(
    '[Supabase] ❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
    'This is REQUIRED for API endpoints to work correctly. ' +
    'Please configure this in your .env.local (local) or Vercel dashboard (production).'
  )
}

// Validate keys are not placeholder values
if (supabaseUrl && (supabaseUrl.includes('your-') || supabaseUrl.includes('placeholder'))) {
  console.error(
    '[Supabase] ❌ NEXT_PUBLIC_SUPABASE_URL appears to be a placeholder value. ' +
    'Please replace it with your actual Supabase project URL.'
  )
}

if (supabaseServiceKey && (supabaseServiceKey.includes('your-') || supabaseServiceKey.includes('placeholder') || supabaseServiceKey === 'test-service-role-key')) {
  console.error(
    '[Supabase] ❌ SUPABASE_SERVICE_ROLE_KEY appears to be a placeholder value. ' +
    'Please replace it with your actual service role key from Supabase dashboard. ' +
    'It should start with "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"'
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
