import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { FALLBACK_LAMPS } from '../../../lib/lamps.client'

interface LampStatus {
  lamp_key: string
  status: 'unlit' | 'lit'
  last_updated?: string
}

function buildFallbackStatuses(): LampStatus[] {
  const now = new Date().toISOString()
  return FALLBACK_LAMPS.map(lamp => ({
    lamp_key: lamp.key,
    status: 'unlit',
    last_updated: now
  }))
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LampStatus[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('[Lamp Status] Fetching lamp statuses')

    let lamps, error
    
    try {
      const result = await supabaseService
        .from('lamps')
        .select('lamp_key, status, updated_at')
        .order('lamp_key', { ascending: true })
      lamps = result.data
      error = result.error
    } catch (dbError: any) {
      console.error('[Lamp Status] Database connection error:', dbError.message)
      const fallback = buildFallbackStatuses()
      console.log('[Lamp Status] Returning fallback statuses due to database unavailability')
      return res.status(200).json(fallback)
    }

    if (error) {
      console.error('[Lamp Status] Error fetching lamps:', error)
      const fallback = buildFallbackStatuses()
      console.log('[Lamp Status] Returning fallback statuses due to query error')
      return res.status(200).json(fallback)
    }

    if (!lamps || lamps.length === 0) {
      console.log('[Lamp Status] No lamps found in database, returning fallback list')
      return res.status(200).json(buildFallbackStatuses())
    }

    console.log(`[Lamp Status] Retrieved ${lamps.length} lamp statuses`)
    
    // Map updated_at to last_updated for consistency
    const formattedLamps = lamps.map(lamp => ({
      lamp_key: lamp.lamp_key,
      status: lamp.status,
      last_updated: lamp.updated_at
    }))
    
    return res.status(200).json(formattedLamps)

  } catch (error: any) {
    console.error('[Lamp Status] Unexpected error:', error)
    return res.status(500).json({ 
      error: error.message || 'An unexpected error occurred while fetching lamp statuses' 
    })
  }
}
