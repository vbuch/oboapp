# Message URLs

## Overview

Messages are accessible via user-friendly, shareable URLs similar to YouTube's short links. Each message receives a unique 8-character alphanumeric slug (e.g., `aB3xYz12`) during ingestion, enabling clean URLs like `oboapp.online/m/aB3xYz12`.

## URL Format

### Direct Message Links

**Format**: `/m/{slug}`

**Example**: `https://oboapp.online/m/aB3xYz12`

Direct links open the message detail view immediately. These URLs are:
- **Short**: 8 characters, easy to share
- **Persistent**: Slug never changes once assigned
- **Unique**: Base62 encoding provides 218 trillion possible combinations

### Legacy Format (Fallback)

**Format**: `/?messageId={id}`

**Example**: `https://oboapp.online/?messageId=abc123def456`

Messages without slugs (pre-migration data) continue to work via Firestore document IDs. The system automatically falls back to this format when no slug exists.

## Slug Generation

### Character Set

Slugs use base62 encoding (0-9, A-Z, a-z) for URL-safety and readability:
- No special characters requiring URL encoding
- Case-sensitive for maximum entropy
- Human-readable and typeable

### Collision Handling

The system checks for duplicates before assignment:
1. Generate random 8-character slug
2. Query Firestore for existing slug
3. If collision detected, retry (max 10 attempts)
4. Assign unique slug to message

With 62^8 possible combinations, collision probability is negligible even for millions of messages.

## Message Lifecycle

### New Messages (Post-Migration)

1. Message created in Firestore (without slug)
2. AI filtering and geocoding pipeline processes message
3. **Before finalization**: System generates unique slug
4. Slug stored alongside `finalizedAt` timestamp
5. Message becomes publicly visible with slug-based URL

### Existing Messages (Pre-Migration)

Run migration script to backfill slugs for existing messages:

```bash
cd ingest
npm run migrate:slugs
```

The script:
- Processes all messages without slugs
- Generates unique slugs in batches of 500
- Updates Firestore documents
- Logs progress and errors

## Frontend Integration

### Link Generation

Use `createMessageUrl()` from `web/lib/url-utils.ts`:

```typescript
import { createMessageUrl } from "@/lib/url-utils";

const url = createMessageUrl(message);
// Returns: "/m/aB3xYz12" (if slug exists)
// Returns: "/?messageId=abc123" (fallback if no slug)
```

For notification cards with partial data:

```typescript
import { createMessageUrlFromId } from "@/lib/url-utils";

const url = createMessageUrlFromId(messageId, slug);
// Returns: "/m/aB3xYz12" (if slug provided)
// Returns: "/?messageId=abc123" (fallback)
```

### Route Handling

Two routes handle message display:

1. **`/m/[slug]/page.tsx`** - Primary route for slug-based URLs
   - Fetches message via `/api/messages/by-slug?slug={slug}`
   - Renders MessageDetailView component
   - 404 if slug not found

2. **Homepage `/?messageId={id}`** - Legacy fallback
   - Fetches message via main messages API
   - Supports filtering by messageId query param
   - Backwards compatible with old links

## API Endpoints

### Fetch by Slug

**GET** `/api/messages/by-slug?slug={slug}`

**Response**:
```json
{
  "message": {
    "id": "abc123",
    "slug": "aB3xYz12",
    "text": "...",
    "geoJson": {...},
    ...
  }
}
```

**Error Codes**:
- `400` - Invalid slug format
- `404` - Message not found
- `500` - Server error

### Validation

Slugs must be exactly 8 alphanumeric characters. Server validates format before querying Firestore to prevent malicious queries.

## Push Notifications

Notification payloads include slug-based URLs:

```json
{
  "data": {
    "url": "https://oboapp.online/m/aB3xYz12",
    ...
  },
  "webpush": {
    "fcmOptions": {
      "link": "https://oboapp.online/m/aB3xYz12"
    }
  }
}
```

Users clicking notifications navigate directly to the message detail page via clean URLs.

## Database Schema

### Firestore Fields

**messages collection**:
- `slug` (string, optional): 8-character unique identifier
- Automatically indexed for equality queries
- No composite index required

**notificationMatches collection**:
- `messageSnapshot.slug` (string, optional): Denormalized for notification rendering

### Migration Considerations

- Existing messages work without slugs (fallback to ID)
- Migration can run gradually without downtime
- Slugs are immutable once assigned
- No breaking changes to existing functionality
