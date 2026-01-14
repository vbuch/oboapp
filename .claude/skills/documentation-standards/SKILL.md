---
name: documentation-standards
description: Documentation writing guidelines and standards. Use when creating or updating documentation files (READMEs, feature docs, guides). Target audience is QA/operations staff, not developers. Keep docs concise and behavior-focused.
---

# Documentation Standards

## Context

The oboapp project maintains documentation for QA personnel, system administrators, and technical stakeholders - NOT for developers (who read code). Documentation should focus on behavior, operations, and testing requirements rather than implementation details.

**Philosophy**: Documentation describes "what happens" and "why", not "how it works internally".

## Pattern

### Target Audience

**Primary readers**:

- QA testers who need to verify features
- System administrators managing deployments
- Technical stakeholders understanding capabilities
- Product managers tracking functionality

**NOT primary readers**:

- Developers implementing features (they read code)
- AI agents (they have AGENTS.md and skills)

## Guidelines

### 1. Keep Documentation Concise

**Focus on**:

- Observable behavior ("When X happens, the system does Y")
- Operational knowledge ("How to configure Z")
- Testing procedures ("To verify this feature, check...")
- Edge cases and error conditions

**Omit**:

- Implementation details (algorithms, data structures)
- Code patterns (covered in AGENTS.md and skills)
- TypeScript interfaces (in code)
- Internal architecture (except high-level diagrams)

### 2. Avoid Duplication

**Link to existing docs instead of repeating content.**

```markdown
<!-- ❌ BAD: Repeating geocoding service details -->

## Geocoding

The system uses three geocoding services:

Google Maps: Used for address geocoding with 200ms rate limit...
Overpass API: Used for street intersections with 500ms rate limit...
Cadastre: Used for УПИ lookups with 2000ms rate limit...

<!-- ✅ GOOD: Link to detailed docs -->

## Geocoding

The system geocodes locations using multiple services based on type.
For details, see [geocoding overview](./geocoding-overview.md).
```

**Maintain single source of truth:**

- Each topic has ONE authoritative document
- Other docs link to that authority
- Updates happen in one place

### 3. Structure for Scanability

Use clear headings and short sections:

```markdown
# Feature Name

Brief one-paragraph overview.

## How It Works

2-3 paragraphs of behavior description.

## Configuration

Table or list of settings:

| Setting | Purpose    | Default |
| ------- | ---------- | ------- |
| FOO     | Controls X | 200ms   |

## Testing

Bullet list of verification steps:

- Check that X happens when Y
- Verify Z appears in logs
- Confirm A fails gracefully when B

## Edge Cases

- When X: System does Y
- When Z is missing: Falls back to default
```

### 4. When to Document

**Create or update docs when**:

- Adding new features affecting QA testing
- Changing configuration (env vars, constants)
- Modifying external API integrations
- Adjusting pipeline architecture
- Identifying edge cases during development

**Don't create docs for**:

- Internal refactoring (no behavior change)
- Code pattern changes (update AGENTS.md or skills instead)
- Utility function additions (document in code with JSDoc)
- Bug fixes that restore intended behavior

### 5. Documentation Locations

```
docs/
├── features/              # Feature documentation
│   ├── geocoding-overview.md
│   ├── geocoding-google.md
│   ├── geocoding-overpass.md
│   ├── geocoding-cadastre.md
│   ├── message-filtering.md
│   └── firebase-service-account-setup.md
│
README.md                  # Project overview + setup
CONTRIBUTING.md            # Local development setup
AGENTS.md                  # Agent development guidelines (high-level)

.claude/skills/            # Claude Agent SDK skills (detailed patterns)
├── dry-enforcement/
├── firebase-integration/
├── geojson-handling/
├── tailwind-theming/
├── message-pipeline/
├── geocoding-services/
└── documentation-standards/

ingest/
├── README.md              # Pipeline overview
├── crawlers/README.md     # Crawler architecture
├── messageIngest/README.md # Message processing
└── notifications/README.md # Push notifications

web/
└── README.md              # Web app documentation
```

### 6. Writing Style

**Be clear and direct**:

```markdown
<!-- ❌ BAD: Verbose, internal details -->

The geocoding subsystem leverages a sophisticated routing algorithm
that determines the optimal geocoding service based on the extracted
location type through pattern matching on the data structure returned
by the LLM extraction phase, with fallback logic implemented via
try-catch blocks.

<!-- ✅ GOOD: Clear, behavioral -->

The system routes locations to appropriate geocoding services:

- Addresses with numbers → Google Maps
- Street intersections → Overpass API
- УПИ identifiers → Cadastre
```

**Use active voice**:

```markdown
<!-- ❌ BAD: Passive voice -->

The message is filtered by the LLM and then extracted data is
geocoded by the appropriate service.

<!-- ✅ GOOD: Active voice -->

The LLM filters the message, then the geocoding service processes
the extracted locations.
```

**Include examples**:

