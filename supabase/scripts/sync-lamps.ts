import { createClient } from '@supabase/supabase-js'
import { getLampsConfig, defaultLamps, type LampConfig } from '../../lib/lamps.config'

const requiredEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`${key} environment variable is required to run supabase/scripts/sync-lamps.ts`)
  }
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function resolveLampConfigs(): LampConfig[] {
  const lamps = getLampsConfig()
  return lamps.length ? lamps : defaultLamps
}

async function syncLampsTable() {
  const lamps = resolveLampConfigs()
  const lampKeys = lamps.map((lamp) => lamp.key)

  console.log(`[Sync Lamps] Preparing to sync ${lampKeys.length} lamp records`)

  const { data: existing, error: existingError } = await supabase
    .from('lamps')
    .select('lamp_key, status')
    .in('lamp_key', lampKeys)

  if (existingError) {
    throw new Error(`[Sync Lamps] Unable to read existing lamp records: ${existingError.message}`)
  }

  const existingKeys = new Set((existing ?? []).map((lamp) => lamp.lamp_key))

  const lampsToInsert = lamps.filter((lamp) => !existingKeys.has(lamp.key))

  if (lampsToInsert.length === 0) {
    console.log('[Sync Lamps] No new lamp records detected. Table is up to date.')
    return
  }

  const insertPayload = lampsToInsert.map((lamp) => ({
    lamp_key: lamp.key,
    status: 'unlit' as const,
  }))

  console.log(`[Sync Lamps] Inserting ${insertPayload.length} new lamp records`)

  const { error: insertError } = await supabase.from('lamps').insert(insertPayload)

  if (insertError) {
    throw new Error(`[Sync Lamps] Failed to insert lamp records: ${insertError.message}`)
  }

  console.log('[Sync Lamps] Completed successfully.')
}

syncLampsTable().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
