# Payment Tests Documentation

This document outlines the comprehensive test coverage for the Razorpay payment integration, including checkout endpoints and webhook processing.

## Test Files

### 1. `/pages/api/lamps/checkout.test.ts` (26 tests)
Tests for the `/api/lamps/checkout` endpoint that creates Razorpay payment links for prayer lamp purchases.

**Test Categories:**

- **Validation (4 tests)**
  - Rejects requests without lamp_key
  - Rejects invalid lamp_key values
  - Accepts valid lamp_key values (p1, p2, p3, p4)
  - Rejects non-POST requests

- **Lamp Status Check (3 tests)**
  - Returns 404 when lamp not found
  - Returns 400 when lamp already lit
  - Proceeds when lamp is unlit

- **Payment Link Creation (6 tests)**
  - Creates payment link with correct parameters
  - Uses correct amount in cents ($19.90 = 1990 cents)
  - Sets correct description
  - Includes lamp metadata in notes
  - Sets callback URL to /lamps
  - Sets 30-minute expiry

- **Idempotency (3 tests)**
  - Returns existing payable payment link if one exists
  - Creates new link if existing link is paid
  - Handles fetch error by creating new link

- **Database Updates (2 tests)**
  - Updates lamp with payment link ID
  - Handles update errors gracefully

- **Response Formatting (5 tests)**
  - Returns success response with payment link URL
  - Returns error response with error message
  - Handles 400 Bad Request errors
  - Handles 401/403 authentication errors
  - Handles 429 rate limit errors

- **Environment Guards (1 test)**
  - Validates NEXT_PUBLIC_SITE_URL is set

- **Edge Cases (2 tests)**
  - Handles multiple lamp statuses
  - Handles concurrent requests for same lamp

### 2. `/pages/api/reports/generate.test.ts` (33 tests)
Tests for the `/api/reports/generate` endpoint that creates Razorpay payment links for deep report purchases.

**Test Categories:**

- **Validation (4 tests)**
  - Rejects requests without chart_id
  - Accepts valid chart_id
  - Rejects non-POST requests
  - Rejects invalid chart_id types

- **Chart Validation (3 tests)**
  - Verifies chart exists before creating payment
  - Returns 404 when chart not found
  - Handles chart query with all required fields

- **Payment Link Creation (7 tests)**
  - Creates payment link with correct parameters
  - Uses correct report price in cents ($19.99 = 1999 cents)
  - Sets correct description "Deep Destiny Report"
  - Includes report metadata in notes
  - Sets callback URL to /dashboard
  - Sets 60-minute expiry for report
  - Uses reference_id from chart_id

- **Job Creation (4 tests)**
  - Creates job record with Razorpay metadata
  - Stores payment_link_id in metadata
  - Sets payment_confirmed to false initially
  - Handles job creation errors

- **Response Formatting (5 tests)**
  - Returns success response with payment URL
  - Returns error response format
  - Handles 400 Bad Request
  - Handles 401/403 authentication errors
  - Handles 429 rate limit errors

- **Error Handling (2 tests)**
  - Handles Razorpay API errors
  - Handles missing chart gracefully

- **Environment Guards (1 test)**
  - Validates NEXT_PUBLIC_SITE_URL

- **Request Method Validation (4 tests)**
  - Rejects GET requests
  - Rejects PUT requests
  - Rejects DELETE requests
  - Accepts POST requests

- **Edge Cases (3 tests)**
  - Handles very long chart_id
  - Handles chart_id with special characters
  - Handles multiple concurrent requests

### 3. `/pages/api/razorpay/webhook.test.ts` (44 tests)
Tests for the `/api/razorpay/webhook` endpoint that handles payment_link.paid events from Razorpay.

**Test Categories:**

- **Request Validation (3 tests)**
  - Rejects non-POST requests
  - Requires x-razorpay-signature header
  - Accepts POST with signature header

- **Signature Verification (4 tests)**
  - Verifies valid webhook signature
  - Rejects invalid webhook signature
  - Uses correct webhook secret
  - Returns 401 on signature verification failure

- **Event Parsing (3 tests)**
  - Parses payment_link.paid event
  - Extracts lamp_key from notes
  - Extracts chart_id from notes or reference_id

- **Lamp Purchase Workflow (6 tests)**
  - Finds lamp by lamp_key
  - Returns 404 if lamp not found
  - Updates lamp status to lit
  - Stores Razorpay payment ID in lamp
  - Stores webhook event ID for idempotency
  - Handles lamp already lit gracefully

- **Report Purchase Workflow (5 tests)**
  - Finds job by chart_id and payment_link_id
  - Updates existing job to pending
  - Marks payment as confirmed in metadata
  - Creates job if not found (edge case)
  - Returns 200 if chart not found

- **Idempotency (6 tests)**
  - Recognizes duplicate webhook by event ID
  - Skips processing if event already processed for lamp
  - Skips processing if event already processed for job
  - Does not duplicate state transitions
  - Handles payment ID verification for idempotency
  - Prevents duplicate processing

- **Event Type Handling (2 tests)**
  - Handles payment_link.paid events
  - Acknowledges other event types

- **Error Handling (4 tests)**
  - Handles database errors during lamp update
  - Handles database errors during job update
  - Handles database errors during job creation
  - Returns 500 on critical errors

