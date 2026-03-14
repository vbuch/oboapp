# Event Aggregation

## Overview

Multiple sources (crawlers) sometimes report the same real-world incident — for example, both the municipality's website and Toplofikatsia may announce the same heating outage. Without aggregation, each announcement becomes a duplicate marker on the map.

The **Event Aggregation** layer groups related messages into a single **Event** representing one real-world incident. Each Event tracks which messages contributed to it, selects the best available geometry, and provides a canonical description.

## How It Works

When a message is finalized with GeoJSON, the pipeline automatically tries to match it against existing events:

1. **Find candidates** — queries events in the same locality within a ±2 day time window
2. **Score each candidate** — computes a weighted score based on location proximity, time overlap, text similarity (via embeddings), and category similarity
3. **Decide** — if the best score exceeds the threshold (0.70), attach to that event; otherwise create a new event

Matching never blocks the main pipeline — failures are logged but don't prevent message finalization.

### What Happens When a Message Matches

- **Timespans** expand to cover both the existing event and the new message
- **Geometry** upgrades if the new message comes from a more trusted source
- **Sources** and **categories** merge (deduplicated)

### City-Wide Events

City-wide messages only match against other city-wide events. They always score maximum location similarity since they apply to the entire city.

### Pre-Geocoding Reuse

Before geocoding, the pipeline checks if a high-quality event already exists for the same incident. If found (score ≥ 0.80, geometry quality ≥ 2), the event's geometry is reused and geocoding is skipped entirely. This saves Google/Overpass API calls when a trusted source has already been geocoded. When embeddings are available, the threshold lowers to 0.75 since text similarity provides an additional matching signal.

Pre-geocoding scoring uses time overlap and category match (no spatial comparison since GeoJSON doesn't exist yet). When embeddings are available, text similarity is included in the pre-geocode score.

### Text Similarity (Embeddings)

Messages and events store text embeddings generated via Gemini `text-embedding-004` (768 dimensions). When both a message and a candidate event have embeddings, cosine similarity is used as the text matching signal.

**Scoring formula:**
- With embeddings: 0.35 location + 0.25 time + 0.25 text + 0.15 category
- Without embeddings (fallback): 0.50 location + 0.35 time + 0.15 category

Embeddings are optional — old messages/events without embeddings use fallback weights automatically.

**Configuration:** Set `GOOGLE_EMBEDDING_MODEL` environment variable (default: `text-embedding-004`).

**Cleanup:** Expired messages/events have their embedding fields removed to save Firestore storage. Run `cd ingest && pnpm tsx scripts/cleanup-embeddings.ts` manually or schedule as a weekly cron.

## Source Trust

Higher-trust sources (e.g., utility companies with official GeoJSON) produce higher-quality geometry. When a more trusted source reports the same incident, its geometry replaces the existing one. See `ingest/lib/source-trust.ts` for the full trust table.

## Migration

To create initial 1:1 events from existing finalized messages:

```bash
cd db
npx tsx migrate/2026-03-15-create-events-from-messages.ts
```

The migration is idempotent — running it again skips already-linked messages.

## Related

- [database-layer.md](database-layer.md) — DB access patterns for `events` and `eventMessages` collections
- `ingest/lib/event-matching/` — matching implementation
- `ingest/lib/event-matching/constants.ts` — scoring thresholds and weights
