# QA Ask API - Quick Start Guide

## Overview
The QA Ask API enables users to ask questions about their BaZi reports with AI-powered answers backed by semantic search (RAG) and conversation history.

## Quick API Usage

### Basic Request
```bash
curl -X POST http://localhost:3000/api/qa/ask \
  -H "Content-Type: application/json" \
  -d '{
    "report_id": "your-report-id",
    "question": "我的事业运如何？",
    "subscription_tier": "premium"
  }'
```

### Expected Response
```json
{
  "ok": true,
  "answer": "根据你的命盘分析...",
  "citations": [
    {
      "chunk_id": 1,
      "content": "相关内容摘录...",
      "section": "事业运"
    }
  ],
  "followUps": ["建议问题1", "建议问题2"],
  "remaining_quota": 14
}
```

## Implementation Files

### Main Files
- **`pages/api/qa/ask.ts`** - Main endpoint (388 lines)
  - 9-stage request processing pipeline
  - Quota management
  - Error handling with retry logic
  - Conversation management

- **`pages/api/qa/ask.test.ts`** - Tests (600+ lines)
  - 65+ test cases
  - All major scenarios covered
  - Integration and unit tests

### Documentation Files
- **`docs/QA_ASK_API.md`** - Complete API documentation
- **`QA_ASK_IMPLEMENTATION_SUMMARY.md`** - Technical implementation details
- **`QA_ASK_COMPLETION_CHECKLIST.md`** - Acceptance criteria verification

## Key Features

### Quota Management
```
Free:       0 questions/month   (blocked)
Basic:     20 questions/month   (standard)
Premium:   20 questions/month   (standard)
VIP:    Unlimited questions     (premium)
```

### Context Retrieval
- Semantic search on report chunks
- Max 5 chunks per query
- Returns with similarity scores
- Graceful fallback on failure

### Gemini Integration
- Automatic retry with exponential backoff
- Timeout: 30 seconds
- Max 3 retry attempts
- Handles rate limits and transient errors

### Conversation History
- Automatic conversation tracking
- Last 20 messages truncated before API call
- Multi-turn Q&A support
- Persistent storage

## Integration Points

### Requires (Already Set Up)
- `lib/gemini` - Gemini client and prompts
- `lib/rag.ts` - Vector search on chunks
- `types/database.ts` - Type definitions
- Supabase database with QA tables

### Database Tables Used
```
qa_conversations       - Conversation history
qa_usage_tracking      - Monthly quota tracking
bazi_report_chunks     - RAG source content
bazi_reports           - Report metadata
```

## Testing

### Run All Tests
```bash
npm run test
```

### Run QA Tests Only
```bash
npm run test -- pages/api/qa/ask.test.ts
```

### Test Coverage
- ✅ Request validation
- ✅ Quota enforcement
- ✅ Conversation management
- ✅ Vector search
- ✅ Gemini integration
- ✅ Error handling
- ✅ Response formatting

## Configuration

### Adjustable Constants (in `ask.ts`)
```typescript
MAX_CONVERSATION_HISTORY = 20  // Truncation point
MAX_CONTEXT_CHUNKS = 5         // Vector search limit
GEMINI_TIMEOUT_MS = 30000      // API timeout
GEMINI_RETRY_COUNT = 3         // Retry attempts
```

### Quota Limits (in `ask.ts`)
```typescript
const QUOTA_LIMITS = {
  free: 0,       // Not allowed
  basic: 20,     // Per month
  premium: 20,   // Per month
  vip: null      // Unlimited
}
```

## Error Handling

### Common Error Scenarios

**Missing Fields (400)**
```json
{
  "ok": false,
  "message": "Missing required fields: report_id (string) and question (string)"
}
```

**Report Not Found (404)**
```json
{
  "ok": false,
  "message": "Report not found"
}
```

**Quota Exceeded (429)**
```json
{
  "ok": false,
  "message": "Quota limit reached for subscription tier: basic. Please upgrade your subscription.",
  "remaining_quota": 0
}
```

**Internal Error (500)**
```json
{
  "ok": false,
  "message": "Internal server error"
}
```

