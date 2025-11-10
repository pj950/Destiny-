import { GoogleGenerativeAI } from '@google/generative-ai'

const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504])
const RETRYABLE_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'])

const DEFAULT_MAX_RETRIES = Number(process.env.GEMINI_CLIENT_MAX_RETRIES || 3)
const DEFAULT_RETRY_DELAY_MS = Number(process.env.GEMINI_CLIENT_RETRY_DELAY_MS || 800)

const resolveTextModel = () =>
  process.env.GEMINI_MODEL_REPORT ||
  process.env.GEMINI_MODEL_SUMMARY ||
  process.env.GEMINI_TEXT_MODEL ||
  'gemini-2.5-pro'

const resolveEmbeddingModel = () =>
  process.env.GEMINI_MODEL_EMBEDDING || 'text-embedding-004'

export interface GenerateTextParams {
  prompt: string
  systemPrompt?: string
  model?: string
  generationConfig?: {
    temperature?: number
    topP?: number
    topK?: number
    maxOutputTokens?: number
  }
  timeoutMs?: number
  abortSignal?: AbortSignal
}

export interface GenerateEmbeddingParams {
  input: string
  model?: string
  timeoutMs?: number
  abortSignal?: AbortSignal
}

type GeminiContentPart = { text: string }
type GeminiContent = { role: 'user' | 'model' | 'system'; parts: GeminiContentPart[] }

type GenerativeModel = ReturnType<GoogleGenerativeAI['getGenerativeModel']>

