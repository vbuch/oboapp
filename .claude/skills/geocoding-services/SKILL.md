---
name: geocoding-services
description: Geocoding service integration patterns for Google Maps, Overpass (OpenStreetMap), and Bulgarian Cadastre APIs. Use when implementing geocoding, address lookup, or location services. Includes critical rate limiting requirements.
---

# Geocoding Services

## Context

The oboapp project uses three geocoding services, each specialized for different location types. All services validate results against Sofia city boundaries and enforce strict rate limiting to respect API quotas and fair use policies.

**Hybrid Approach**: Google for addresses, Overpass for streets, Cadastre for property identifiers (УПИ).

## Pattern

### Service Routing

The [geocoding-router.ts](../../ingest/lib/geocoding-router.ts) automatically dispatches to the appropriate service:

```typescript
import { geocodeExtractedData } from "@/lib/geocoding-router";

const extractedData = {
  pins: [{ street: "бул. Витоша", number: "1" }],
  streets: [
    { name: "бул. Цар Освободител", startIntersection: "пл. Независимост" },
  ],
};

// Router automatically:
// - Sends pins to Google
// - Sends streets to Overpass
// - Validates all results with isWithinSofia()
const geoJson = await geocodeExtractedData(extractedData);
```

## Guidelines

### 1. Rate Limiting (CRITICAL)

**Violating rate limits can result in API bans or unexpected costs.**

| Service                | Delay per Request | Reason                                      |
| ---------------------- | ----------------- | ------------------------------------------- |
| **Google Maps**        | **200ms**         | API pricing/quota management                |
| **Overpass API**       | **500ms**         | Fair use policy (free OSM service)          |
| **Bulgarian Cadastre** | **2000ms** (2s)   | Session management + respect government API |

**Implementation**:

```typescript
// Always use delay utilities
import { delay } from "@/lib/utils";

async function geocodeMultipleAddresses(addresses: string[]) {
  const results = [];

  for (const address of addresses) {
    const result = await geocodeAddress(address); // Google
    results.push(result);

    await delay(200); // REQUIRED: 200ms between Google requests
  }

  return results;
}
```

**Never parallelize requests to the same service** - this defeats rate limiting:

```typescript
// ❌ BAD: Parallel requests ignore rate limiting
const results = await Promise.all(
  addresses.map((addr) => geocodeAddress(addr))
);

// ✅ GOOD: Sequential with delays
const results = [];
for (const address of addresses) {
  const result = await geocodeAddress(address);
  results.push(result);
  await delay(200);
}
```

### 2. Service Selection

#### Google Maps Geocoding

**Use for**: Pins (addresses with street numbers)

**Location**: [ingest/lib/geocoding-service.ts](../../ingest/lib/geocoding-service.ts)

**Function**: `geocodeAddresses(pins: Pin[])`

**Example**:

```typescript
import { geocodeAddresses } from "@/lib/geocoding-service";

const pins = [
  { street: "бул. Витоша", number: "1" },
  { street: "ул. Граф Игнатиев", number: "12" },
];

const features = await geocodeAddresses(pins);
// Returns GeoJSON Point features with properties
```

**Characteristics**:

- High accuracy for Bulgarian addresses
- Handles various address formats
- Paid API (included in Google Cloud quota)
- 200ms rate limit

#### Overpass API (OpenStreetMap)

**Use for**: Streets (intersections, street sections)

**Location**: [ingest/lib/overpass-geocoding-service.ts](../../ingest/lib/overpass-geocoding-service.ts)

**Function**: `geocodeIntersectionsForStreets(streets: Street[])`

**Example**:

```typescript
import { geocodeIntersectionsForStreets } from "@/lib/overpass-geocoding-service";

const streets = [
  {
    name: "бул. Цар Освободител",
    startIntersection: "пл. Независимост",
    endIntersection: "бул. Васил Левски",
  },
];

const features = await geocodeIntersectionsForStreets(streets);
// Returns GeoJSON LineString features connecting intersections
```

**Characteristics**:

- Free OpenStreetMap data
- Good coverage for Sofia streets
- Handles Bulgarian Cyrillic names
- 500ms rate limit (fair use)

#### Bulgarian Cadastre API

**Use for**: УПИ (Urban Planning Parcel) identifiers