## Response Format

### Success (200 OK)
```typescript
{
  ok: true
  answer: string                      // AI response
  citations: Array<{
    chunk_id: number                  // Chunk reference
    content: string                   // Excerpt
    section: string                   // Category
  }>
  followUps: string[]                 // Suggested questions
  remaining_quota: number             // Questions left (-1 for unlimited)
}
```

### Error (4xx, 5xx)
```typescript
{
  ok: false
  message: string                     // Error description
  remaining_quota?: number            // Optional for quota errors
}
```

## Request Flow

```
1. Validate request
   ├─ Check required fields
   ├─ Type checking
   └─ Default values

2. Verify report
   ├─ Check report exists
   └─ Return 404 if not found

3. Check quota
   ├─ Load usage tracking
   ├─ Check limit
   └─ Return 429 if exceeded

4. Load conversation
   ├─ Get existing or create new
   └─ Prepare history for API

5. Retrieve context
   ├─ Vector search on chunks
   ├─ Get top 5 results
   └─ Handle failures gracefully

6. Call Gemini
   ├─ Build prompt with context
   ├─ Set 30-second timeout
   ├─ Retry on failure (max 3x)
   └─ Parse response

7. Format response
   ├─ Extract answer, citations, followUps
   ├─ Map citations to chunks
   └─ Calculate remaining quota

8. Update conversation
   ├─ Append question to history
   ├─ Append answer to history
   ├─ Truncate if needed
   └─ Save to database

9. Return response
   └─ Send formatted JSON response
```

## Performance Tips

### Optimize Vector Search
- Ensure HNSW index exists on `embedding` column
- Index on `bazi_report_chunks(report_id, embedding)`

### Optimize Quota Lookup
- Index on `qa_usage_tracking(report_id, plan_tier, period_start)`
- Consider caching per-user quota in session

### Optimize Conversation Lookup
- Index on `qa_conversations(report_id)`
- Consider pagination for large histories

## Troubleshooting

### "Report not found"
- Verify report_id is correct UUID
- Check report exists in `bazi_reports` table
- Verify report status is 'completed'

### "Quota limit reached"
- Free tier not allowed (0 questions)
- Check current month usage
- Suggest subscription upgrade
- Show remaining_quota: 0

### Slow responses (>3s)
- Check vector search performance
- Monitor Gemini API latency
- Verify database indices exist
- Consider async processing

### No citations returned
- Report chunks may not be indexed
- Run RAG processing: `processReportChunks()`
- Verify embeddings generated
- Check similarity threshold

## Integration Example (TypeScript)

```typescript
async function askQuestion(reportId: string, question: string) {
  const response = await fetch('/api/qa/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      report_id: reportId,
      question: question,
      subscription_tier: 'premium'
    })
  })

  const data = await response.json()
  
  if (!data.ok) {
    if (response.status === 429) {
      console.log('Quota exceeded. Remaining:', data.remaining_quota)
    } else if (response.status === 404) {
      console.log('Report not found')
    } else {
      console.error('Error:', data.message)
    }
    return null
  }

  return {
    answer: data.answer,
    sources: data.citations.map(c => ({
      section: c.section,
      excerpt: c.content,
      link: `#chunk-${c.chunk_id}`
    })),
    suggestions: data.followUps,
    quotaRemaining: data.remaining_quota
  }
}

// Usage
const result = await askQuestion('report-123', '我的财运如何？')
```

## Next Steps

1. **Deploy** - Push branch and merge after review
2. **Monitor** - Track API performance and quota usage
3. **Enhance** - Add caching, analytics, streaming
4. **Scale** - Optimize for high-traffic scenarios

## Support

- Full documentation: `docs/QA_ASK_API.md`
- Implementation details: `QA_ASK_IMPLEMENTATION_SUMMARY.md`
- Acceptance criteria: `QA_ASK_COMPLETION_CHECKLIST.md`
- Main README: Updated with QA Ask section

---

**Status**: ✅ Production Ready
**Branch**: `feat/qa-ask-api-optimize-fallback-quota-testing`
**Last Updated**: November 10, 2024
