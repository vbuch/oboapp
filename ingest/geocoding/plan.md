# Plan: Geocoding Refactor — Interface-Based Architecture

## TL;DR

Refactor `ingest/geocoding/` from a procedurally dispatched system (`router.ts` + `geocode-addresses.ts`) into a composable, interface-driven one. Each entity type (pins, streets, cadastral, bus stops, educational facilities) gets a TypeScript interface; each provider implements one or more. A single `providers.ts` assembly file in `ingest/` lets forks swap providers. The new public API is `geocode(context)` — a black box from messageIngest's perspective. Caching is removed now (added back later as a `CachePinsGeocoder`/`CacheStreetsGeocoder`). Follow design doc's 6-iteration sequence.

---

## Phase 1 — Foundation (interfaces, context, entry point, providers assembly) ✅ COMPLETED

- [x] Step 1: Create `ingest/geocoding/interfaces.ts`
  - [x] Define per-entity-type interfaces: `PinGeocoder`, `StreetGeocoder`, `CadastralGeocoder`, `BusStopGeocoder`, `EducationalFacilityGeocoder`
  - [x] Each interface has: `geocode(args: {location, context}): Promise<Result | null>` and optional `done(resultsMap: Map<string, Result>): void`
  - [x] Result types: `PinResult` (Address + QualitySignals), `StreetResult` (from/to coords + QualitySignals), `CadastralResult` (CadastralGeometry), `BusStopResult` (Coordinates + QualitySignals), `EducationalFacilityResult` (Coordinates + QualitySignals)
  - [x] `GeocodingProviders` type: `{ pin: PinGeocoder[]; street: StreetGeocoder[]; cadastral: CadastralGeocoder[]; busStop: BusStopGeocoder[]; educationalFacility: EducationalFacilityGeocoder[] }`

- [x] Step 2: Create `ingest/geocoding/context.ts`
  - [x] `GeocodingContext` = `ExtractedLocations & { locality: string }` (locality from messageIngest config)
  - [x] Reuse existing `ExtractedLocations`, `StreetSection`, `CadastralProperty`, etc. from `ingest/lib/types.ts`

- [x] Step 3: Create `ingest/geocoding/geocode.ts` — new main entry point (stub in Phase 1, fully wired in Phase 4)
  - [x] `export async function geocode(context: GeocodingContext, providers: GeocodingProviders): Promise<GeocodingResult>`
  - [x] Internal helpers: `geocodePins()`, `geocodeStreets()`, `geocodeCadastral()`, `geocodeBusStops()`, `geocodeEducationalFacilities()`
  - [x] Priority chain: for each location, iterate provider array, call `geocode()`, stop at first non-null result, call `done()` on all providers after each entity type is done
  - [x] Preserve pre-geocoded coordinates handling (geotagged sources): boundary-validate + pass through, skip geocoding

- [x] Step 4: Create `ingest/geocoding/providers.ts` — the single instance assembly file (forks override this file)
  - [x] Reads `GEOCODING_PROVIDER_PRIORITIES` from `shared/src/geocoding-sources.ts` to know which providers are active and in what order
  - [x] Maps each provider id → class instance (provider-specific constructor args like GTFS URL live here, not in shared)
  - [x] Initially exports `GEOCODING_PROVIDERS: GeocodingProviders` with empty arrays (stubs until Phase 2+)

- [x] Step 4b: Update `shared/src/geocoding-source-definition.ts` — replace `GeocodingResolverConfig` with `GeocodingProviderPriorities`
  - [x] `PinProviderId`, `StreetProviderId`, `CadastralProviderId`, `BusStopProviderId`, `EducationalFacilityProviderId` string union types
  - [x] `GeocodingProviderPriorities` interface: keyed by entity type, value is `ReadonlyArray<*ProviderId>` (ordered priority list)
  - [x] Keep `GeocodingSourceMetadata` and `OpenDataSource` unchanged

- [x] Step 4c: Update `shared/src/geocoding-sources.ts` — replace `GEOCODING_RESOLVERS` with `GEOCODING_PROVIDER_PRIORITIES`, add compatibility export
  - [x] e.g. `pin: ["google", "overpass"]`, `street: ["overpass"]`, `busStop: ["gtfs", "google"]`, etc.
  - [x] `web/` reads this to show which providers are active on the sources page
  - [x] `ingest/` `providers.ts` reads this to build the ordered class-instance arrays
  - [x] `GEOCODING_SOURCES` and `OPEN_DATA_SOURCES` stay unchanged
  - [x] Added backward-compatibility export `GEOCODING_RESOLVERS` (to be removed in Phase 5)

