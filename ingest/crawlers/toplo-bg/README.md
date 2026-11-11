# Toplo website listing snapshots

The crawler fetches `https://toplo.bg/accidents-and-maintenance` on its existing
schedule. Every complete source listing produces a count snapshot in
`sourceSnapshots`, with `sourceType`, `locality`, `count`, `observedAt`, and a
complete `incidents` array.
The count includes both accidents and repairs.

The listing count uses distinct incident identities before geometry validation
and message deduplication. Previously saved incidents still contribute to each
new count. Incidents that disappear stop contributing to the next snapshot.
Historical source documents remain available for message ingestion.

Each incident capture retains the source identities, name, addresses, accident
or repair type, numeric status, reported start, estimated end, and creation date.
Missing or invalid dates remain null. Names fall back to the source region or
identity when the source provides no name. Every successful crawl captures
changed fields even when the create-only source record has already been saved.
The captures are kept independently of the historical ingestion documents.

The incident API at `GET /v1/sources/toplo-bg/incidents` joins current entries to
their first saved source records by URL. It exposes first captured estimates
for deadline comparisons. Legacy count-only observations remain readable; the
incident API returns unavailable until the first detailed capture. The nightly
daily records and the existing count APIs retain their compact count-only shape.

Before publishing a count, the crawler checks the expected page structure and
verifies that embedded incident metadata matches the visible list. A complete
empty listing records zero. Failed requests, malformed metadata, and incomplete
listings leave the previous successful snapshot unchanged. Message processing
failures do not invalidate a successfully checked source listing.

`observedAt` is the successful page-read time, stored in UTC. Consumers should
display it in `Europe/Sofia` and retain that time when showing older data. Dry
runs validate and count the listing without writing snapshots or messages.

Each observation is retained in the database. A nightly job records one daily
closing count, and comparisons use the previous Sofia calendar day's closing
count. Counts describe the net change in listed entries. Observation history
starts with the first crawl after this feature is deployed; confirmed historical
daily counts can also be imported.

The API exposes the latest snapshot at `GET /v1/sources/toplo-bg/snapshot` with
the normal API key authentication. See
[the public API documentation](../../../docs/features/public-api.md).

Deploy the accompanying `sourceSnapshots` database index before using this
endpoint.

## Packaged Source Integration

The existing job uses `@oboapp/source-toplo-bg@0.1.0` through `runSource`.
The tracked pnpm patch adds an optional `onListing` observer to the package's
public factory in both ESM and CommonJS builds. The observer receives the HTML
and check time from the package's single HTTP request, before geometry parsing.
It validates the complete listing, saves the snapshot, and returns its count.
The package accepts empty discovery only when that verified count is zero.
Without an observer, the package keeps its existing empty-list rejection.

The runner continues to own locality checks, historical lookups, atomic
create-only message writes, retries, and source cleanup. A snapshot write or
listing validation failure stops discovery before message persistence. A later
geometry or message failure preserves an already verified listing snapshot.
The package retains its request timeout and cancellation handling.

The patch is temporary. Add the listing observation API to
[`oboapp/sources`](https://github.com/oboapp/sources/tree/main/packages/source-toplo-bg),
publish a reviewed package version, pin it here, and remove the patch and its
`patchedDependencies` entry together. Keep the package observer and crawler
contract tests when upgrading. They cover both module formats, one request per
scan, verified zero, malformed listings, and snapshot persistence failures.

## Nightly Daily Timeline

The `source-daily-counts` Cloud Run job runs at 23:00 in `Europe/Sofia`, after
the default final crawl at 22:30. It stores the latest successful observation
within that Sofia date in `sourceDailyCounts`. The source-check timestamp is
preserved. Repeated runs use the same source/locality/date identity. Missing
source observations leave a gap instead of creating a zero or copying an older
day's count.

Run from `ingest/`:

```sh
pnpm exec tsx source-daily-counts.ts
pnpm exec tsx source-daily-counts.ts --date 2026-11-09
pnpm exec tsx source-daily-counts.ts --import data/source-daily-counts/toplo-bg-2026-10-11-to-2026-11-09.json
```

Historical import files contain an array of `{sourceType, locality, date,
count, observedAt}` records. Every row is validated before writing any records.
Use confirmed source counts and preserve their original check times.
The recovered 30-day archive and its provenance are kept in
[ingest/data/source-daily-counts](../../data/source-daily-counts/README.md).

`GET /v1/sources/toplo-bg/timeline?days=90` returns the current observation,
daily history, and a comparison with the previous Sofia day. Queries support
up to 366 days per response. Daily records have no automatic expiry, so the
stored timeline can grow over time. Deploy the daily-count index alongside
the nightly job and API changes.

## API consumers

[Na Stud](https://nastud.site/) consumes the authenticated timeline and incident
endpoints. Its frontend, product specs, working instructions, and GitHub Pages
publishing workflow live in [vbuch/nastud](https://github.com/vbuch/nastud).

OboApp owns the crawler, stored snapshots, nightly counts, historical imports,
and public API contract. See [the public API documentation](../../../docs/features/public-api.md)
for the data supplied to consumers.
