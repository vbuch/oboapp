---
name: dry-enforcement
description: Enforces Don't Repeat Yourself (DRY) principles in the codebase. Use when creating utilities, refactoring code, or implementing shared functionality. Requires checking existing utilities before writing new code and extracting duplicates into shared modules.
---

# DRY Enforcement

## Context

The oboapp project strictly enforces DRY (Don't Repeat Yourself) principles to maintain code quality and reduce maintenance burden. Before implementing any functionality, you must check for existing utilities. Duplicate code must be extracted into shared modules.

## Pattern

**Strictly enforce DRY. Always search for existing utilities before implementing new functionality.**

### Check Before Implementing

Before writing any utility function, transformation, or shared logic:

1. Search `web/lib/` for existing web utilities
2. Search `ingest/lib/` for existing ingest utilities
3. Check if similar functionality exists elsewhere in the codebase

### Extraction Rules

If code is used in ≥2 files, extract it immediately:

- **Module scope**: Used in ≥2 files within one module (web/ or ingest/) → Extract to `module/utils.ts`
- **Global scope**: Used in ≥2 modules (both web/ and ingest/) → Extract to `ingest/lib/` or `web/lib/`

## Guidelines

### 1. Discovery Phase

**Always search before implementing:**

```bash
# Search for similar functionality
grep -r "functionName" web/lib/
grep -r "utility pattern" ingest/lib/
```

**Check these locations first:**

- `web/lib/*.ts` - Web utilities (30+ files)
- `ingest/lib/*.ts` - Ingest utilities (21+ files)
- Look for: date formatting, string manipulation, validation, transformations

### 2. Naming Conventions

Use **named exports** for all utilities:

```typescript
// ✅ Good - Named export
export function formatAddress(street: string, number: string): string {
  return `${street} ${number}`;
}

// ❌ Bad - Default export
export default function formatAddress(street: string, number: string): string {
  return `${street} ${number}`;
}
```

### 3. Extraction Process

When you identify duplicate code:

1. **Create or update utility file:**

   - Same module: `module/utils.ts`
   - Cross-module: Appropriate `lib/` directory

2. **Extract with clear naming:**

   ```typescript
   // Clear, descriptive function names
   export function parseISODate(dateString: string): Date;
   export function validateGeoJSONFeature(feature: unknown): boolean;
   export function formatBulgarianAddress(
     street: string,
     number?: string
   ): string;
   ```

3. **Update all usages:**
   - Replace duplicates with imports
   - Ensure consistent behavior
   - Add unit tests

### 4. Documentation

When extracting utilities, add JSDoc comments:

```typescript
/**
 * Validates and normalizes Bulgarian street addresses.
 * Handles missing street numbers and Sofia-specific formatting.
 *
 * @param street - Street name
 * @param number - Optional street number
 * @returns Formatted address string
 */
export function formatBulgarianAddress(
  street: string,
  number?: string
): string {
  return number ? `${street} ${number}` : street;
}
```

## Examples

### ✅ Good - Using existing utilities

```typescript
// Check web/lib/ first
import { formatDate } from "@/lib/date-utils";
import { validateEmail } from "@/lib/validation-utils";

function processUser(email: string, registeredAt: Date) {
  if (!validateEmail(email)) {
    throw new Error("Invalid email");
  }
  return formatDate(registeredAt);
}
```

### ✅ Good - Extracting duplicates

Before extraction (duplicated in 3 files):

```typescript
// File 1: web/components/MessageCard.tsx
const formatTimestamp = (date: Date) => {
  return new Intl.DateTimeFormat("bg-BG").format(date);
};

// File 2: web/components/EventList.tsx
const formatTimestamp = (date: Date) => {
  return new Intl.DateTimeFormat("bg-BG").format(date);
};

// File 3: web/app/admin/logs/page.tsx
const formatTimestamp = (date: Date) => {
  return new Intl.DateTimeFormat("bg-BG").format(date);
};
```

After extraction to `web/lib/date-utils.ts`:

```typescript
// web/lib/date-utils.ts
export function formatBulgarianDate(date: Date): string {
  return new Intl.DateTimeFormat("bg-BG").format(date);
}

// Usage in all 3 files:
import { formatBulgarianDate } from "@/lib/date-utils";
const formatted = formatBulgarianDate(date);
```

### ❌ Bad - Not checking for existing utilities

```typescript
// Reimplementing functionality that exists in web/lib/geometry-utils.ts
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  // ... implementation already exists in lib!
}
```

### ❌ Bad - Not extracting duplicates

```typescript
// Same validation logic in 4 different files
// Should be extracted to validation-utils.ts
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

## Common Utility Locations

### Web Module (`web/lib/`)

- `colors.ts` - Theme colors and styling
- `theme.ts` - Button styles and UI utilities
- `types.ts` - Shared TypeScript interfaces
- `geometry-utils.ts` - Geospatial calculations
- `firebase.ts` / `firebase-admin.ts` - Firebase configuration
- `notification-service.ts` - Notification utilities
- `marker-config.ts` - Map marker configuration

### Ingest Module (`ingest/lib/`)

- `ai-service.ts` - LLM integration
- `geocoding-router.ts` - Geocoding dispatch
- `geocoding-service.ts` - Google Maps geocoding
- `overpass-geocoding-service.ts` - OpenStreetMap geocoding
- `cadastre-geocoding-service.ts` - Bulgarian cadastre
- `geojson-service.ts` - GeoJSON processing
- `boundary-utils.ts` - Sofia boundary checking
- `types.ts` - Shared types

## References

- **Web utilities**: [web/lib/](../../web/lib/)
- **Ingest utilities**: [ingest/lib/](../../ingest/lib/)
- **Testing**: All utilities must have corresponding `.test.ts` files
- **Related**: See `.claude/skills/documentation-standards` for documenting utilities