---

## Phase 2 — Street geocoder + integration tests

- [ ] Step 5: Create `ingest/geocoding/street/overpass-street-geocoder.ts` implementing `StreetGeocoder`
  - [ ] Wraps `geocodeIntersectionsForStreets()` and `getStreetGeometryFromOverpass()` from `overpass/service.ts`
  - [ ] **No caching, no pre-fetch** — `preFetchStreetGeometries()` is a cache-warming function that exists solely to populate `streetGeometryCache` before intersection processing. With caching removed, both `preFetchStreetGeometries()` and `streetGeometryCache` are deleted entirely. Each `geocodeStreet()` call fetches geometry inline. The two-pass deferred retry (currently inside `preFetchStreetGeometries`) is re-implemented inside the geocoder's own call path. Add a `// TODO: restore batch pre-fetch via CacheStreetsGeocoder` comment.
  - [ ] `done()` stub: no-op (placeholder for future CacheStreetsGeocoder)
  - [ ] Wire into `providers.ts`: `street: [new OverpassStreetGeocoder()]`

- [ ] Step 6: Write integration tests in `ingest/geocoding/geocode.test.ts`
  - [ ] Test `geocode()` with only streets, mock `OverpassStreetGeocoder`
  - [ ] Verify provider chain: first provider returns result → second not called; first returns null → second tried
  - [ ] Verify `done()` called after all streets are processed
  - [ ] Verify pre-geocoded streets pass through correctly

- [ ] Step 7: Verify: `pnpm tsc --noEmit` + `pnpm test:run` in ingest/ — streets pass, rest still routed via old code

---

## Phase 3 — Remaining geocoder instances

Implement in parallel (no dependencies between them):

- [ ] Step 8a: `ingest/geocoding/pin/google-pin-geocoder.ts` implementing `PinGeocoder`
  - [ ] Wraps `google/service.ts` `geocodeAddresses()`; returns `PinResult | null`
  - [ ] No cache lookup (removed); `done()` stub

- [ ] Step 8b: `ingest/geocoding/pin/overpass-pin-geocoder.ts` implementing `PinGeocoder`
  - [ ] Wraps `overpass/service.ts` `overpassGeocodeAddresses()`; returns `PinResult | null`
  - [ ] `done()` stub

- [ ] Step 8c: `ingest/geocoding/cadastral/cadastre-geocoder.ts` implementing `CadastralGeocoder`
  - [ ] Wraps `cadastre/service.ts` `geocodeCadastralProperties()`

- [ ] Step 8d: `ingest/geocoding/bus-stop/gtfs-bus-stop-geocoder.ts` implementing `BusStopGeocoder`
  - [ ] Name stays `gtfs-bus-stop-geocoder` — the implementation is GTFS-standard (uses `stop_code`, `lat`/`lng` from `stops.txt`). The only Sofia-specific artifact is the `"Спирка ${stopCode}"` label which is a minor localization string, not the protocol. The GTFS URL is configuration (in `geocoding-sources.ts`), not baked in.
  - [ ] Wraps `gtfs/geocoding-service.ts`; Google fallback as second entry in the `busStop` provider array

- [ ] Step 8e: `ingest/geocoding/educational-facility/educational-facility-geocoder.ts` implementing `EducationalFacilityGeocoder`
  - [ ] Wraps `educational-facilities/geocoding-service.ts`; Google fallback as second entry

- [ ] Step 9: Register all in `providers.ts`

```
pin: [new GooglePinGeocoder(), new OverpassPinGeocoder()]
street: [new OverpassStreetGeocoder()]
cadastral: [new CadastralGeocoder()]
busStop: [new GTFSBusStopGeocoder(), new GoogleBusStopGeocoder()]
educationalFacility: [new EducationalFacilityGeocoder(), new GoogleEducationalFacilityGeocoder()]
```

---

## Phase 4 — Wire messageIngest to new geocode()

