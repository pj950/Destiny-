# Worker Service

## Overview

The background worker service has been refactored into a modular structure located at `src/services/worker/`. This service handles asynchronous job processing for report generation, AI analysis, and RAG chunking.

## Architecture

The worker is organized into several focused modules:

### Core Modules

- **`index.ts`** - Main entry point that validates environment and starts the worker
- **`types.ts`** - TypeScript interfaces for jobs and supported job types
- **`processor.ts`** - Main job processing loop and routing logic
- **`utils.ts`** - Utility functions (retry logic, logging, sleep)

### Service Modules

- **`database.ts`** - Database operations (fetch jobs, update status)
- **`charts.ts`** - Chart loading, insights computation, report persistence
- **`ai.ts`** - Gemini AI integration for report generation
- **`rag.ts`** - RAG (Retrieval-Augmented Generation) chunk processing

### Job Processors

- **`jobs/index.ts`** - Exports all job processors
- **`jobs/deep-report.ts`** - Handles deep character profile reports
- **`jobs/yearly-flow-report.ts`** - Handles yearly flow fortune reports

## Supported Job Types

- `deep_report` - Generates comprehensive character profile reports
- `yearly_flow_report` - Creates yearly fortune analysis with energy flow predictions

## Running the Worker

### Development

```bash
# Run worker with environment variables from .env.local
npm run worker

# Run worker with debug logging
npm run worker:debug

# Run worker tests
npm run worker:test
```

### Environment Variables Required

The worker requires these environment variables:

```bash
# AI/ML
GOOGLE_API_KEY=your_gemini_api_key
GEMINI_MODEL_REPORT=gemini-2.5-pro  # optional, defaults to gemini-2.5-pro

# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Job Processing Flow

1. **Job Fetching** - Worker fetches pending jobs in batches (configurable batch size)
2. **Job Routing** - Jobs are routed to appropriate processors based on job_type
3. **Chart Loading** - Chart data and insights are loaded from database
4. **AI Processing** - Gemini generates reports based on job type and chart data
5. **Report Persistence** - Reports are saved to `bazi_reports` table with structured data
6. **RAG Processing** - Report text is chunked and embedded for semantic search
7. **Storage Upload** - Reports are uploaded to Supabase Storage for backward compatibility
8. **Job Completion** - Job status is updated to 'done' with result URL

## Error Handling

- **Retry Logic** - Retryable errors (rate limits, timeouts) are retried with exponential backoff
- **Non-Retryable Errors** - Chart not found errors are marked as non-retryable
- **Graceful Degradation** - RAG processing failures don't fail the entire job
- **Comprehensive Logging** - All operations are logged with timestamps and job IDs

## Testing

The worker includes comprehensive test coverage:

```bash
# Run all worker tests
npm run worker:test

# Run tests in watch mode
npm run test:worker:watch
```

Tests cover:
- Job routing logic
- Error handling scenarios
- Database operations
- AI integration
- RAG processing
- Storage operations
- Retry logic

## Migration from Old Structure

The worker was previously located at `worker/worker.ts`. Key changes:

- **New Location**: `src/services/worker/index.ts`
- **Modular Structure**: Split into focused modules instead of one large file
- **Better Separation**: Database, AI, and business logic are separated
- **Improved Testing**: Each module can be tested independently
- **Cleaner Imports**: Uses relative imports to service modules
- **Enhanced Documentation**: Comprehensive documentation for each module

All functionality remains the same, just better organized for maintainability.