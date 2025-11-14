import { processReportChunks } from '../../../lib/rag'

export async function processRagChunks(reportId: string, reportText: string): Promise<void> {
  try {
    await processReportChunks(reportId, reportText)
    console.log(`[Worker] RAG chunks processed successfully for report ${reportId}`)
  } catch (ragError: any) {
    console.error(`[Worker] Non-fatal error processing RAG chunks for report ${reportId}:`, ragError)
    throw ragError
  }
}