- [ ] Step 10: Update `ingest/messageIngest/geocode-addresses.ts`
  - [ ] Replace the current call chain (separate `geocodePins()`, `geocodeStreetIntersection()`, etc.) with a single call to `geocode(context, GEOCODING_PROVIDERS)`
  - [ ] Map the new `GeocodingResult` back to the existing shape that `messageIngest/index.ts` expects (`preGeocodedMap`, `qualityMap`, `addresses`, `cadastralGeometries`) — or update callers if the shape changes
  - [ ] **Do not change `messageIngest/index.ts`** at this stage

- [ ] Step 11: Update `geocode-addresses.test.ts` to match new call pattern

---

## Phase 5 — Remove old code

_Depends on Phase 4 completing successfully (all tests green)_

- [ ] Step 12: Delete `ingest/geocoding/cache.ts` (DB-backed caching removed)
- [ ] Step 13: Delete `ingest/geocoding/router.ts` — replaced by `geocode.ts` + providers
- [ ] Step 14: Remove `seedStreetCacheFromDb()` call from messageIngest (it was seeding the now-removed street cache)
- [ ] Step 15: Delete or simplify `ingest/geocoding/router.test.ts` if router is gone (move any still-relevant logic tests)
- [ ] Step 16: Clean up now-unused imports across the codebase (`pnpm tsc --noEmit` will catch them)

---

## Relevant files

- `ingest/geocoding/future-design.md` — the design reference
- `ingest/geocoding/router.ts` — current dispatcher, to be deleted
- `ingest/geocoding/cache.ts` — current caching, to be deleted
- `ingest/messageIngest/geocode-addresses.ts` — current orchestrator, to be replaced
- `ingest/messageIngest/index.ts` — caller of geocodeAddressesFromExtractedData — DO NOT CHANGE shape
- `ingest/geocoding/overpass/service.ts` — street geometry fetching, circuit breaker, rate limiting — wrap, don't rewrite
- `ingest/geocoding/google/service.ts` — Google geocoding — wrap, don't rewrite
- `ingest/geocoding/cadastre/service.ts` — cadastre — wrap, don't rewrite
- `ingest/geocoding/gtfs/geocoding-service.ts` — GTFS bus stop resolution — wrap
- `ingest/geocoding/educational-facilities/geocoding-service.ts` — school/kinder — wrap
- `ingest/geocoding/shared/` — boundary-utils, quality, geojson-service — reused as-is
- `ingest/lib/types.ts` — ExtractedLocations, Address, QualitySignals, etc. — reused
- `shared/src/geocoding-sources.ts` — GEOCODING_RESOLVERS string-based config — kept for web display (GEOCODING_SOURCES), but `GEOCODING_RESOLVERS` may become unused

---

## Verification

1. `pnpm tsc --noEmit` in `ingest/` passes at end of each phase
2. `pnpm test:run` in `ingest/` — all existing tests pass; new integration tests in `geocode.test.ts` pass
3. `pnpm lint` in `ingest/` passes
4. After Phase 5: no references to deleted files remain (TypeScript errors catch this)
5. Manual: run a single crawl/ingest through the pipeline and verify geocoding output

---

## Decisions

- **Caching removed** during refactor; `done()` stubs are the future hook for `CachePinsGeocoder` / `CacheStreetsGeocoder` implementations
- **Providers assembly** lives in `ingest/geocoding/providers.ts` (not shared); forks override this one file
- **`shared/src/geocoding-sources.ts`** kept as-is (web display metadata); `GEOCODING_RESOLVERS` may become a dead export — remove when confirmed unused
- **GeocodingResult shape** kept compatible with what `messageIngest/index.ts` expects (no cascading changes)
- **Wrap, don't rewrite** — existing provider services (`google/service.ts`, `overpass/service.ts`, etc.) are wrapped by new geocoder classes; internal implementation unchanged
- **Pre-geocoded coordinates** (geotagged sources): preserved in `geocode.ts`, skips provider chain for those locations
- Streets first per design doc, but full plan covers all 6 iterations

## Further Considerations

1. **`GEOCODING_RESOLVERS` in `shared/`**: Once `providers.ts` in `ingest/` is the authority, the old string-based `GEOCODING_RESOLVERS` config becomes vestigial. Plan includes a cleanup step for it (Phase 5), but this needs confirmation that no other package uses it.
2. **Performance regression on streets**: Removing the `preFetchStreetGeometries()` cache means more Overpass calls per ingest. This is intentional but should be noted — the future `CacheStreetsGeocoder` restores this. Consider adding a TODO comment.
