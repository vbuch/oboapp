# Message URLs

## Overview

Messages are accessible via user-friendly, shareable URLs similar to YouTube's short links. Each message receives a unique 8-character alphanumeric slug (e.g., `aB3xYz12`) during ingestion, enabling clean URLs like `oboapp.online/m/aB3xYz12`.

## URL Format

### Internal Navigation (Query Params)

**Format**: `/?slug={slug}`

**Example**: `https://oboapp.online/?slug=aB3xYz12`

Internal links (map clicks, message cards, notifications) use query parameters so the message detail opens as an overlay on top of the map — same as the legacy `?messageId=` flow. This avoids unmounting the homepage and preserves the map context.

### Shareable/External Links

**Format**: `/m/{slug}`

**Example**: `https://oboapp.online/m/aB3xYz12`

External links (push notifications, social sharing) use the clean `/m/{slug}` path format. The `/m/[slug]` route **redirects** to `/?slug={slug}`, so the message detail always renders as a homepage overlay.

- **Short**: 8 characters, easy to share
- **Persistent**: Slug never changes once assigned
- **Unique**: Base62 encoding provides 218 trillion possible combinations

### Legacy Format (Fallback)

**Format**: `/?messageId={id}`

**Example**: `https://oboapp.online/?messageId=abc123def456`

Messages without slugs (pre-migration data) continue to work via Firestore document IDs.

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
npx tsx migrate/2024-02-06-add-message-slugs.ts
```

The script is located in `ingest/migrate/2024-02-06-add-message-slugs.ts` and:

- Processes all messages without slugs
- Generates unique slugs in batches of 100
- Updates Firestore documents
- Logs progress and errors
- Is safe to re-run (skips messages with existing slugs)

See `ingest/migrate/README.md` for migration guidelines and naming conventions.

## Frontend Integration

### Link Generation

Use `createMessageUrl()` from `web/lib/url-utils.ts`:

```typescript
import { createMessageUrl } from "@/lib/url-utils";

const url = createMessageUrl(message);
// Returns: "/?slug=aB3xYz12" (if slug exists)
// Returns: "/?messageId=abc123" (fallback if no slug)
```

For notification cards with partial data:

```typescript
import { createMessageUrlFromId } from "@/lib/url-utils";

const url = createMessageUrlFromId(messageId, slug);
// Returns: "/?slug=aB3xYz12" (if slug provided)
// Returns: "/?messageId=abc123" (fallback)
```

### Route Handling

All message details render as an overlay on the homepage map:

1. **Homepage `/?slug={slug}`** - Primary route for slug-based URLs
   - `HomeContent` looks up the message in viewport messages by slug
   - If not found in viewport (e.g., message outside current map bounds), fetches via `/api/messages/by-slug`
   - Renders `MessageDetailView` as a slide-in panel over the map

2. **Homepage `/?messageId={id}`** - Legacy fallback
   - Same overlay behavior, matches by Firestore document ID
   - Backwards compatible with old links

3. **`/m/[slug]/page.tsx`** - External URL redirect
   - Redirects to `/?slug={slug}`
   - Exists to support clean shareable URLs from push notifications and social sharing

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
- Slugs are immutable once assigned (enforced in ingestion pipeline)
- No breaking changes to existing functionality
