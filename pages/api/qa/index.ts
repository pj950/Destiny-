import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  return res.status(404).json({
    ok: false,
    message: 'QA API endpoint not found. Use POST /api/qa/ask for questions.',
  })
}
