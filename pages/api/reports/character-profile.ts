import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseService } from '../../../lib/supabase'
import { getGeminiClient, parseGeminiJsonResponse, buildCharacterProfilePrompt } from '../../../lib/gemini'
import { analyzeBaziInsights } from '../../../lib/bazi-insights'
import { CharacterProfilePayloadSchema, CHARACTER_PROFILE_PROMPT_VERSION } from '../../../lib/gemini/schemas'
import type { BaziReport, Chart } from '../../../types/database'
import type { BaziChart } from '../../../lib/bazi'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { chart_id } = req.body

  if (!chart_id || typeof chart_id !== 'string') {
    return res.status(400).json({ ok: false, message: 'chart_id is required' })
  }

  try {
    const { data: chart, error: chartError } = await supabaseService
      .from('charts')
      .select('*')
      .eq('id', chart_id)
      .single()

    if (chartError || !chart) {
      return res.status(404).json({ ok: false, message: 'Chart not found' })
    }

    const typedChart = chart as Chart

    // Check if a recent character_profile report already exists
    const { data: existingReports, error: reportsError } = await supabaseService
      .from('bazi_reports')
      .select('*')
      .eq('chart_id', chart_id)
      .eq('report_type', 'character_profile')
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingReports && existingReports.length > 0) {
      const report = existingReports[0] as BaziReport
      if (report.status === 'completed') {
        return res.json({ ok: true, report, cached: true })
      }
    }

    // Generate new report
    // Extract BaziChart from chart_json stored in database
    const baziChartData = typedChart.chart_json as BaziChart
    const birthYear = baziChartData?.meta?.lunar?.cYear || new Date().getFullYear()
    const insights = analyzeBaziInsights(baziChartData, birthYear)
    const prompt = buildCharacterProfilePrompt(insights)
    const geminiClient = getGeminiClient()

    const response = await geminiClient.generateText({ prompt })
    const payload = parseGeminiJsonResponse(response, CharacterProfilePayloadSchema)

    // Store report in database
    const { data: insertedReport, error: insertError } = await supabaseService
      .from('bazi_reports')
      .insert([
        {
          chart_id,
          user_id: null, // TODO: Extract from auth when available
          report_type: 'character_profile',
          title: `Character Profile - ${typedChart.id}`,
          summary: {
            key_insights: payload.topTraits
              .slice(0, 2)
              .map((t) => t.title),
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
        },
      ])
      .select()
      .single()

    if (insertError || !insertedReport) {
      console.error('[Character Profile] Failed to insert report:', insertError)
      return res.status(500).json({ ok: false, message: 'Failed to store report' })
    }

    res.json({
      ok: true,
      report: insertedReport,
      cached: false,
      topTraits: payload.topTraits,
    })
  } catch (err: any) {
    console.error('[Character Profile] Error:', err)
    return res.status(500).json({ ok: false, message: err.message || 'Internal server error' })
  }
}
