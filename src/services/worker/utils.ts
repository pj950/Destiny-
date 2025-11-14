export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function logJobProgress(jobId: string, message: string): void {
  const timestamp = new Date().toISOString()
  console.log(`[Worker][${timestamp}][Job ${jobId}] ${message}`)
}

export function isRetryableError(error: any): boolean {
  const message = error?.message || ''
  const status = error?.status || error?.code
  
  // Check for rate limit or temporary errors
  if (typeof status === 'number' && [408, 409, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true
  }
  
  // Check error message for rate limit indicators
  return /rate limit|quota|temporarily unavailable|timeout|ECONNRESET/i.test(message)
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  maxRetries: number = 3
): Promise<T> {
  const RETRY_BACKOFF_BASE_MS = 2000
  let lastError: any
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error
      
      if (!isRetryableError(error) || attempt >= maxRetries) {
        throw error
      }
      
      const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt - 1)
      console.log(`[Worker] ${context} failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms...`)
      console.log(`[Worker] Error: ${error.message}`)
      await sleep(backoffMs)
    }
  }
  
  throw lastError
}