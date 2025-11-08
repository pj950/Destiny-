import { NextApiRequest, NextApiResponse } from 'next'
import { getLampsConfig } from '../../../lib/lamps.config'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const lamps = getLampsConfig()
    return res.status(200).json({ lamps })
  } catch (error) {
    console.error('[API] Failed to load lamp configuration:', error)
    return res.status(200).json({ lamps: [] })
  }
}
