# QA Ask API Documentation

## Overview

The `/api/qa/ask` endpoint provides intelligent question-answering capabilities for BaZi reports using Retrieval-Augmented Generation (RAG). Users can ask questions about their reports and receive context-specific answers with citations.

## Endpoint

```
POST /api/qa/ask
```

## Request

### Required Fields

```typescript
{
  report_id: string          // UUID of the BaZi report to ask about
  question: string           // User's question in Chinese
  subscription_tier?: string // Optional: 'free', 'basic', 'premium', 'vip' (defaults to 'free')
}
```

### Example Request

```bash
curl -X POST http://localhost:3000/api/qa/ask \
  -H "Content-Type: application/json" \
  -d '{
    "report_id": "550e8400-e29b-41d4-a716-446655440000",
    "question": "我的事业运如何？",
    "subscription_tier": "premium"
  }'
```

## Response

### Success Response (200 OK)

```typescript
{
  ok: true
  answer: string                    // AI's response (160-220 characters)
  citations: Array<{
    chunk_id: number               // Reference to source chunk
    content: string                // Relevant excerpt
    section: string                // Section name (e.g., "事业运", "财运")
  }>
  followUps: string[]              // Suggested follow-up questions (2-3 items)
  remaining_quota: number          // Questions remaining this month (-1 for unlimited)
}
```

### Example Success Response

```json
{
  "ok": true,
  "answer": "根据你的命盘分析，你在事业上具有出色的执行力和领导能力。月柱丙寅表明你具有创新精神，适合创业或担任管理职位。今年你的事业运势处于上升阶段，建议把握机遇进行突破。",
  "citations": [
    {
      "chunk_id": 1,
      "content": "月柱丙寅表明你具有创新精神和强大的行动力...",
      "section": "事业分析"
    },
    {
      "chunk_id": 3,
      "content": "今年流年干支显示事业方面有重要机遇...",
      "section": "流年运势"
    }
  ],
  "followUps": [
    "我应该在哪个时间点做重要的职业决定？",
    "我的团队合作能力如何评估？",
    "财运与事业运如何相互影响？"
  ],
  "remaining_quota": 14
}
```

### Error Responses

#### 400 Bad Request - Missing Fields

```json
{
  "ok": false,
  "message": "Missing required fields: report_id (string) and question (string)"
}
```

#### 404 Not Found - Report Doesn't Exist

```json
{
  "ok": false,
  "message": "Report not found"
}
```

#### 405 Method Not Allowed

```json
{
  "ok": false,
  "message": "Method not allowed"
}
```

#### 429 Too Many Requests - Quota Exceeded

```json
{
  "ok": false,
  "message": "Quota limit reached for subscription tier: premium. Please upgrade your subscription.",
  "remaining_quota": 0
}
```

#### 500 Internal Server Error

```json
{
  "ok": false,
  "message": "Internal server error"
}
```

## Quota System

### Limits by Subscription Tier

| Tier | Questions/Month | Notes |
|------|----------------:|-------|
| free | 0 | Not allowed to use QA |
| basic | 20 | Resets monthly |
| premium | 20 | Resets monthly |
| vip | Unlimited | No quota restrictions |

### Monthly Reset

- Quotas reset on the 1st of each month (UTC timezone)
- Usage is tracked per report, per user, per subscription tier
- `remaining_quota: -1` indicates unlimited access (VIP tier)

## Implementation Details

### Flow Stages

1. **Request Validation** - Verify required fields
2. **Report Verification** - Confirm report exists
3. **Quota Check** - Validate user hasn't exceeded limit
4. **Conversation Loading** - Load or create conversation history
5. **Context Retrieval** - Search for relevant chunks via RAG
6. **Gemini Integration** - Call Gemini API with prompt
7. **Response Parsing** - Parse and validate AI response
8. **Citation Formatting** - Extract source references
9. **History Update** - Append question and answer to conversation

### Error Handling

#### Gemini Timeouts
- Retry up to 3 times with exponential backoff (1s, 2s, 4s)
- Handles `DEADLINE_EXCEEDED` and `RESOURCE_EXHAUSTED` errors
- Throws after max retries exhausted

#### Vector Search Failures
- Non-blocking: If RAG search fails, continue with empty context
- AI will note information unavailability in response
- Never fails entire request

#### Database Failures
- Conversation history updates are non-critical
- Failures are logged but don't prevent response
- All data operations retry once

### Performance Characteristics

| Operation | Target Time |
|-----------|------------|
| Total Request | <3 seconds |
| Vector Search | ~100-200ms |
| Gemini Call | ~1-2 seconds |
| Conversation History | ~100ms |

### Context Retrieval

- **Max Chunks**: 5 chunks per search
- **Similarity Threshold**: 0.5 (configurable)
- **Fallback**: Empty context handled gracefully

### Conversation Management

