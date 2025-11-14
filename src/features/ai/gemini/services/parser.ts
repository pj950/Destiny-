import { z } from 'zod'

const MARKDOWN_JSON_BLOCK = /```(?:json)?\s*([\s\S]*?)```/i

interface ParseOptions {
  responseLabel?: string
}

const sanitizeJsonCandidate = (value: string) =>
  value
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .trim()

const extractCandidate = (raw: string): string => {
  const trimmed = raw.trim()
  const markdownMatch = MARKDOWN_JSON_BLOCK.exec(trimmed)
  const candidate = markdownMatch ? markdownMatch[1] : trimmed

  const startIndex = candidate.indexOf('{')
  const endIndex = candidate.lastIndexOf('}')

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    return candidate.slice(startIndex, endIndex + 1)
  }

  return candidate
}

const truncateSnippet = (value: string, length = 280) =>
  value.length <= length ? value : `${value.slice(0, length)}…`

export function parseGeminiJsonResponse<T>(
  raw: string,
  schema: z.ZodSchema<T>,
  options: ParseOptions = {}
): T {
  const label = options.responseLabel ?? 'Gemini response'

  if (!raw || raw.trim().length === 0) {
    throw new Error(`${label} is empty. Expected JSON wrapped in a Markdown code block.`)
  }

  const candidate = sanitizeJsonCandidate(extractCandidate(raw))

  const attempts: string[] = []
  if (candidate) {
    attempts.push(candidate)
  }

  if (!candidate.includes('{') && raw.includes('{')) {
    const fallback = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
    attempts.push(sanitizeJsonCandidate(fallback))
  }

  let parsedValue: unknown
  const parseErrors: string[] = []

  for (const attempt of attempts) {
    if (!attempt || attempt.trim().length === 0) continue

    try {
      parsedValue = JSON.parse(attempt)
      break
    } catch (err: any) {
      parseErrors.push(err.message || String(err))
    }
  }

  if (parsedValue === undefined) {
    const snippet = truncateSnippet(candidate || raw)
    const parseError = parseErrors[parseErrors.length - 1] || 'Unknown JSON parse error'
    throw new Error(
      `${label} JSON parsing failed: ${parseError}. Response snippet: ${snippet}`
    )
  }

  const validation = schema.safeParse(parsedValue)
  if (!validation.success) {
    const issues = validation.error.issues
      .map(issue => `• ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join(' ')
    const snippet = truncateSnippet(candidate || raw)
    throw new Error(
      `${label} failed schema validation: ${issues}. Response snippet: ${snippet}`
    )
  }

  return validation.data
}
