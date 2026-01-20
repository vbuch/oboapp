# Failure Reason Storage in Messages

## Overview

When messages fail during the ingestion pipeline, the failure reason is now stored in the `failureReason` field of the message document. This enhancement improves debugging, monitoring, and user feedback for failed message processing.

## Implementation Details

### Database Schema

The `Message` type has been extended with an optional `failureReason` field:

```typescript
export interface Message {
  // ... existing fields ...
  failureReason?: string;
}
```

This field is present in both:
- `ingest/lib/types.ts` - Server-side types
- `web/lib/types.ts` - Client-side types

### Failure Scenarios

#### 1. Categorization Failure

**When it occurs:** AI categorization service fails or returns null

**Failure reason:** `"Message categorization failed"`

**Code location:** `ingest/messageIngest/index.ts` - `processCategorizedMessages()`

**Behavior:**
- Message is stored with the original text
- `finalizedAt` timestamp is set
- `failureReason` is set to "Message categorization failed"
- Returns result with totalCategorized: 0

#### 2. Extraction Failure

**When it occurs:** Data extraction from message text fails (extractAddressesFromMessage returns null)

**Failure reason:** `"Failed to extract data from message text"`

**Code location:** `ingest/messageIngest/index.ts` - `processSingleMessage()` → `finalizeFailedMessage()`

**Behavior:**
- Message is marked as finalized
- `failureReason` is set
- No extracted data or GeoJSON is stored

#### 3. Boundary Filtering Failure

**When it occurs:** No GeoJSON features are within specified boundaries

**Failure reason:** `"No features within specified boundaries"`

**Code location:** `ingest/messageIngest/index.ts` - `applyBoundaryFilteringIfNeeded()`

**Behavior:**
- Message is finalized with the failure reason
- Exception is thrown (caught by caller)
- Not logged as an error in `from-sources.ts` (expected behavior)

#### 4. General Processing Errors

**When it occurs:** Any other error during message processing (geocoding errors, etc.)

**Failure reason:** Error message from the caught exception

**Code location:** 
- `ingest/messageIngest/index.ts` - `processCategorizedMessages()` (try-catch around processSingleMessage)
- `ingest/messageIngest/index.ts` - `processPrecomputedGeoJsonMessage()` (try-catch)

**Behavior:**
- Exception is caught
- `failureReason` is set to the error message
- Message is finalized
- Returns failed message in result

## Usage Examples

### Querying Failed Messages

```typescript
// Get all failed messages
const failedMessages = await adminDb
  .collection('messages')
  .where('failureReason', '!=', null)
  .get();

// Get messages that failed categorization
const categorizationFailures = await adminDb
  .collection('messages')
  .where('failureReason', '==', 'Message categorization failed')
  .get();

// Get messages outside boundaries
const boundaryFailures = await adminDb
  .collection('messages')
  .where('failureReason', '==', 'No features within specified boundaries')
  .get();
```

### Displaying Failure Reasons in UI

```typescript
// In a React component
{message.failureReason && (
  <div className="alert alert-warning">
    <strong>Processing Failed:</strong> {message.failureReason}
  </div>
)}
```

## Benefits

1. **Better Debugging**: Developers can quickly identify why messages failed to process
2. **Monitoring**: Track failure rates and patterns over time
3. **User Feedback**: Can inform users why their submission failed
4. **Analytics**: Identify common failure modes for system improvements

## Testing

The feature includes comprehensive tests in `ingest/messageIngest/failure-reason.test.ts`:
- Categorization failure handling
- Extraction failure handling
- Boundary filtering failure handling
- Successful ingestion (no failure reason)

All 448 tests pass, including 4 new tests for failure reason storage.

## Related Issues

- Related to issue #56 (debugging failed messages)
