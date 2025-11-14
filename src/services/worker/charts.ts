import type { Chart, BaziReport, BaziReportInsert } from '../../../types/database'
import type { BaziChart } from '../../../lib/bazi'
import { supabaseService } from '../../../lib/supabase'
import { analyzeBaziInsights } from '../../../lib/bazi-insights'

export interface ChartWithInsights {
  chart: Chart
  baziChart: BaziChart
  insights: ReturnType<typeof analyzeBaziInsights>
  birthYear: number
}

export async function loadChartWithInsights(chartId: string): Promise<ChartWithInsights> {
  console.log(`[Worker][${new Date().toISOString()}][Job ${chartId}] Loading chart and computing insights...`)
  
  const { data: chartRow, error: chartError } = await supabaseService
    .from('charts')
    .select('*')
    .eq('id', chartId)
    .single()
    
  if (chartError) {
    console.error(`[Worker] Database error fetching chart ${chartId}:`, chartError)
    throw new Error(`Failed to load chart: ${chartId} - ${chartError.message}`)
  }
  
  if (!chartRow) {
    const error = new Error(`Chart not found: ${chartId}`)
    ;(error as any).isNotFound = true
    console.error(`[Worker] Chart ${chartId} not found in database`)
    throw error
  }
  
  const chart = chartRow as Chart
  const baziChart = chart.chart_json as BaziChart
  const birthYear = baziChart?.meta?.lunar?.cYear || new Date().getFullYear()
  const insights = analyzeBaziInsights(baziChart, birthYear)
  
  console.log(`[Worker][${new Date().toISOString()}][Job ${chartId}] Chart loaded successfully`)
  
  return {
    chart,
    baziChart,
    insights,
    birthYear,
  }
}

export async function persistReport(data: BaziReportInsert): Promise<BaziReport> {
  const { data: insertedReport, error: insertError } = await supabaseService
    .from('bazi_reports')
    .insert([data])
    .select()
    .single()

  if (insertError || !insertedReport) {
    console.error('[Worker] Failed to insert report:', insertError)
    throw new Error('Failed to persist report to database')
  }

  return insertedReport as BaziReport
}

export async function uploadReportToStorage(jobId: string, reportText: string): Promise<string> {
  const reportPath = `${jobId}.txt`
  console.log(`[Worker][${new Date().toISOString()}][Job ${jobId}] Uploading report to storage bucket 'reports' as ${reportPath}...`)

  const { error: uploadError } = await supabaseService.storage
    .from('reports')
    .upload(reportPath, Buffer.from(reportText), { upsert: true })

  if (uploadError) {
    console.error(`[Worker] Error uploading report:`, uploadError)
    throw uploadError
  }

  console.log(`[Worker][${new Date().toISOString()}][Job ${jobId}] Report uploaded successfully`)

  // Generate public URL
  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/reports/${reportPath}`
  console.log(`[Worker][${new Date().toISOString()}][Job ${jobId}] Public URL: ${publicUrl}`)
  
  return publicUrl
}