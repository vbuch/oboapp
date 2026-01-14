---
name: message-pipeline
description: Message ingestion pipeline architecture for processing public infrastructure disruption messages. Use when working with message processing, LLM extraction, geocoding integration, or crawler development. Includes two-stage filtering and extraction.
---

# Message Ingestion Pipeline

## Context

The message ingestion pipeline processes messages about public infrastructure disruptions in Sofia, Bulgaria. It uses a two-stage LLM process (filtering and extraction) followed by geocoding to produce structured, geolocated data for the map application.

**Key Innovation**: Crawlers with precomputed GeoJSON bypass the LLM stages entirely, going directly to finalization.

## Pattern

### Pipeline Flow

```
Raw Message
    ↓
Has Precomputed GeoJSON? ──Yes──→ Skip to Finalization
    ↓ No
Filter Stage (LLM)
    ↓
Is Relevant? ──No──→ Finalize as Irrelevant
    ↓ Yes
Extraction Stage (LLM)
    ↓
Geocoding
    ↓
Finalization (with GeoJSON)
```

## Guidelines

### 1. Two-Stage LLM Processing

#### Stage 1: Filtering (`ingest/prompts/message-filter.md`)

**Purpose**: Determine if message contains public infrastructure information

**Removes**:
- Transport-only content (bus routes, metro schedules, tram timetables)
- Unrelated announcements
- Spam or irrelevant messages

**Returns**:
```typescript
{
  isRelevant: boolean,
  normalizedText: string  // Cleaned, standardized text
}
```

**Outcome**:
- If `isRelevant: false` → Message is finalized immediately without geocoding
- If `isRelevant: true` → Proceed to extraction stage

#### Stage 2: Extraction (`ingest/prompts/data-extraction-overpass.md`)

**Purpose**: Extract structured data from normalized text

**Extracts**:
- **Pins**: Point locations (addresses with street numbers)
- **Streets**: Street sections (intersections, street ranges)
- **Timespans**: Temporal information (dates, durations)
- **Responsible Entity**: Organization responsible for the work
- **Markdown Text**: Formatted display text

**Returns**:
```typescript
interface ExtractedData {
  pins?: Array<{
    street: string;
    number: string;
  }>;
  streets?: Array<{
    name: string;
    startIntersection?: string;
    endIntersection?: string;
  }>;
  timespans?: Array<{
    startDate: string;
    endDate?: string;
  }>;
  responsible_entity?: string;
  markdown_text: string;
}
```

### 2. Crawler Integration

#### Crawlers WITH Precomputed GeoJSON

These crawlers provide ready-made GeoJSON and **skip filtering and extraction**:

- **sofiyska-voda**: Water utility disruptions
- **toplo-bg**: Heating system maintenance
- **erm-zapad**: Electricity grid work

**Pattern**:
```typescript
await ingestMessage({
  text: originalText,
  precomputedGeoJson: validatedGeoJson,  // Already has geometry
  markdownText: formattedMarkdown         // Already has display text
});

// Pipeline skips LLM stages, goes directly to finalization
```

#### Crawlers WITHOUT GeoJSON

These crawlers provide raw text and **go through full LLM pipeline**:

- **rayon-oborishte-bg**: District announcements
- **sofia-bg**: City-wide notifications

**Pattern**:
```typescript
await ingestMessage({
  text: rawAnnouncementText
  // No precomputedGeoJson
  // No markdownText
});

// Pipeline runs: Filter → Extract → Geocode → Finalize
```

### 3. Field Storage in Firestore

Messages are stored in the `messages` collection with these fields:

```typescript
interface MessageDocument {
  // Original input
  text: string;                          // Raw user/crawler input

  // Stage 1: Filtering (if performed)
  messageFilter?: {
    isRelevant: boolean;
    normalizedText: string;
  };

  // Stage 2: Extraction (if performed)
  extractedData?: ExtractedData;

  // Denormalized for display
  markdownText: string;                  // From extractedData or crawler

  // Stage 3: Geocoding result
  geoJson?: GeoJSONFeatureCollection;    // Final geometry

  // Metadata
  source: string;                        // "user", "sofiyska-voda", etc.
  finalizedAt: Timestamp | null;         // Null = still processing
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Key Insight**: `finalizedAt` marks processing complete, whether successful (has `geoJson`) or irrelevant (no `geoJson`).

### 4. Geocoding Integration

After extraction, the pipeline routes locations to appropriate geocoding services:

```typescript
import { geocodeExtractedData } from "@/lib/geocoding-router";

const geoJson = await geocodeExtractedData(extractedData);

// Returns GeoJSONFeatureCollection or null if geocoding fails
```

**Routing logic** (see `.claude/skills/geocoding-services` for details):
- Pins (addresses with numbers) → Google Maps Geocoding
- Streets (intersections) → Overpass API (OpenStreetMap)
- УПИ identifiers → Bulgarian Cadastre API

### 5. Message Lifecycle

```typescript
// 1. Create unfinal message
const messageRef = await adminDb.collection("messages").add({
  text: rawText,
  source: "user",
  finalizedAt: null,  // Not yet processed
  createdAt: new Date(),
  updatedAt: new Date()
});

// 2. Process through pipeline
const filterResult = await filterMessage(rawText);

if (!filterResult.isRelevant) {
  // Finalize as irrelevant
  await messageRef.update({
    messageFilter: filterResult,
    finalizedAt: new Date()
  });
  return;
}

// 3. Extract and geocode
const extractedData = await extractData(filterResult.normalizedText);
const geoJson = await geocodeExtractedData(extractedData);

