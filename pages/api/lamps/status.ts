import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'

interface LampStatus {
  lamp_key: string
  status: 'unlit' | 'lit'
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

    const { data: lamps, error } = await supabaseService
      .from('lamps')
      .select('lamp_key, status, updated_at')
      .order('lamp_key', { ascending: true })

    if (error) {
      console.error('[Lamp Status] Error fetching lamps:', error)
      return res.status(500).json({ error: 'Failed to fetch lamp statuses' })
    }

    if (!lamps) {
      console.log('[Lamp Status] No lamps found')
      return res.status(200).json([])
    }

    console.log(`[Lamp Status] Retrieved ${lamps.length} lamp statuses`)
    
    // Map updated_at to last_updated for consistency
    const formattedLamps = lamps.map(lamp => ({
      lamp_key: lamp.lamp_key,
      status: lamp.status,
      last_updated: lamp.updated_at
    }))
    
    return res.status(200).json(formattedLamps as LampStatus[])

  } catch (error: any) {
    console.error('[Lamp Status] Unexpected error:', error)
    return res.status(500).json({ 
      error: error.message || 'An unexpected error occurred while fetching lamp statuses' 
    })
  }
}
