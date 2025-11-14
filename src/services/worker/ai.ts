import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiClient, buildYearlyFlowPrompt, parseGeminiJsonResponse } from '../../../lib/gemini'
import { YearlyFlowPayloadSchema } from '../../../lib/gemini/schemas'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
const GEMINI_REPORT_MODEL = process.env.GEMINI_MODEL_REPORT ?? 'gemini-2.5-pro'

export function getGeminiReportModel() {
  return genAI.getGenerativeModel({ model: GEMINI_REPORT_MODEL })
}

export function getGeminiReportModelName(): string {
  return GEMINI_REPORT_MODEL
}

export async function generateDeepReport(chartJson: any): Promise<string> {
  const prompt = `请根据命盘数据生成一份1200字左右的深度报告：${JSON.stringify(chartJson)}`
  
  const model = getGeminiReportModel()
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  
  if (!text) {
    throw new Error('Gemini returned empty response')
  }
  
  return text
}

export async function generateYearlyFlowReport(
  baziChart: any,
  insights: any,
  targetYear: number
): Promise<any> {
  const prompt = buildYearlyFlowPrompt(baziChart, insights, targetYear)
  
  const geminiClient = getGeminiClient()
  const response = await geminiClient.generateText({ prompt })
  
  const payload = parseGeminiJsonResponse(response, YearlyFlowPayloadSchema)
  
  return payload
}