# Event Aggregation

## Overview

Multiple sources (crawlers) sometimes report the same real-world incident — for example, both the municipality's website and Toplofikatsia may announce the same heating outage. Without aggregation, each announcement becomes a duplicate marker on the map.

The **Event Aggregation** layer groups related messages into a single Event representing one real-world incident. Each Event tracks which messages contributed to it, selects the best available geometry, and provides a canonical description.

## Data Model

### Events

An Event represents a single real-world infrastructure disruption.

| Field                   | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| `canonicalText`         | Normalized plain-text description                     |
| `canonicalMarkdownText` | Markdown-formatted description (optional)             |
| `geometry`              | Best available GeoJSON FeatureCollection               |
| `geometryQuality`       | 0–3 quality rating (0 = unknown, 3 = official GeoJSON)|
| `timespanStart`         | Earliest start time across all linked messages        |
| `timespanEnd`           | Latest end time across all linked messages            |
| `categories`            | Merged set of categories from linked messages         |
| `sources`               | List of distinct crawler sources                      |
| `messageCount`          | Number of linked messages                             |
| `confidence`            | Aggregated match confidence (0–1)                     |
| `locality`              | Locality identifier (e.g., `bg.sofia`)                |
| `cityWide`              | Whether the event applies city-wide                   |
| `createdAt` / `updatedAt` | Timestamps                                          |

### Event Messages (Links)

Each link connects one message to one event with metadata about the match.

| Field             | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `eventId`         | Reference to the parent Event                        |
| `messageId`       | Reference to the linked Message                      |
| `source`          | Crawler that produced the message                    |
| `confidence`      | Match confidence (0–1)                               |
| `geometryQuality` | Quality of this message's geometry at time of linking|
| `matchSignals`    | Breakdown of match scores (optional)                 |
| `createdAt`       | When the link was created                            |

### Match Signals

When a message is matched to an existing event (not the first message), `matchSignals` records the scoring breakdown:

- `locationSimilarity` — spatial proximity (0–1)
- `timeOverlap` — temporal overlap percentage (0–1)
- `categoryMatch` — Jaccard similarity of categories (0–1)
- `textSimilarity` — embedding cosine similarity, when available (0–1)

## Source Trust

Each crawler has a preconfigured trust level and default geometry quality. These scores influence event matching confidence and determine which message's geometry the event adopts.

| Source               | Trust | Default Geometry Quality |
| -------------------- | ----- | ------------------------ |
| toplo-bg             | 1.0   | 3 (official GeoJSON)     |
| sofiyska-voda        | 1.0   | 3                        |
| erm-zapad            | 0.9   | 3                        |
| nimh-severe-weather  | 0.9   | 3                        |
| Municipality sources | 0.8   | 2 (geocoded address)     |
| Unknown sources      | 0.5   | 0                        |

Configuration: [ingest/lib/source-trust.ts](../ingest/lib/source-trust.ts)

## Database Access

Both collections are accessed through `@oboapp/db`. See [database-layer.md](database-layer.md) for general patterns.

```typescript
const db = await getDb();

// Find candidate events for matching
const candidates = await db.events.findCandidates("bg.sofia", startDate, endDate);

// Link a message to an event
await db.eventMessages.insertOne({ eventId, messageId, source, confidence: 0.85 });
```

## Event Matching (Phase 2)

When a message is finalized with GeoJSON in the ingestion pipeline, it is automatically matched against existing events.

### Pipeline Integration

After `finalizeMessageWithResults()` stores the GeoJSON, `runEventMatching()` runs:

1. **Find candidates** — queries events in the same locality within a ±2 day time window
2. **Score each candidate** — computes a weighted match score
3. **Decide** — if the best score exceeds 0.70, attach to that event; otherwise create a new event

The matching step is wrapped in a try/catch so failures don't block the pipeline.

### Scoring Formula

$$
\text{score} = 0.50 \times \text{locationSimilarity} + 0.35 \times \text{timeOverlap} + 0.15 \times \text{categoryMatch}
$$

| Signal              | How it's computed                                                   |
| ------------------- | ------------------------------------------------------------------- |
| locationSimilarity  | Inverse-linear distance between centroids. 1.0 at 0 m, 0.0 at ≥ 500 m. City-wide messages always score 1.0. |
| timeOverlap         | Overlap / union ratio of timespan intervals. 0.0 if no overlap.    |
| categoryMatch       | Jaccard similarity of category sets. 0.0 if both empty.            |

### Attaching to an Existing Event

When a message matches an event above threshold:

- **Timespans** expand to the union (earlier start, later end)
- **Geometry** upgrades if the new message has higher quality (per source trust)
- **Sources** are added (deduplicated)
- **Categories** merge as a set union
- **messageCount** increments

### City-Wide Handling

City-wide messages (`cityWide: true`) only match against other city-wide events. Location similarity is always 1.0 for city-wide matches.

### Configuration

Constants in `ingest/lib/event-matching/constants.ts`:

| Constant                    | Value | Purpose                          |
| --------------------------- | ----- | -------------------------------- |
| MATCH_THRESHOLD             | 0.70  | Minimum score to attach          |
| CANDIDATE_TIME_WINDOW_DAYS  | 2     | ±days to search for candidates   |
| CANDIDATE_DISTANCE_METERS   | 500   | Max centroid distance cutoff     |
| LOCATION_WEIGHT             | 0.50  | Weight for spatial similarity    |
| TIME_WEIGHT                 | 0.35  | Weight for temporal overlap      |
| CATEGORY_WEIGHT             | 0.15  | Weight for category match        |

## Migration

To create initial 1:1 events from existing finalized messages:

```bash
cd db
npx tsx migrate/2026-03-15-create-events-from-messages.ts
```

The migration is idempotent — running it again skips already-linked messages.
