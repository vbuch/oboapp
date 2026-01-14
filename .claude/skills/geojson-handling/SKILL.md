---
name: geojson-handling
description: GeoJSON validation, coordinate handling, and type safety patterns. Use when working with geographic data, map features, geometry validation, or coordinate transformations. Always validates and fixes coordinate order (lng/lat).
---

# GeoJSON Handling

## Context

The oboapp project processes GeoJSON from multiple sources (crawlers, user input, external APIs). These sources often have inconsistent coordinate ordering or invalid structures. We enforce strict validation and use custom types to ensure type safety.

**Critical**: GeoJSON coordinates must always be in `[longitude, latitude]` order (NOT `[lat, lng]`).

## Pattern

**Always use `validateAndFixGeoJSON` from `ingest/crawlers/shared/geojson-validation.ts` to process raw GeoJSON.**

### Standard Validation Flow

```typescript
import { validateAndFixGeoJSON } from "@/crawlers/shared/geojson-validation";

// Raw data from API or crawler
const rawJson = await fetchGeoJSONFromSource();

// Validate and fix
const validation = validateAndFixGeoJSON(rawJson, "source-name");

if (!validation.isValid) {
  console.error("Invalid GeoJSON:", validation.errors);
  return; // or throw
}

// Use clean, validated GeoJSON
const cleanGeoJson: GeoJSONFeatureCollection = validation.geoJson;
```

## Guidelines

### 1. Type Definitions

**Always use project types, NOT the `geojson` npm package:**

```typescript
// ✅ Good - Project types
import { GeoJSONFeatureCollection, GeoJSONFeature } from "@/lib/types";

// ❌ Bad - External types
import { FeatureCollection, Feature } from "geojson";
```

### 2. Coordinate Order

**GeoJSON spec requires [longitude, latitude] order:**

```typescript
// ✅ Correct - [lng, lat]
const point: GeoJSONFeature = {
  type: "Feature",
  geometry: {
    type: "Point",
    coordinates: [23.3219, 42.6977], // Sofia: [lng, lat]
  },
  properties: {},
};

// ❌ Wrong - [lat, lng]
const point = {
  type: "Feature",
  geometry: {
    type: "Point",
    coordinates: [42.6977, 23.3219], // Will be outside Sofia bounds!
  },
  properties: {},
};
```

**The validator automatically detects and swaps incorrect coordinate order.**

### 3. Validation Features

`validateAndFixGeoJSON` handles:

- **Coordinate swapping**: Detects lat/lng order and fixes to lng/lat
- **FeatureCollection wrapping**: Converts raw arrays to proper FeatureCollection
- **Geometry validation**: Ensures valid GeoJSON structure
- **Property preservation**: Maintains all feature properties
- **Error reporting**: Returns detailed validation errors

### 4. Validation Options

```typescript
interface ValidationResult {
  isValid: boolean;
  geoJson: GeoJSONFeatureCollection;
  errors?: string[];
  warnings?: string[];
}

// Usage
const result = validateAndFixGeoJSON(rawData, sourceName);

if (!result.isValid) {
  // Log all errors
  result.errors?.forEach((err) => console.error(`[${sourceName}] ${err}`));
  return;
}

// Check warnings (non-fatal issues)
result.warnings?.forEach((warn) => console.warn(`[${sourceName}] ${warn}`));
```

## Examples

### ✅ Good - Complete Validation Flow

```typescript
import { validateAndFixGeoJSON } from "@/crawlers/shared/geojson-validation";
import { GeoJSONFeatureCollection } from "@/lib/types";

async function processCrawlerData(url: string) {
  const response = await fetch(url);
  const rawJson = await response.json();

  // Validate and fix GeoJSON
  const validation = validateAndFixGeoJSON(rawJson, "sofiyska-voda");

  if (!validation.isValid) {
    console.error("Validation failed:");
    validation.errors?.forEach((err) => console.error(`  - ${err}`));
    return null;
  }

  // Type-safe, validated GeoJSON
  const geoJson: GeoJSONFeatureCollection = validation.geoJson;

  console.log(`Validated ${geoJson.features.length} features`);

  return geoJson;
}
```

### ✅ Good - Handling Multiple Sources

```typescript
import { validateAndFixGeoJSON } from "@/crawlers/shared/geojson-validation";
import { GeoJSONFeatureCollection } from "@/lib/types";

async function aggregateGeoJSON(
  sources: Array<{ name: string; data: unknown }>
) {
  const validatedFeatures: GeoJSONFeature[] = [];

  for (const source of sources) {
    const validation = validateAndFixGeoJSON(source.data, source.name);

    if (validation.isValid) {
      validatedFeatures.push(...validation.geoJson.features);
    } else {
      console.warn(`Skipping ${source.name}:`, validation.errors);
    }
  }

  return {
    type: "FeatureCollection",
    features: validatedFeatures,
  } as GeoJSONFeatureCollection;
}
```

