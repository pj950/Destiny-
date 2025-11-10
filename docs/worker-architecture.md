# Worker Architecture

## Overview

The Worker is a background task processing system responsible for asynchronously generating long-form reports and processing RAG (Retrieval Augmented Generation) data. It runs as a standalone Node.js process that polls the database for pending jobs.

## Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Jobs Table   │───▶│   Worker Process  │───▶│  Supabase DB    │
│                │    │                  │    │                 │
│ - pending      │    │ - Job Router     │    │ - bazi_reports  │
│ - processing   │    │ - Processors     │    │ - chunks       │
│ - done/failed │    │ - Error Handler  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Gemini AI      │
                       │                  │
                       │ - Text Gen       │
                       │ - Embeddings     │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ Supabase Storage│
                       │                  │
                       │ - Reports       │
                       └──────────────────┘
```

## Job Types

### 1. Yearly Flow Report (`yearly_flow_report`)

**Purpose**: Generate comprehensive yearly fortune predictions with structured analysis.

**Workflow**:
1. **Metadata Parsing** (Stage 1/6)
   - Extract `target_year` (defaults to current year)
   - Extract `subscription_tier` (defaults to 'free')
   - Log metadata details

2. **Data Loading** (Stage 2/6)
   - Load chart data from `charts` table
   - Compute BaZi insights using `analyzeBaziInsights()`
   - Extract birth year from chart metadata

3. **AI Generation** (Stage 3/6)
   - Build structured prompt using `buildYearlyFlowPrompt()`
   - Call Gemini with retry logic and exponential backoff
   - Handle rate limits and temporary errors

4. **Response Processing** (Stage 4/6)
   - Parse JSON response with `parseGeminiJsonResponse()`
   - Validate against `YearlyFlowPayloadSchema`
   - Log validation metrics (energy nodes count)

5. **Data Persistence** (Stage 5/6)
   - Create report record in `bazi_reports` table
   - Store structured data in `summary` and `structured` fields
   - Include metadata (model, prompt_version, timestamps)

6. **RAG Processing** (Stage 6/6)
   - Extract report body for chunking
   - Process text chunks with `processReportChunks()`
   - Generate embeddings and store in `bazi_report_chunks`
   - Non-fatal: errors don't fail the job

**Error Handling**:
- Chart not found → Mark as non-retryable failure
- Gemini errors → Retry with exponential backoff
- RAG errors → Log and continue
- Database errors → Retry or fail based on type

### 2. Deep Report (`deep_report`)

**Purpose**: Generate free-form personality analysis reports (legacy).

**Workflow**:
1. **Chart Loading**
   - Fetch chart data from database
   - Validate chart exists

2. **AI Generation**
   - Create simple prompt with chart JSON
   - Call Gemini API with retry logic
   - Handle empty responses

3. **Report Persistence**
   - Store in `bazi_reports` table (for consistency)
   - Upload to Supabase Storage (backward compatibility)
   - Generate public URL

4. **RAG Processing**
   - Process generated text for vector search
   - Create chunks and embeddings
   - Store in `bazi_report_chunks` table

**Error Handling**:
- Similar to yearly flow report
- Storage upload failures don't fail the job

## Core Components

### Job Router (`processJob`)

```typescript
async function processJob(job: Job): Promise<void> {
  // Mark as processing
  await markJobStatus(job.id, 'processing')
  
  try {
    switch (job.job_type) {
      case 'yearly_flow_report':
        return await processYearlyFlowReport(job)
      case 'deep_report':
        return await processDeepReport(job)
      default:
        throw new Error(`Unknown job type: ${job.job_type}`)
    }
  } catch (err) {
    // Error handling logic
  }
}
```

### Retry Logic (`withRetry`)

- **Max Retries**: 3 attempts
- **Backoff Strategy**: Exponential (2^attempt * 2000ms)
- **Retryable Errors**: 
  - HTTP 408, 409, 425, 429, 500, 502, 503, 504
  - Network errors (ECONNRESET, ETIMEDOUT, EAI_AGAIN)
  - Rate limit messages

### Data Models

#### Job Metadata
```typescript
interface Job {
  id: string
  user_id: string | null
  chart_id: string
  job_type: 'yearly_flow_report' | 'deep_report'
  status: 'pending' | 'processing' | 'done' | 'failed'
  result_url: string | null
  metadata: {
    target_year?: number
    subscription_tier?: string
    report_id?: string
    completed_at?: string
    generation_time_ms?: number
    error?: string
    error_stack?: string
    is_non_retryable?: boolean
  } | null
  created_at: string
  updated_at?: string
}
```

#### Report Structure
```typescript
interface BaziReportInsert {
  chart_id: string
  user_id: string | null
  report_type: 'yearly_flow' | 'character_profile'
  title: string
  summary: {
    key_insights: string[]
    strengths: string[]
    areas_for_growth: string[]
    lucky_elements: string[]
    unlucky_elements: string[]
  }
  structured: {
    sections: Array<{
      title: string
      content: string
    }>
  }
  body: string
  model: string
  prompt_version: string
  tokens: number | null
  status: 'completed'
  completed_at: string
}
```

## RAG Integration

### Text Chunking Strategy

1. **Paragraph Splitting**: Split by multiple newlines or markdown headers
2. **Sentence Splitting**: Chinese punctuation (。！？；：) + English punctuation
3. **Chunk Assembly**: Combine sentences into 600-character chunks
4. **Overlap Addition**: 100-character overlap between chunks
5. **Small Chunk Merging**: Merge chunks < 100 characters

### Embedding Generation

- **Model**: `text-embedding-004` (768 dimensions)
- **Batch Size**: 10 chunks per batch
- **Rate Limiting**: 500ms delay between batches
- **Fallback**: Zero vectors on API failures

### Vector Storage

- **Table**: `bazi_report_chunks`
- **Indexing**: HNSW vector index for cosine similarity
- **Metadata**: Section, position, word count
- **Search**: RPC functions for semantic search

## Error Handling

### Job States

1. **pending**: Initial state, waiting to be processed
2. **processing**: Currently being processed by worker
3. **done**: Successfully completed
4. **failed**: Failed after retries or non-retryable error

### Error Classification

#### Retryable Errors
- Rate limits (HTTP 429)
- Timeouts (HTTP 408)
- Server errors (HTTP 5xx)
- Network connectivity issues

#### Non-Retryable Errors
- Chart not found (isNotFound flag)
- Invalid job type
- Malformed metadata
- Database constraint violations

### Error Logging

```typescript
const failedMetadata = {
  ...job.metadata,
  error: errorMessage,
  error_stack: errorStack,
  failed_at: new Date().toISOString(),
  is_non_retryable: isNotFound,
}
```

## Performance Considerations

### Rate Limiting
- **Job Processing**: 1 second delay between jobs
- **Gemini API**: Retry with exponential backoff
- **Embeddings**: 500ms delay between batches

### Resource Management
- **Batch Processing**: 5 jobs per worker run
- **Memory**: Process chunks sequentially
- **Timeouts**: Configurable per operation

### Monitoring Metrics
- **Processing Time**: `generation_time_ms` in job metadata
- **Success Rate**: Track job status transitions
- **Error Patterns**: Categorize and log errors
- **Queue Length**: Monitor pending job count

## Deployment Strategies

### 1. Vercel Cron Jobs
- **Frequency**: Every 5 minutes
- **Limitation**: Requires Vercel Pro plan
- **Implementation**: API endpoint triggered by cron

### 2. External Cron Services
- **Options**: cron-job.org, EasyCron, UptimeRobot
- **Cost**: Free tiers available
- **Setup**: HTTP endpoint with authentication

### 3. Dedicated Server
- **Platforms**: Railway, Render, fly.io
- **Advantage**: Continuous processing
- **Complexity**: Requires server management

### 4. Serverless Functions
- **Platforms**: AWS Lambda, Google Cloud Functions
- **Trigger**: Database events or scheduled
- **Scaling**: Automatic based on load

## Security Considerations

### API Keys
- **Environment Variables**: Never commit to repository
- **Service Role**: Use limited permissions where possible
- **Rotation**: Regular key rotation policy

### Data Access
- **Row Level Security**: Apply appropriate policies
- **Service Account**: Use dedicated worker credentials
- **Audit Logging**: Track all data access

### Input Validation
- **Chart ID**: Verify existence and ownership
- **Metadata**: Validate JSON structure
- **Job Type**: Whitelist supported types

## Testing Strategy

### Unit Tests
- **Individual Functions**: Test each processor in isolation
- **Mock Dependencies**: Supabase, Gemini, external APIs
- **Edge Cases**: Empty data, malformed inputs, errors

### Integration Tests
- **Complete Workflows**: End-to-end job processing
- **Database Integration**: Real database operations
- **Error Scenarios**: Failure recovery and retry logic

### Test Coverage
- **Functions**: All exported functions
- **Branches**: All conditional logic paths
- **Errors**: All error handling scenarios
- **Integration**: External service interactions

## Future Enhancements

### Scalability
- **Horizontal Scaling**: Multiple worker instances
- **Queue Management**: Redis or RabbitMQ for job distribution
- **Load Balancing**: Dynamic job assignment

### Performance
- **Parallel Processing**: Concurrent job handling
- **Caching**: Redis for frequently accessed data
- **Optimization**: Database query tuning

### Features
- **Job Priorities**: High/medium/low priority queues
- **Scheduled Jobs**: User-scheduled report generation
- **Webhooks**: Real-time job status notifications