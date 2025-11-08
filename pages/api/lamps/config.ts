import { NextApiRequest, NextApiResponse } from 'next'
import { getLampsConfig } from '../../../lib/lamps.config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const lamps = await getLampsConfig()
    res.status(200).json({ lamps })
  } catch (error) {
    console.error('Error fetching lamps config:', error)
    res.status(500).json({ error: 'Failed to fetch lamps configuration' })
  }
}