### ✅ Good - Creating GeoJSON from Scratch

```typescript
import { GeoJSONFeature, GeoJSONFeatureCollection } from "@/lib/types";

function createPointFeature(
  lng: number,
  lat: number,
  properties: Record<string, unknown>
): GeoJSONFeature {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lng, lat], // Always [longitude, latitude]
    },
    properties,
  };
}

// Usage
const sofiaCenter = createPointFeature(
  23.3219, // longitude
  42.6977, // latitude
  { name: "Sofia Center", type: "landmark" }
);

const collection: GeoJSONFeatureCollection = {
  type: "FeatureCollection",
  features: [sofiaCenter],
};
```

### ❌ Bad - No Validation

```typescript
// ❌ BAD: Using raw GeoJSON without validation
async function processGeoJSON(url: string) {
  const response = await fetch(url);
  const geoJson = await response.json(); // Could be invalid!

  // What if coordinates are swapped?
  // What if it's not a FeatureCollection?
  // What if geometry is malformed?

  return geoJson; // Unsafe!
}
```

### ❌ Bad - Wrong Type Imports

```typescript
// ❌ BAD: Using external geojson types
import { FeatureCollection, Feature } from "geojson";

function processFeatures(fc: FeatureCollection): Feature[] {
  // Project uses GeoJSONFeatureCollection, not FeatureCollection
  return fc.features;
}
```

### ❌ Bad - Manual Coordinate Swapping

```typescript
// ❌ BAD: Don't manually swap coordinates
function fixCoordinates(coords: number[]): number[] {
  // The validator handles this automatically!
  return [coords[1], coords[0]];
}

// ✅ GOOD: Let the validator handle it
const validation = validateAndFixGeoJSON(rawData, "source");
// Coordinates are automatically fixed if needed
```

## Coordinate Systems

### Sofia Boundary Checking

After validation, check if features are within Sofia bounds:

```typescript
import { isWithinSofia } from "@/lib/boundary-utils";
import { validateAndFixGeoJSON } from "@/crawlers/shared/geojson-validation";

const validation = validateAndFixGeoJSON(rawData, "source");

if (validation.isValid) {
  const validFeatures = validation.geoJson.features.filter((feature) => {
    if (feature.geometry.type === "Point") {
      const [lng, lat] = feature.geometry.coordinates;
      return isWithinSofia(lat, lng);
    }
    return true; // Keep non-point features
  });

  console.log(`Filtered to ${validFeatures.length} features within Sofia`);
}
```

### Common Coordinate Ranges

**Sofia, Bulgaria:**

- Latitude: 42.6° to 42.8° N
- Longitude: 23.2° to 23.5° E

**Quick validation check:**

```typescript
function looksLikeSofiaCoordinates(lng: number, lat: number): boolean {
  return (
    lng >= 23.2 &&
    lng <= 23.5 && // longitude range
    lat >= 42.6 &&
    lat <= 42.8 // latitude range
  );
}
```

## Testing GeoJSON

Always include tests for GeoJSON validation:

```typescript
import { describe, it, expect } from "vitest";
import { validateAndFixGeoJSON } from "./geojson-validation";

describe("GeoJSON validation", () => {
  it("should validate correct FeatureCollection", () => {
    const valid = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [23.32, 42.69] },
          properties: {},
        },
      ],
    };

    const result = validateAndFixGeoJSON(valid, "test");
    expect(result.isValid).toBe(true);
  });

  it("should swap incorrect coordinate order", () => {
    const swapped = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [42.69, 23.32] }, // lat, lng
          properties: {},
        },
      ],
    };

    const result = validateAndFixGeoJSON(swapped, "test");
    expect(result.isValid).toBe(true);
    expect(result.geoJson.features[0].geometry.coordinates).toEqual([
      23.32, 42.69,
    ]);
  });
});
```

## References

- **Validation utility**: [ingest/crawlers/shared/geojson-validation.ts](../../ingest/crawlers/shared/geojson-validation.ts)
- **Type definitions**: [web/lib/types.ts](../../web/lib/types.ts), [ingest/lib/types.ts](../../ingest/lib/types.ts)
- **Boundary utils**: [ingest/lib/boundary-utils.ts](../../ingest/lib/boundary-utils.ts)
- **GeoJSON spec**: https://datatracker.ietf.org/doc/html/rfc7946
- **Related Skills**:
  - `.claude/skills/geocoding-services` - Produces GeoJSON output
  - `.claude/skills/message-pipeline` - Consumes validated GeoJSON
