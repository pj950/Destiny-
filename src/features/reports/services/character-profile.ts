import { getGeminiClient, parseGeminiJsonResponse, buildCharacterProfilePrompt, CharacterProfilePayloadSchema, CHARACTER_PROFILE_PROMPT_VERSION } from '@/src/features/ai/gemini'
import { analyzeBaziInsights } from '@/src/features/charts/services'
import type { BaziChart } from '@/src/features/charts/services'
import type { BaziReport, BaziReportInsert } from '@/src/types/database'
import { ReportServiceError } from './errors'
import { createReport, getChartById, getLatestReport } from './repository'

interface CharacterProfileResult {
  report: BaziReport
  cached: boolean
  topTraits?: Array<{ title: string; description: string }>
}

function extractBirthYear(chart: BaziChart): number {
  return chart?.meta?.lunar?.cYear || new Date().getFullYear()
}

export async function getOrCreateCharacterProfileReport(chartId: string): Promise<CharacterProfileResult> {
  if (!chartId || typeof chartId !== 'string') {
    throw new ReportServiceError(400, 'chart_id is required')
  }

  const chart = await getChartById(chartId)
  const existing = await getLatestReport(chartId, 'character_profile')

  if (existing && existing.status === 'completed') {
    return { report: existing, cached: true }
  }

  const baziChart = chart.chart_json as BaziChart
  const birthYear = extractBirthYear(baziChart)
  const insights = analyzeBaziInsights(baziChart, birthYear)
  const prompt = buildCharacterProfilePrompt(insights)
  const geminiClient = getGeminiClient()

  const response = await geminiClient.generateText({ prompt })
  const payload = parseGeminiJsonResponse(response, CharacterProfilePayloadSchema)

  const reportData: BaziReportInsert = {
    chart_id: chart.id,
    user_id: null,
    report_type: 'character_profile',
    title: `Character Profile - ${chart.id}`,
    summary: {
      key_insights: payload.topTraits.slice(0, 2).map((trait) => trait.title),
      strengths: [payload.corePersona.archetype],
      areas_for_growth: [],
      lucky_elements: [],
      unlucky_elements: [],
    },
    structured: {
      sections: [
        {
          title: 'Core Persona',
          content: payload.corePersona.description,
        },
        {
          title: 'Super Power',
          content: payload.superPower.activation,
        },
        {
          title: "Master's Insight",
          content: payload.mastersInsight,
        },
        {
          title: 'Opportunity Preview',
          content: payload.opportunityPreview,
        },
      ],
    },
    body: JSON.stringify(payload),
    model: 'gemini-2.5-pro',
    prompt_version: CHARACTER_PROFILE_PROMPT_VERSION,
    tokens: null,
    status: 'completed',
  }

  const report = await createReport(reportData)

  return {
    report,
    cached: false,
    topTraits: payload.topTraits,
  }
}
