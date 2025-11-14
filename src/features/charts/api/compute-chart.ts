import { supabaseService } from '@/lib/supabase'
import type { BaziChart } from '@/src/features/charts/services'
import { analyzeBaziInsights, computeBazi, toDBFormat } from '@/src/features/charts/services'

interface ChartProfileRow {
  id: string
  birth_local: string
  birth_timezone: string
}

export interface ChartComputationResult {
  chart: BaziChart
  chartId: string
}

export class ChartComputationError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ChartComputationError'
  }
}

async function loadProfile(profileId: string): Promise<ChartProfileRow> {
  const { data, error } = await supabaseService
    .from('profiles')
    .select('id, birth_local, birth_timezone')
    .eq('id', profileId)
    .single()

  if (error || !data) {
    throw new ChartComputationError(404, 'profile not found')
  }

  if (!data.birth_local || !data.birth_timezone) {
    throw new ChartComputationError(400, 'profile has incomplete birth data')
  }

  return data as ChartProfileRow
}

export async function computeChartForProfile(profileId: string): Promise<ChartComputationResult> {
  if (!profileId || typeof profileId !== 'string') {
    throw new ChartComputationError(400, 'profile_id is required')
  }

  const profile = await loadProfile(profileId)

  const chart = computeBazi(profile.birth_local, profile.birth_timezone)
  const birthYear = new Date(profile.birth_local).getFullYear()
  const insights = analyzeBaziInsights(chart, birthYear)
  const insightsDB = toDBFormat(insights)

  const { data, error } = await supabaseService
    .from('charts')
    .insert([
      {
        profile_id: profileId,
        chart_json: chart,
        wuxing_scores: chart.wuxing,
        day_master: insightsDB.day_master,
        ten_gods: insightsDB.ten_gods,
        luck_cycles: insightsDB.luck_cycles,
      },
    ])
    .select()
    .single()

  if (error || !data) {
    throw new ChartComputationError(500, error?.message ?? 'failed to create chart')
  }

  return {
    chart,
    chartId: data.id as string,
  }
}
