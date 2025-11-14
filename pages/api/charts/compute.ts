import type { NextApiRequest, NextApiResponse } from 'next'
import {
  ChartComputationError,
  computeChartForProfile,
} from '@/src/features/charts/api/compute-chart'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { profile_id } = req.body

  try {
    const { chart, chartId } = await computeChartForProfile(profile_id)

    res.json({ ok: true, chart, chart_id: chartId })
  } catch (error) {
    if (error instanceof ChartComputationError) {
      return res.status(error.status).json({ ok: false, message: error.message })
    }

    return res.status(500).json({ ok: false, message: (error as Error).message || 'Internal server error' })
  }
}