type RetryableOperation<T> = () => Promise<T>

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class GeminiClient {
  private readonly genAI: GoogleGenerativeAI
  private readonly defaultTextModel: string
  private readonly defaultEmbeddingModel: string
  private readonly maxRetries: number
  private readonly retryDelayMs: number

  constructor(apiKey: string, options?: {
    textModel?: string
    embeddingModel?: string
    maxRetries?: number
    retryDelayMs?: number
  }) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('GOOGLE_API_KEY is not configured. GeminiClient cannot be initialized.')
    }

    this.genAI = new GoogleGenerativeAI(apiKey)
    this.defaultTextModel = options?.textModel || resolveTextModel()
    this.defaultEmbeddingModel = options?.embeddingModel || resolveEmbeddingModel()
    this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES
    this.retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  }

  getTextModel(modelName?: string): GenerativeModel {
    const model = modelName || this.defaultTextModel
    return this.genAI.getGenerativeModel({ model })
  }

  getEmbeddingModel(modelName?: string): GenerativeModel {
    const model = modelName || this.defaultEmbeddingModel
    return this.genAI.getGenerativeModel({ model })
  }

  async generateText(params: GenerateTextParams): Promise<string> {
    if (!params.prompt || params.prompt.trim().length === 0) {
      throw new Error('GeminiClient.generateText expects a non-empty prompt.')
    }

    const modelName = params.model || this.defaultTextModel
    const model = this.getTextModel(modelName)
    const contextLabel = `Gemini generateText[${modelName}]`

    const contents: GeminiContent[] = []

    if (params.systemPrompt) {
      contents.push({
        role: 'system',
        parts: [{ text: params.systemPrompt }],
      })
    }

    contents.push({
      role: 'user',
      parts: [{ text: params.prompt }],
    })

    const request = {
      contents,
      generationConfig: params.generationConfig,
    }

    const response = await this.withRetry(
      () =>
        this.runWithTimeout(
          () => model.generateContent(request as any),
          contextLabel,
          params.timeoutMs,
          params.abortSignal
        ),
      contextLabel
    )

    const text = typeof response?.response?.text === 'function' ? response.response.text() : undefined

    if (!text || text.trim().length === 0) {
      throw new Error(`${contextLabel} returned an empty response.`)
    }

    return text.trim()
  }

  async generateEmbedding(params: GenerateEmbeddingParams): Promise<number[]> {
    if (!params.input || params.input.trim().length === 0) {
      throw new Error('GeminiClient.generateEmbedding expects a non-empty input string.')
    }

    const modelName = params.model || this.defaultEmbeddingModel
    const model = this.getEmbeddingModel(modelName)
    const contextLabel = `Gemini generateEmbedding[${modelName}]`

    const response = await this.withRetry(
      () =>
        this.runWithTimeout(
          () => model.embedContent(params.input),
          contextLabel,
          params.timeoutMs,
          params.abortSignal
        ),
      contextLabel
    )

    const values = (response as any)?.embedding?.values || (response as any)?.data?.embedding

    if (!Array.isArray(values)) {
      throw new Error(`${contextLabel} returned an invalid embedding payload.`)
    }

    return values.map((value: unknown) => Number(value))
  }

  private async withRetry<T>(operation: RetryableOperation<T>, context: string): Promise<T> {
    let attempt = 0
    let lastError: unknown

    while (attempt < this.maxRetries) {
      attempt += 1
      try {
        return await operation()
      } catch (error) {
        lastError = error
        if (!this.isRetryable(error) || attempt >= this.maxRetries) {
          throw this.toGeminiError(error, context, attempt)
        }
        const backoff = this.retryDelayMs * attempt
        await sleep(backoff)
      }
    }

    throw this.toGeminiError(lastError, context, this.maxRetries)
  }

  private async runWithTimeout<T>(
    operation: () => Promise<T>,
    context: string,
    timeoutMs?: number,
    abortSignal?: AbortSignal
  ): Promise<T> {
    if (!timeoutMs && !abortSignal) {
      return operation()
    }

    return new Promise<T>((resolve, reject) => {
      let settled = false
      let timeoutId: NodeJS.Timeout | null = null

      const cleanup = () => {
        settled = true
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        if (abortSignal) {
          abortSignal.removeEventListener('abort', onAbort)
        }
      }

      const onAbort = () => {
        if (!settled) {
          cleanup()
          reject(new Error(`${context} aborted by caller.`))
        }
      }

      if (abortSignal) {
        if (abortSignal.aborted) {
          cleanup()
          reject(new Error(`${context} aborted before execution.`))
          return
        }
        abortSignal.addEventListener('abort', onAbort, { once: true })
      }

      if (timeoutMs) {
        timeoutId = setTimeout(() => {
          if (!settled) {
            cleanup()
            reject(new Error(`${context} timed out after ${timeoutMs}ms.`))
          }
        }, timeoutMs)
      }

      operation()
        .then(result => {
          if (!settled) {
            cleanup()
            resolve(result)
          }
        })
        .catch(error => {
          if (!settled) {
            cleanup()
            reject(error)
          }
        })
    })
  }

  private isRetryable(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false
    }

    const status = (error as any).status ?? (error as any).code
    const message = (error as any).message || ''
    const name = (error as any).name || ''

    if (typeof status === 'number' && RETRYABLE_STATUS_CODES.has(status)) {
      return true
    }

    if (typeof status === 'string' && RETRYABLE_ERROR_CODES.has(status)) {
      return true
    }

    if (RETRYABLE_ERROR_CODES.has((error as any).code)) {
      return true
    }

    if (name === 'AbortError') {
      return false
    }

    return /timeout|temporar|unavailable|exceed|quota|rate/i.test(message)
  }

  private toGeminiError(error: unknown, context: string, attempt: number): Error {
    const status = (error as any)?.status
    const code = (error as any)?.code
    const message = (error as any)?.message || String(error)

    const details = [context, `attempt ${attempt}`]
    if (status) details.push(`status ${status}`)
    if (code) details.push(`code ${code}`)

    return new Error(`Gemini request failed (${details.join(', ')}): ${message}`)
  }
}

let sharedClient: GeminiClient | null = null

export const getGeminiClient = (): GeminiClient => {
  if (!sharedClient) {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        'GOOGLE_API_KEY is required to instantiate GeminiClient. Set the environment variable before calling getGeminiClient().'
      )
    }
    sharedClient = new GeminiClient(apiKey)
  }
  return sharedClient
}

export const tryGetGeminiClient = (): GeminiClient | null => {
  try {
    return getGeminiClient()
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[GeminiClient] Initialization skipped:', (error as Error).message)
    }
    return null
  }
}