**Location**: [ingest/lib/cadastre-geocoding-service.ts](../../ingest/lib/cadastre-geocoding-service.ts)

**Function**: `geocodeCadastralPropertiesFromIdentifiers(identifiers: string[])`

**Example**:

```typescript
import { geocodeCadastralPropertiesFromIdentifiers } from "@/lib/cadastre-geocoding-service";

const identifiers = [
  "68134.502.277", // УПИ format
  "02787.3.156",
];

const features = await geocodeCadastralPropertiesFromIdentifiers(identifiers);
// Returns GeoJSON Polygon features (property boundaries)
```

**Characteristics**:

- Official Bulgarian government data
- Returns property boundaries (polygons)
- Requires session management
- 2000ms rate limit (government API)

### 3. Boundary Validation

All services must validate results against Sofia city boundaries:

```typescript
import { isWithinSofia } from "@/lib/boundary-utils";

async function geocodeAndValidate(address: string) {
  const result = await geocodeAddress(address);

  if (result && result.geometry.type === "Point") {
    const [lng, lat] = result.geometry.coordinates;

    if (!isWithinSofia(lat, lng)) {
      console.warn(`Location outside Sofia: ${address}`);
      return null; // Reject locations outside boundaries
    }
  }

  return result;
}
```

**Sofia Boundaries**:

- Latitude: 42.6° to 42.8° N
- Longitude: 23.2° to 23.5° E

### 4. Error Handling

Geocoding can fail for many reasons - handle gracefully:

```typescript
import { geocodeAddresses } from "@/lib/geocoding-service";

async function robustGeocode(pins: Pin[]) {
  try {
    const features = await geocodeAddresses(pins);

    if (!features || features.length === 0) {
      console.warn("No results from geocoding");
      return null;
    }

    return {
      type: "FeatureCollection",
      features,
    };
  } catch (error) {
    console.error("Geocoding failed:", error.message);

    // Don't throw - return null and let pipeline continue
    return null;
  }
}
```

**Common failure modes**:

- API quota exceeded (Google)
- Network timeout (all services)
- Invalid address format
- Location not found
- Location outside Sofia boundaries
- Rate limit violation (too many requests)

## Examples

### ✅ Good - Using the Router

```typescript
import { geocodeExtractedData } from "@/lib/geocoding-router";
import type { ExtractedData } from "@/lib/types";

async function processMessage(extracted: ExtractedData) {
  // Router handles:
  // - Service selection
  // - Rate limiting
  // - Boundary validation
  // - Feature aggregation
  const geoJson = await geocodeExtractedData(extracted);

  if (!geoJson) {
    console.log("No valid locations found");
    return;
  }

  console.log(`Geocoded ${geoJson.features.length} features`);
  return geoJson;
}
```

### ✅ Good - Direct Service Usage with Rate Limiting

```typescript
import { geocodeAddresses } from "@/lib/geocoding-service";
import { delay } from "@/lib/utils";

async function batchGeocodeAddresses(addressBatches: string[][]) {
  const allFeatures = [];

  for (const batch of addressBatches) {
    const pins = batch.map((addr) => ({
      street: addr,
      number: undefined,
    }));

    const features = await geocodeAddresses(pins);
    allFeatures.push(...features);

    // Rate limit: 200ms between batches
    await delay(200);
  }

  return allFeatures;
}
```

### ✅ Good - Handling Mixed Location Types

```typescript
import {
  geocodeAddresses,
  geocodeIntersectionsForStreets,
} from "@/lib/geocoding-service";
import { delay } from "@/lib/utils";

async function geocodeMixedLocations(data: ExtractedData) {
  const features = [];

  // Geocode pins (addresses)
  if (data.pins && data.pins.length > 0) {
    const pinFeatures = await geocodeAddresses(data.pins);
    features.push(...pinFeatures);
    await delay(200); // Rate limit
  }

  // Geocode streets (intersections)
  if (data.streets && data.streets.length > 0) {
    const streetFeatures = await geocodeIntersectionsForStreets(data.streets);
    features.push(...streetFeatures);
    await delay(500); // Different rate limit for Overpass
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
```

### ❌ Bad - Parallel Requests (Violates Rate Limiting)

