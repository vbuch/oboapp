# Historic Data Heatmap

A read-only page that visualises the full message history as a heatmap, enabling coverage analysis of the crawled locality.

## Screenshot

![Historic data heatmap page showing Sofia, Bulgaria on a desaturated Leaflet map](https://github.com/user-attachments/assets/ff68d257-ca7d-4efa-83c6-9a3a6f165375)

## Purpose

With ~5 000+ messages (at the time of implementation) in the collection — each potentially containing multiple geometry features — it is not practical to render them all on the regular Google Maps view. This page uses [Leaflet](https://leafletjs.com/) with the [leaflet.heat](https://github.com/Leaflet/Leaflet.heat) plugin and free OpenStreetMap tiles, which scale to any number of points without API-key costs.

The map can be used to:

- Identify **hotspot areas** that appear frequently in crawler output.
- Spot **coverage gaps** — neighbourhoods rarely or never mentioned in source data.
- Evaluate whether adding new crawlers for under-represented areas would improve coverage.

## URL

`/history`

## How It Works

1. The page fetches `GET /api/messages/heatmap`.
2. The API reads all finalized messages (those with a `finalizedAt` timestamp) from the database, requesting only the `geoJson` and `cityWide` fields to minimise data transfer.
3. City-wide messages are excluded — they carry no specific geometry.
4. For every GeoJSON feature in each message's `FeatureCollection`, the centroid coordinate is computed and added to the result array.
5. The client renders the points as a heatmap layer using `leaflet.heat`.

## Database Considerations

The API query uses a `finalizedAt != null` filter. Both Firestore and MongoDB support this inequality operator; no additional index is required beyond the existing `finalizedAt` descending index.

Because only two fields are selected (`geoJson`, `cityWide`), the payload per document is small even when the full collection is large.

## Dual Database Setup

The endpoint uses `getDb()` from `@/lib/db`, which transparently reads from whichever backend is configured (`DB_READ_SOURCE`). No database-specific code is needed in the API route.
