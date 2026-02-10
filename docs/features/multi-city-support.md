# Multi-City Support via Target Field

## Overview

The project now supports hosting crawlers and messages for cities other than Sofia through the `target` field.

## Architecture

### Target Field

- **Format:** `{country}.{city}` (e.g., `bg.sofia` for Sofia, Bulgaria)
- **Storage:** Added to both `sources` and `messages` collections in Firestore
- **Default:** All existing crawlers default to `bg.sofia`

### Bounds Registry

Bounds are now stored in a registry structure in `ingest/lib/bounds.ts`:

```typescript
export const BOUNDS: Record<string, BoundsDefinition> = {
  "bg.sofia": {
    south: 42.605,
    west: 23.188,
    north: 42.83,
    east: 23.528,
  },
  // Add new cities here
};
```

### GeoJSON Files

Each target requires a corresponding GeoJSON file for city-wide messages:
- Naming convention: `{target}.geojson` (e.g., `bg.sofia.geojson`)
- Location: Root of `ingest/` directory
- Used by notification matching for city-wide messages

## Adding a New City

To add support for a new city (e.g., Plovdiv, Bulgaria):

1. **Add bounds definition** in `ingest/lib/bounds.ts`:
   ```typescript
   export const BOUNDS: Record<string, BoundsDefinition> = {
     "bg.sofia": { /* existing */ },
     "bg.plovdiv": {
       south: 42.10,
       west: 24.70,
       north: 42.20,
       east: 24.85,
     },
   };
   ```

2. **Add center coordinates** in `ingest/lib/bounds.ts`:
   ```typescript
   export const CENTERS: Record<string, CenterDefinition> = {
     "bg.sofia": { /* existing */ },
     "bg.plovdiv": { lat: 42.1354, lng: 24.7453 },
   };
   ```

3. **Create GeoJSON file** at `ingest/bg.plovdiv.geojson`:
   - Contains administrative boundary as a FeatureCollection
   - Used for city-wide message matching

4. **Create a crawler** in `ingest/crawlers/`:
   ```typescript
   const TARGET = "bg.plovdiv";
   const SOURCE_TYPE = "plovdiv-municipality";
   
   // Set target when saving source documents
   await saveSourceDocument({
     ...sourceDoc,
     target: TARGET,
   }, adminDb);
   ```

5. **Web bounds** (optional, for map viewport):
   - Add bounds to `web/lib/bounds-utils.ts` if needed for frontend

## Backward Compatibility

- All existing code continues to work via legacy exports:
  - `SOFIA_BOUNDS` → `BOUNDS["bg.sofia"]`
  - `SOFIA_CENTER` → `CENTERS["bg.sofia"]`
  - `isWithinSofia()` → calls `isWithinTarget("bg.sofia")`
  
- Migration script provided: `migrate/2026-02-10-add-target-field.ts`
  - Backfills `target: "bg.sofia"` to all existing records
  - Safe to run multiple times (skips records that already have target)

## Validation

- Crawlers **must** provide a valid target when saving sources
- Invalid targets throw an error: `Invalid target: {target}. Valid targets: bg.sofia`
- Add new targets to the `BOUNDS` registry before use

## Future Enhancements

The following components still assume Sofia but can be extended:

1. **Geocoding services** (`ingest/lib/geocoding-service.ts`, etc.)
   - Currently use `isWithinSofia()` for validation
   - Would need to accept target parameter

2. **Web frontend**
   - Map viewport and bounds currently default to Sofia
   - Would need target selection UI