// 4. Finalize with results
await messageRef.update({
  messageFilter: filterResult,
  extractedData,
  markdownText: extractedData.markdown_text,
  geoJson,
  finalizedAt: new Date(),
  updatedAt: new Date()
});
```

## Examples

### ✅ Good - Crawler with Precomputed GeoJSON

```typescript
import { validateAndFixGeoJSON } from "@/crawlers/shared/geojson-validation";
import { ingestMessage } from "@/lib/message-ingestion";

async function sofiyskavoda_crawler() {
  const items = await fetchFromCMS();

  for (const item of items) {
    // Parse GeoJSON from CMS
    const rawGeoJson = JSON.parse(item.map_coordinates);

    // Validate
    const validation = validateAndFixGeoJSON(rawGeoJson, "sofiyska-voda");

    if (!validation.isValid) {
      console.error(`Invalid GeoJSON for ${item.id}`);
      continue;
    }

    // Ingest with precomputed data - skips LLM stages
    await ingestMessage({
      text: item.original_text,
      precomputedGeoJson: validation.geoJson,
      markdownText: item.formatted_description,
      source: "sofiyska-voda",
      externalId: item.cms_id
    });
  }
}
```

### ✅ Good - Crawler with Full Pipeline

```typescript
import { ingestMessage } from "@/lib/message-ingestion";

async function rayonOborishte_crawler() {
  const announcements = await fetchAnnouncementsFromWebsite();

  for (const announcement of announcements) {
    // Raw text goes through full pipeline
    await ingestMessage({
      text: announcement.raw_text,
      source: "rayon-oborishte-bg",
      externalId: announcement.url_slug
    });

    // Pipeline will:
    // 1. Filter for relevance
    // 2. Extract structured data (pins, streets, timespans)
    // 3. Geocode locations
    // 4. Finalize with GeoJSON
  }
}
```

### ✅ Good - Handling Irrelevant Messages

```typescript
import { filterMessage } from "@/lib/ai-service";

async function processUserMessage(text: string, userId: string) {
  // Create unfinal message
  const messageRef = await adminDb.collection("messages").add({
    text,
    source: "user",
    userId,
    finalizedAt: null,
    createdAt: new Date()
  });

  // Filter stage
  const filterResult = await filterMessage(text);

  if (!filterResult.isRelevant) {
    // Finalize immediately without geocoding
    await messageRef.update({
      messageFilter: filterResult,
      finalizedAt: new Date()
    });

    console.log("Message not relevant - finalized without geocoding");
    return { relevant: false, messageId: messageRef.id };
  }

  // Continue with extraction...
  // (extraction and geocoding code)
}
```

### ❌ Bad - Not Handling Irrelevant Messages

```typescript
// ❌ BAD: Always attempting to geocode, even irrelevant messages
async function processMessage(text: string) {
  const extractedData = await extractData(text); // Waste of LLM call

  // What if message was "The weather is nice today"?
  // We'd try to geocode nothing!

  const geoJson = await geocodeExtractedData(extractedData); // Fails
}
```

### ❌ Bad - Bypassing Validation

```typescript
// ❌ BAD: Using raw GeoJSON without validation
async function crawler() {
  const rawGeoJson = await fetchFromAPI();

  // NEVER skip validation!
  await ingestMessage({
    text: "...",
    precomputedGeoJson: rawGeoJson, // Could have swapped coordinates!
    source: "crawler"
  });
}

// ✅ GOOD: Always validate
const validation = validateAndFixGeoJSON(rawGeoJson, "crawler");
if (validation.isValid) {
  await ingestMessage({
    text: "...",
    precomputedGeoJson: validation.geoJson,
    source: "crawler"
  });
}
```

## Prompt Engineering

### Message Filter Prompt

Location: [ingest/prompts/message-filter.md](../../ingest/prompts/message-filter.md)

**Purpose**: Binary classification (relevant/irrelevant)

**Key Rules**:
- Reject transport-only content
- Accept infrastructure disruptions
- Normalize Bulgarian text
- Return structured JSON

### Data Extraction Prompt

Location: [ingest/prompts/data-extraction-overpass.md](../../ingest/prompts/data-extraction-overpass.md)

**Purpose**: Structured data extraction

**Key Rules**:
- Extract pins with street + number
- Extract streets with intersections
- Parse Bulgarian date formats
- Generate markdown for display

## Debugging Pipeline Issues

### Message stuck in processing

**Symptom**: `finalizedAt` is null for extended period

**Check**:
1. LLM stage logs - did filtering/extraction fail?
2. Geocoding logs - did geocoding timeout?
3. Error handlers - are exceptions being caught?

### GeoJSON not appearing on map

**Symptom**: Message finalized but no geometry

**Check**:
1. Was message marked irrelevant? (`messageFilter.isRelevant === false`)
2. Did geocoding return null? (all locations outside Sofia)
3. Is GeoJSON valid? (should have been validated)

### Crawler messages skipping pipeline

**Symptom**: Messages appear immediately without processing delay

**Explanation**: Working as designed! Crawlers with `precomputedGeoJson` bypass LLM stages.

## References

- **Pipeline README**: [ingest/messageIngest/README.md](../../ingest/messageIngest/README.md)
- **Filter prompt**: [ingest/prompts/message-filter.md](../../ingest/prompts/message-filter.md)
- **Extraction prompt**: [ingest/prompts/data-extraction-overpass.md](../../ingest/prompts/data-extraction-overpass.md)
- **AI Service**: [ingest/lib/ai-service.ts](../../ingest/lib/ai-service.ts)
- **Related Skills**:
  - `.claude/skills/geojson-handling` - For validating GeoJSON
  - `.claude/skills/geocoding-services` - For geocoding extracted locations
  - `.claude/skills/firebase-integration` - For accessing Firestore
- **Feature Docs**:
  - [docs/features/message-filtering.md](../../docs/features/message-filtering.md)