```typescript
// ❌ BAD: All requests fire simultaneously, no rate limiting
async function geocodeParallel(addresses: string[]) {
  const results = await Promise.all(
    addresses.map((addr) => geocodeAddress(addr))
  );
  // This can exceed rate limits and cause bans!
  return results;
}
```

### ❌ Bad - No Boundary Validation

```typescript
// ❌ BAD: Not checking if locations are in Sofia
async function geocodeWithoutValidation(address: string) {
  const result = await geocodeAddress(address);
  // Could be anywhere in Bulgaria or world!
  return result;
}

// ✅ GOOD: Validate boundaries
async function geocodeWithValidation(address: string) {
  const result = await geocodeAddress(address);

  if (result && result.geometry.type === "Point") {
    const [lng, lat] = result.geometry.coordinates;
    if (!isWithinSofia(lat, lng)) {
      return null; // Reject
    }
  }

  return result;
}
```

### ❌ Bad - Not Handling Errors

```typescript
// ❌ BAD: Let exceptions propagate and crash pipeline
async function fragileGeocode(pins: Pin[]) {
  const features = await geocodeAddresses(pins);
  // What if API is down? What if quota exceeded?
  return { type: "FeatureCollection", features };
}

// ✅ GOOD: Handle errors gracefully
async function resilientGeocode(pins: Pin[]) {
  try {
    const features = await geocodeAddresses(pins);
    return features.length > 0 ? { type: "FeatureCollection", features } : null;
  } catch (error) {
    console.error("Geocoding failed:", error);
    return null; // Don't crash, return null
  }
}
```

## Service-Specific Documentation

For detailed information about each service:

- **Overview**: [docs/features/geocoding-overview.md](../../docs/features/geocoding-overview.md)
- **Google Maps**: [docs/features/geocoding-google.md](../../docs/features/geocoding-google.md)
- **Overpass API**: [docs/features/geocoding-overpass.md](../../docs/features/geocoding-overpass.md)
- **Bulgarian Cadastre**: [docs/features/geocoding-cadastre.md](../../docs/features/geocoding-cadastre.md)

## Testing Geocoding

Always include tests for geocoding logic:

```typescript
import { describe, it, expect, vi } from "vitest";
import { geocodeAddresses } from "./geocoding-service";

describe("geocoding", () => {
  it("should geocode Sofia addresses", async () => {
    const pins = [{ street: "бул. Витоша", number: "1" }];
    const features = await geocodeAddresses(pins);

    expect(features.length).toBeGreaterThan(0);
    expect(features[0].geometry.type).toBe("Point");
  });

  it("should respect rate limits", async () => {
    const start = Date.now();

    await geocodeAddresses([{ street: "ул. Граф Игнатиев", number: "1" }]);
    await geocodeAddresses([{ street: "бул. Витоша", number: "2" }]);

    const duration = Date.now() - start;

    // Should have at least 200ms delay between calls
    expect(duration).toBeGreaterThanOrEqual(200);
  });

  it("should validate Sofia boundaries", async () => {
    // Address outside Sofia should be rejected
    const pins = [{ street: "Somewhere in Plovdiv", number: "1" }];
    const features = await geocodeAddresses(pins);

    expect(features.length).toBe(0); // Rejected by boundary check
  });
});
```

## References

- **Geocoding Router**: [ingest/lib/geocoding-router.ts](../../ingest/lib/geocoding-router.ts)
- **Google Service**: [ingest/lib/geocoding-service.ts](../../ingest/lib/geocoding-service.ts)
- **Overpass Service**: [ingest/lib/overpass-geocoding-service.ts](../../ingest/lib/overpass-geocoding-service.ts)
- **Cadastre Service**: [ingest/lib/cadastre-geocoding-service.ts](../../ingest/lib/cadastre-geocoding-service.ts)
- **Boundary Utils**: [ingest/lib/boundary-utils.ts](../../ingest/lib/boundary-utils.ts)
- **Related Skills**:
  - `.claude/skills/geojson-handling` - For processing geocoding results
  - `.claude/skills/message-pipeline` - Uses geocoding services
  - `.claude/skills/dry-enforcement` - For extracting geocoding utilities
- **Feature Documentation**: [docs/features/](../../docs/features/)