- **Max History**: Last 20 messages (10 Q&A pairs)
- **Auto-truncation**: History is truncated before sending to Gemini
- **Retention**: Conversations persist indefinitely
- **Format**: JSONB array of message objects

```typescript
interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string  // ISO 8601
  sources?: Array<{  // Only for assistant messages
    chunk_id: number
    similarity: number
  }>
}
```

## Database Schema

### qa_conversations Table

```sql
id UUID PRIMARY KEY
report_id UUID NOT NULL REFERENCES bazi_reports(id)
user_id UUID NULL
subscription_tier TEXT NOT NULL
messages JSONB NOT NULL DEFAULT '[]'
last_message_at TIMESTAMPTZ
retention_until TIMESTAMPTZ NULL
metadata JSONB NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### qa_usage_tracking Table

```sql
id BIGSERIAL PRIMARY KEY
user_id UUID NOT NULL
report_id UUID NOT NULL REFERENCES bazi_reports(id)
plan_tier TEXT NOT NULL
period_start TIMESTAMPTZ NOT NULL
period_end TIMESTAMPTZ NOT NULL
questions_used SMALLINT DEFAULT 0
extra_questions SMALLINT DEFAULT 0
last_reset_at TIMESTAMPTZ
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### bazi_report_chunks Table (Used for RAG)

```sql
id BIGSERIAL PRIMARY KEY
report_id UUID NOT NULL REFERENCES bazi_reports(id)
chunk_index INT NOT NULL
content TEXT NOT NULL
embedding vector(768)  -- Gemini text-embedding-004
metadata JSONB  -- {section, subsection, keywords, etc.}
created_at TIMESTAMPTZ
```

## Integration Examples

### JavaScript/TypeScript

```typescript
const response = await fetch('/api/qa/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    report_id: 'report-id-here',
    question: '我的财运如何？',
    subscription_tier: 'premium'
  })
})

const data = await response.json()

if (data.ok) {
  console.log('Answer:', data.answer)
  console.log('Citations:', data.citations)
  console.log('Follow-ups:', data.followUps)
  console.log('Remaining quota:', data.remaining_quota)
} else {
  console.error('Error:', data.message)
}
```

### Python

```python
import requests

response = requests.post('http://localhost:3000/api/qa/ask', json={
    'report_id': 'report-id-here',
    'question': '我的感情运势如何？',
    'subscription_tier': 'vip'
})

data = response.json()

if data['ok']:
    print(data['answer'])
    print(f"Remaining: {data['remaining_quota']}")
else:
    print(f"Error: {data['message']}")
```

## Testing

### Run Tests

```bash
npm run test -- pages/api/qa/ask.test.ts
```

### Test Coverage

- Request validation (required fields, types)
- Report verification
- Quota management (all tiers, monthly reset)
- Conversation management (creation, history truncation)
- Vector search integration
- Gemini integration and retry logic
- Response parsing and formatting
- Error handling and edge cases
- Performance characteristics

## Troubleshooting

### Issue: "Report not found"

**Solution**: Verify the `report_id` is correct and the report has status `completed`.

### Issue: "Quota limit reached"

**Solution**: User needs to upgrade subscription tier or wait for monthly reset.

### Issue: "Internal server error"

**Possible causes**:
- Gemini API key misconfigured
- Database connection issues
- Vector search indices not created

**Solution**: Check server logs for detailed error messages.

### Issue: Empty citations returned

**Solution**: Report might not have chunks indexed. Ensure report underwent RAG processing.

### Issue: Slow responses (>3s)

**Causes**:
- Large context retrieved (>5 chunks)
- Gemini API latency
- Database query delays

**Solution**: Monitor Gemini API performance and optimize query indices.

## Future Enhancements

- [ ] User authentication and personalization
- [ ] Question-answer caching
- [ ] Multi-language support (English, Traditional Chinese)
- [ ] Streaming responses
- [ ] Follow-up answer refinement
- [ ] Satisfaction rating and feedback
- [ ] Analytics dashboard for usage patterns
- [ ] Custom prompt templates per report type
- [ ] Batch question processing

## API Rate Limits

- Per-second: No hard limit (handled by Gemini API)
- Per-month: Enforced via quota system (20 for basic/premium, unlimited for VIP)
- Per-conversation: No limit

## Security Considerations

- All inputs are validated and sanitized
- SQL injection protection via parameterized queries
- XSS prevention in JSON responses
- Rate limiting via subscription tier quota
- API key stored in environment variables
- No PII in conversation logs

## Monitoring & Logging

All operations are logged with `[QA Ask]` prefix:

```
[QA Ask] Processing report: report-123
[QA Ask] Retrieved 3 context chunks
[QA Ask] Gemini response length: 234 characters
[QA Ask] Updated conversation with 2 new messages
```

## Support

For issues or questions, refer to:
- Main documentation: `/README.md`
- RAG documentation: `/docs/RAG_IMPLEMENTATION.md`
- Gemini integration: `/lib/gemini/`
