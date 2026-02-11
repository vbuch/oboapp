# Multi-Locality Support via Target Field

## Overview

The project supports hosting crawlers and messages for multiple localities through the `target` field and environment-based configuration.

## Architecture

### Target Field

- **Format:** `{country}.{locality}` (e.g., `bg.sofia` for Sofia, Bulgaria)
- **Storage:** Added to both `sources` and `messages` collections in Firestore
- **Required:** All crawlers must specify a target

### Environment Configuration

The target locality is configured via environment variables:

**Backend/Ingest:**
```bash
TARGET_LOCALITY=bg.sofia  # Required, no default
```

**Frontend/Web:**
```bash
NEXT_PUBLIC_TARGET_LOCALITY=bg.sofia  # Required, no default
```

### Bounds Registry

Bounds are stored in a registry structure in `ingest/lib/bounds.ts` and `web/lib/bounds-utils.ts`:

```typescript
export const BOUNDS: Record<string, BoundsDefinition> = {
  "bg.sofia": {
    south: 42.605,
    west: 23.188,
    north: 42.83,
    east: 23.528,
  },
  // Add new localities here
};
```

### GeoJSON Files

Each target requires a corresponding GeoJSON file for locality-wide messages:
- Naming convention: `{target}.geojson` (e.g., `bg.sofia.geojson`)
- Location: Root of `ingest/` directory
- Used by notification matching for locality-wide messages

## Adding a New Locality

To add support for a new locality (e.g., Plovdiv, Bulgaria):

1. **Add bounds definition** in `ingest/lib/bounds.ts` and `web/lib/bounds-utils.ts`:
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
   - Used for locality-wide message matching

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

5. **Set environment variables**:
   ```bash
   # Backend/Ingest
   TARGET_LOCALITY=bg.plovdiv
   
   # Frontend/Web
   NEXT_PUBLIC_TARGET_LOCALITY=bg.plovdiv
   ```

6. **Update web bounds** in `web/lib/bounds-utils.ts`:
   - Add the same bounds definition for frontend map viewport

## API Reference

### Backend Functions (ingest/lib/bounds.ts)

```typescript
// Get bounds for a specific target
getBoundsForTarget(target: string): BoundsDefinition

// Get center coordinates for a target
getCenterForTarget(target: string): CenterDefinition

// Get bbox string for a target
getBboxForTarget(target: string): string

// Check if coordinates are within target bounds
isWithinBounds(target: string, lat: number, lng: number): boolean

// Validate that a target exists
validateTarget(target: string): void
```

### Environment-Aware Helpers

```typescript
// Get current target from environment (ingest/lib/target-locality.ts)
getTargetLocality(): string  // Returns TARGET_LOCALITY or "bg.sofia"

// Get current target's bounds (ingest/lib/geocoding-utils.ts)
getTargetBounds(): BoundsDefinition
getTargetCenter(): CenterDefinition
getTargetBbox(): string
```

## Migration

Migration script provided: `migrate/2026-02-10-add-target-field.ts`
- Backfills `target: "bg.sofia"` to all existing records
- Safe to run multiple times (skips records that already have target)
- Run with: `npx tsx migrate/2026-02-10-add-target-field.ts`

## Validation

- Crawlers **must** provide a valid target when saving sources
- Invalid targets throw an error: `Invalid target: {target}. Valid targets: bg.sofia`
- Add new targets to the `BOUNDS` registry before use