```markdown
## Message Format

Messages must include location information. Examples:

- "Ремонт на ул. Граф Игнатиев от No 1 до No 15"
- "Спиране на водата в УПИ 68134.502.277"
- "Работи на бул. Витоша и ул. Московска"
```

## Examples

### ✅ Good - Feature Documentation

```markdown
# Message Filtering

## Purpose

The filtering stage determines whether a message contains information
about public infrastructure disruptions. Messages about bus schedules,
tram routes, or unrelated topics are rejected.

## Behavior

**Input**: Raw message text
**Output**: `{isRelevant: boolean, normalizedText: string}`

When `isRelevant` is false, the message is finalized immediately
without geocoding.

## Configuration

Filter behavior is controlled by the LLM prompt in:
`ingest/prompts/message-filter.md`

## Testing

To verify filtering:

1. Submit message: "Автобус 280 промяна на маршрут"

   - Expected: `isRelevant: false`

2. Submit message: "Ремонт на ул. Граф Игнатиев No 12"

   - Expected: `isRelevant: true`

3. Check `messages` collection in Firestore
   - Irrelevant messages have `finalizedAt` set
   - No `geoJson` field for irrelevant messages

## Edge Cases

- Empty messages → Rejected as irrelevant
- Non-Bulgarian text → Processed normally (LLM handles)
- Mixed content (transport + infrastructure) → Accepted if any relevant content present
```

### ✅ Good - API Integration Documentation

```markdown
# Bulgarian Cadastre API

## Purpose

Geocodes УПИ (Urban Planning Parcel) identifiers to property boundaries.

## Usage

The cadastre service is invoked automatically when extracted data
contains УПИ identifiers like "68134.502.277".

Returns: GeoJSON Polygon features representing property boundaries.

## Rate Limiting

**Critical**: Must wait 2000ms (2 seconds) between requests.

Violating this limit may cause session timeouts or API blocks.

## Configuration

No API key required (public government service).

Service endpoint: `https://kk.cadastre.bg/...`

## Known Issues

- Session management required (handled automatically)
- Some rural УПИ identifiers may not be found
- Service occasionally returns 500 errors (retry after 5 seconds)

## Testing

Test with known Sofia УПИ: "68134.502.277"

Expected result: Polygon within Sofia boundaries
```

### ❌ Bad - Overly Technical Documentation

````markdown
# Geocoding Service Architecture

## Implementation

The `GeocodingRouter` class implements a strategy pattern with
dependency injection to dispatch `Location` objects to appropriate
`IGeocoder` implementations. The router maintains a mapping of
`LocationType` enum values to service instances:

```typescript
class GeocodingRouter {
  private services: Map<LocationType, IGeocoder>;

  async route(location: Location): Promise<GeoJSONFeature> {
    const service = this.services.get(location.type);
    return await service.geocode(location);
  }
}
```
````

The system uses async/await promises with error handling via try-catch
blocks that wrap service calls in a retry mechanism implemented using
exponential backoff...

<!-- This is too technical! Focus on behavior, not implementation. -->

````

### ❌ Bad - Duplicated Content

```markdown
# Message Pipeline Overview

## Geocoding Services

The system uses three geocoding services:

**Google Maps Geocoding**
- Used for addresses with street numbers
- Rate limit: 200ms between requests
- Validates results against Sofia boundaries
- [Full implementation details...]

**Overpass API**
- Used for street intersections
- Rate limit: 500ms between requests
- OpenStreetMap data
- [Full implementation details...]

<!-- ❌ BAD: This duplicates docs/features/geocoding-*.md -->
<!-- ✅ GOOD: Link instead -->

## Geocoding Services

The pipeline geocodes extracted locations using multiple services.
See [geocoding overview](../features/geocoding-overview.md) for details.
````

## Documentation Checklist

When creating or updating documentation:

- [ ] Target audience is QA/operations, not developers
- [ ] Focuses on observable behavior, not implementation
- [ ] Links to existing docs instead of duplicating
- [ ] Includes examples of expected behavior
- [ ] Lists edge cases and error conditions
- [ ] Provides testing/verification steps
- [ ] Uses clear, active voice
- [ ] Structured with scannable headings
- [ ] Configuration settings documented
- [ ] External API integrations explained

## References

- **Feature docs**: [docs/features/](../../docs/features/)
- **Module READMEs**:
  - [ingest/README.md](../../ingest/README.md)
  - [ingest/crawlers/README.md](../../ingest/crawlers/README.md)
  - [ingest/messageIngest/README.md](../../ingest/messageIngest/README.md)
  - [web/README.md](../../web/README.md)
- **Project docs**:
  - [README.md](../../README.md) - Project overview
  - [CONTRIBUTING.md](../../CONTRIBUTING.md) - Development setup
  - [AGENTS.md](../../AGENTS.md) - Agent guidelines
- **Related Skills**:
  - `.claude/skills/dry-enforcement` - Document shared utilities in code
  - All other skills - Examples of clear, structured documentation