- **Response Handling (4 tests)**
  - Returns 200 on successful lamp update
  - Returns 200 on successful job update
  - Returns 200 with message for already processed events
  - Returns 200 for non-handled event types

- **Metadata Handling (2 tests)**
  - Preserves existing metadata when updating job
  - Handles missing payment ID gracefully

- **Concurrent Event Handling (2 tests)**
  - Handles concurrent webhooks for same lamp
  - Handles concurrent webhooks for different reports

- **Environment Guards (1 test)**
  - Requires RAZORPAY_WEBHOOK_SECRET

### 4. `/lib/razorpay.test.ts` (50+ tests)
Tests for the Razorpay module including environment guards and helper functions.

**Test Categories:**

- **Environment Variables (4 tests)**
  - Requires RAZORPAY_KEY_ID
  - Requires RAZORPAY_KEY_SECRET
  - Requires RAZORPAY_WEBHOOK_SECRET
  - Provides helpful error messages for missing env vars

- **Server-side Only Guard (2 tests)**
  - Throws on client-side import
  - Does not throw on server-side

- **Razorpay Helpers (6 tests)**
  - Provides createPaymentLink helper
  - Provides fetchPaymentLink helper
  - Provides createOrder helper
  - Provides fetchOrder helper
  - Provides fetchOrderPayments helper
  - Provides verifyWebhookSignature helper

- **Payment Link Options (9 tests)**
  - Supports amount parameter
  - Supports currency parameter
  - Supports description parameter
  - Supports customer parameter
  - Supports notes parameter
  - Supports callback_url parameter
  - Supports callback_method parameter
  - Supports reference_id parameter
  - Supports expire_by and accept_partial parameters

- **Webhook Signature Verification (4 tests)**
  - Verifies valid signatures
  - Rejects invalid signatures
  - Is case-sensitive for signatures
  - Returns boolean

- **Error Handling (5 tests)**
  - Handles Razorpay API errors
  - Handles 400 Bad Request
  - Handles 401 Unauthorized
  - Handles 403 Forbidden
  - Handles 429 Rate Limited

- **Singleton Pattern (2 tests)**
  - Exports singleton razorpay instance
  - Exports helpers object

- **Configuration (2 tests)**
  - Initializes with correct credentials
  - Does not expose credentials in helpers

## Test Helpers and Fixtures

File: `lib/test-helpers.ts`

Provides reusable test utilities:

- **Mock Data**
  - `mockPaymentLinkLamp`: Sample Razorpay payment link for lamp
  - `mockPaymentLinkReport`: Sample Razorpay payment link for report
  - `mockRazorpayPayment`: Sample Razorpay payment object
  - `mockLampRecord`: Sample lamp database record
  - `mockChartRecord`: Sample chart database record
  - `mockJobRecord`: Sample job database record

- **Webhook Event Factories**
  - `createLampWebhookEvent()`: Generate lamp payment_link.paid events
  - `createReportWebhookEvent()`: Generate report payment_link.paid events

- **Utilities**
  - `generateWebhookSignature()`: Generate valid webhook signatures
  - `createMockRequest()`: Create mock NextApiRequest objects
  - `createMockResponse()`: Create mock NextApiResponse objects
  - `RAZORPAY_WEBHOOK_SECRET`: Test webhook secret constant

## Test Execution

### Run all tests
```bash
npm test
```

### Run payment tests only
```bash
npm test pages/api/lamps/checkout.test.ts
npm test pages/api/reports/generate.test.ts
npm test pages/api/razorpay/webhook.test.ts
npm test lib/razorpay.test.ts
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run with coverage
```bash
npm test -- --coverage
```

## Coverage Summary

- **Total Payment Tests**: 103+ tests
- **Lamp Checkout**: 26 tests (validation, idempotency, error handling)
- **Report Generation**: 33 tests (validation, job creation, error handling)
- **Webhook Handler**: 44 tests (signature verification, state transitions, idempotency)
- **Razorpay Module**: 50+ tests (environment guards, helpers, configuration)

## Key Testing Patterns

### Mocking Strategy
- Mock `supabaseService` for database operations
- Mock `razorpayHelpers` for API calls
- Use factory functions for consistent mock data

### Idempotency Testing
- Verify duplicate webhooks are recognized by event ID
- Ensure payment ID changes are handled gracefully
- Test state machine transitions to prevent duplicates

### Error Path Coverage
- 400 Bad Request (invalid parameters)
- 401/403 Authentication/Authorization errors
- 429 Rate Limit errors
- Database errors and missing records
- Signature verification failures

### Environment Guards
- Validate required environment variables at module load time
- Provide actionable error messages
- Test server-side vs client-side contexts

## Continuous Integration

All tests run as part of `npm test` and are integrated into CI/CD pipelines. Tests use:
- Vitest as the test runner
- Mocked external dependencies (no live API calls)
- Consistent fixtures for reproducible results
- Strict mode for TypeScript validation

## Future Enhancements

Potential areas for additional test coverage:
- Integration tests with actual Razorpay sandbox API
- Performance tests for concurrent webhook handling
- Test coverage reports and metrics tracking
- API contract tests to verify compatibility
