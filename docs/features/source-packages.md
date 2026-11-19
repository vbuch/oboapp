# Source package migration

Tracking: [#586](https://github.com/oboapp/oboapp/issues/586). Published collectors and their provider documentation live in [oboapp/sources](https://github.com/oboapp/sources).

Migration work starts in [vbuch/oboapp](https://github.com/vbuch/oboapp). Validate changes against this fork's selected sources, CI and production deployment before backporting shared changes to `oboapp/oboapp`. Preserve this instance's catalog, jobs and deployment settings throughout.

## Source packages

Each collection job loads a selected package through an entrypoint in `ingest/crawlers/`. Packages supply identifiers and content. Obo owns the schedule, historical lookups, validation, create-only storage, ingestion and notifications. Raw records with precomputed GeoJSON keep their existing ingestion path.

The Sofia fork selects 22 sources. Its development workspace also retains Sensor.Community for integration testing. Sensor.Community has no selected job in the fork. The upstream demo selects it. An instance pins provider versions in `ingest/package.json` and `pnpm-lock.yaml`. [Source migration tracker](https://github.com/oboapp/oboapp/issues/609) · [Deployment verification](https://github.com/oboapp/oboapp/issues/610)

The last five packages use version `0.1.0`. Their public npm archives match their GitHub release archives byte for byte. The previous deployment used packages for 18 of the 22 selected sources. The rollout adds Sofia BG, Sofia Capital of Sport, Serdika and Krasna Polyana. Each cutover requires verification of the deployed image and collection results. [Production baseline](https://github.com/oboapp/oboapp/pull/710) · [Release and rollout checklist](https://github.com/oboapp/oboapp/issues/609)

The production build compiles selected source entrypoints and their imports alongside the common application code. It clears `dist` before compiling, so deselecting a source removes its previous output. The image uses compiled code and omits the raw crawler source tree. Docker prepares a separate production workspace that removes unselected provider dependencies before installing runtime packages.

## Scheduled scan behavior

A scan lists candidates, skips known identifiers, fetches new content, validates it, and saves complete raw records. Pagination stays within that scan. One source instance handles the batch and closes afterward, allowing provider sessions and rate limits to be reused.

Identifiers remain byte-for-byte compatible with historical URLs, including synthetic URLs. Both legacy base64 and MD5 document lookups remain supported. Known identifiers are skipped even when the provider changes an item or a package version changes.

Obo assigns the source ID, locality, identifier, crawl timestamp and initial processing state. Validation runs before persistence. Writes create new records and preserve existing records during overlapping scans.

Source content may include an optional boolean `cityWide` for notices covering the
entire selected locality. The runner preserves both `true` and `false`, leaves an
omitted field absent, and rejects other values before writing a raw record.
Ingestion receives the stored scope alongside the source's validated GeoJSON,
including an empty FeatureCollection for city-wide weather warnings.

An individual lookup, fetch, validation or save failure is logged and counted while unrelated items continue. Listing failures and repeated pagination cursors fail the scan. The next scheduled run lists again and retries identifiers that are still missing. A provider can remove an item before a successful retry; this is an accepted recovery limit of the initial migration.

## Collection patterns and compatibility

Website packages can reuse Chromium for listing and detail requests. Full-content feeds and listing/API packages can reuse content already obtained during discovery. Discovery context must stay within the SDK's serializable payload limit; larger content can remain in the source instance until fetched.

The last five adapters preserve the following provider contracts.

| Source | Behavior covered by integration tests |
| --- | --- |
| Sofia BG | Repairs listings, news RSS and listing fallback. Obo checks historical titles, URL aliases and both raw document ID formats before fetching a detail. When an article heading differs from the listing title, Obo stores both titles on the new record so future scans recognize either one. |
| Sofia Capital of Sport | WordPress RSS discovery, browser article detail and historical publication dates. |
| Serdika | HTTP collection across messages, news and events, preserving article identifiers and per-section discovery. The district's redirect omits an intermediate TLS certificate. [Production access follow-up](https://github.com/oboapp/oboapp/issues/711) |
| Krasna Polyana | Current WordPress notices use their public links. The July 2026 cutover keeps earlier Joomla records under their original identifiers. |
| Sensor.Community | The adapter supplies locality bounds and a read-only window of stored sensor readings. The package calculates air-quality alerts. Obo persists the historical grid-cell identifiers and native GeoJSON. |

Toplo uses `@oboapp/source-toplo-bg@0.2.0`. Raw-record URLs identify incidents,
while empty public detail links prevent navigation to invented detail pages.
Its restricted compatibility profile preserves historical empty titles and
malformed publication-date strings while validating content and geometry. Its
preview validates candidates without database initialization; preview counts
describe items that would be saved.

The published package's `onListing` observer receives the complete listing HTML
and UTC observation time before geometry filtering. Obo validates and retains
the complete incident snapshot on every successful listing check, including
known incidents whose estimates have changed. A verified empty listing records
zero. Version 0.2.0 replaces the temporary provider-package patch. See the
[Toplo integration guide](../../ingest/crawlers/toplo-bg/README.md#packaged-source-integration)
for snapshot persistence, failure handling and the incident APIs.

ERM Zapad uses `@oboapp/source-erm-zapad@0.1.0` for HTTP municipality discovery and incident collection. It collects every municipality before choosing the lowest event ID for matching pins, then groups the remaining points by event ID. Discovery returns identifiers and keeps the complete snapshot in the source instance for fetching. Literal synthetic identifiers and two-second request spacing match the legacy collector.

ERM content preserves the original first pin's text and dates and valid center points from incidents with mixed geometry. Optional fields stay absent when the provider omits them. Dates use the process host's local timezone. Obo repairs swapped coordinates during validation and retains historical base64/MD5 lookups. The adapter fails the job when every discovered incident fails to process; empty scans succeed. Package-to-ingestion tests cover complete raw records, preservation of existing records, failures and retries. This fork keeps the existing thirty-minute emergent job.

NIMH uses `@oboapp/source-nimh-severe-weather@0.1.1` with SDK 0.2.0. Chromium
waits for `domcontentloaded` before reading the server-rendered warning text and
tables, so discovery can finish while background requests remain active.
Discovery keeps complete warning data in the source instance, and fetching
returns that cached content for the historical synthetic identifier. The package
preserves browser-serialized warning hashes, city-wide scope, empty GeoJSON and
fixed `+02:00` forecast timespans. The adapter fails the job when every new
warning fails to process. Warning-free scans succeed. Provider parsing tests live
in the sources repository; Obo tests the published package through persistence
and ingestion.

### Lozenets

Lozenets pins [`@oboapp/source-lozenets-sofia-bg@0.2.0`](https://www.npmjs.com/package/@oboapp/source-lozenets-sofia-bg/v/0.2.0), prepared in [sources#43](https://github.com/oboapp/sources/pull/43). The published npm archive matches the inspected [GitHub release](https://github.com/oboapp/sources/releases/tag/source-lozenets-sofia-bg-v0.2.0), and the registry README and repository metadata are verified. It uses shared RSS helper 0.5.0.

Feed discovery makes at most two attempts within one 30-second budget covering requests, body reads and the retry delay. Eligible transient failures wait at least two seconds before another attempt. Supported `Retry-After` values can extend the delay when it fits the remaining budget. The [helper's retry policy](https://github.com/oboapp/sources/blob/source-web-utils-v0.5.0/packages/source-web-utils/README.md#rss-retries-and-diagnostics) defines eligible network codes and HTTP statuses. Persistent access, certificate and invalid-content failures remain scan failures.

The adapter records `RSS feed retry scheduled` as a warning and `RSS feed recovered after retry` as information in Cloud Logging and Sentry breadcrumbs. Flat diagnostic fields include `sourceType`, `feedUrl`, `diagnosticCode` and feed attempt counts, alongside Cloud Run execution and task context. Feed attempt counts describe requests inside one scan; `cloudRunTaskAttempt` identifies the scheduler attempt. Breadcrumbs accompany later Sentry exceptions, while successful recovery remains visible in Cloud Logging. Final failures retain the feed identity, attempt count and sanitized nested network cause.

Literal article URLs, RSS dates, article extraction, two-second detail pacing, source ID `lozenets-sofia-bg` and locality `bg.sofia` remain compatible. Historical base64/MD5 lookups and create-only persistence preserve stored records. The native RSS investigation in [#688](https://github.com/oboapp/oboapp/issues/688) and the older browser-navigation issue [#451](https://github.com/oboapp/oboapp/issues/451) concern different collection stages; article navigation uses `domcontentloaded`. Deployment and subsequent scheduled scans still need to confirm production recovery before closing #688.

## Instance selection and deployment

Keep the selected catalog in `shared/src/sources.ts` aligned with `ingest/terraform/source-jobs.<locality>.json`. Job keys identify deployed resources, so preserve them when translating existing configuration. Terraform selects locality maps through `var.localities`. A non-empty `var.crawlers` is an explicit manual override outside the checked selection.

The `crawl` and `pipeline` commands share a [runtime registry](../../ingest/sources/registry.ts) derived from the selected `SOURCES` array. Their help lists selected sources. `crawl --source <source-id>` rejects unselected IDs even when their directories exist. `pipeline --all` runs every selected source; `pipeline --emergent` runs selected sources whose definition has `emergent: true`. Implementations load only when their selected source runs, after environment configuration.

The upstream demo selects a small source set. `ingest/source-package-policy.json` explicitly lists unselected packages retained in the development workspace for integration tests during the transition. Retained packages still require isolated valid metadata, exact versions and unique source IDs. Unexpected unselected dependencies and stale policy entries fail validation. Remove a package's retention entry when selecting its source or removing its dependency. An absent or empty policy enables strict selection for all installed source packages. Docker omits retained packages and their policy from both the builder installation and production workspace.

This fork selects its production Sofia sources and retains the unselected Sensor.Community package for development tests. Its active Sofia job file matches that selection, while upstream's matches its demo. The full Sofia template under `ingest/terraform/examples/` is inactive. Existing deployments must retain their own catalog and job selection when rebasing. See the [instance setup guide](../setup/new-locality-instance.md) for translating the full template and updating the retention policy before deployment.

Check configuration without provider or database access:

```sh
pnpm --dir ingest exec tsx scripts/check-source-config.ts
```

The check rejects version ranges, duplicate IDs, metadata differences, unsupported localities, missing entrypoints, missing or extra jobs, reused job keys and emergent schedule differences. It loads browser-safe metadata without loading provider runtimes. The image build also checks compiled entrypoints. Source-package Chromium checks follow selected installed packages and their declared browser dependencies, including Playwright supplied through `@oboapp/source-web-utils`, and run as the production user.

## Building selected sources

Run `pnpm --dir ingest build` after building the database package. The build reads `SOURCES` from the shared instance assembly and uses each selected crawler's `index.ts` as a compiler entrypoint. Other crawler directories and test helpers are excluded from broad file discovery; imported shared helpers and runtime mock services remain available.

To remove an integration from a fork's checkout, remove its unselected provider dependency with `pnpm --dir ingest remove <package>`, remove its retention-policy entry, and remove its unselected crawler directory. Keep the source catalog and deployment jobs aligned. The production build requires selected entrypoints and their imports. Repository-wide integration tests still cover retained integrations, so forks removing them must also adapt the corresponding tests.

## Preparing builder dependencies

Docker installs root tooling first, then projects the frozen workspace inputs before installing provider packages. The projection removes retained unselected providers while preserving selected providers, ordinary dependencies, locked resolutions and configured patches. Development manifests and the lockfile stay unchanged.

The builder validates installed packages against the selected catalog and deployment jobs with the retention policy absent. Normal development checks continue to validate the original retention policy and all retained integrations.

To inspect the projected inputs after installing root tooling, use a new or empty target directory:

```sh
node ingest/scripts/prepare-build-workspace.mjs . tmp/build-workspace
pnpm --dir tmp/build-workspace install --frozen-lockfile --ignore-scripts
```

## Preparing production dependencies

The [production workspace preparation script](../../ingest/scripts/prepare-production-workspace.ts) creates disposable installation inputs containing the root, shared, database and ingest manifests. It reads installed source metadata to match package names to the selected `SOURCES` IDs, then removes unselected provider dependencies from the normal and optional production dependencies. Ordinary application dependencies and workspace links remain available.

The generated lockfile updates the matching importer entries and preserves surviving resolutions, integrity values, peer suffixes and patch references. Root overrides, patch configuration and patch files stay aligned with the lockfile. The repository's development manifests, lockfile and retained integration dependencies stay unchanged.

After building shared, database and ingest, run from the repository root:

```sh
node ingest/dist/scripts/prepare-production-workspace.js tmp/production-workspace
pnpm --dir tmp/production-workspace install --frozen-lockfile --prod --ignore-scripts
```

The target must be a new or empty directory. Docker uses `/app/production-workspace` for these installation inputs and adds the compiled application artifacts separately.

The production image installs this generated workspace into a fresh layer with `pnpm install --frozen-lockfile --prod --ignore-scripts`. It keeps the generated manifests alongside the compiled output, so package metadata and browser checks see the production selection. Browser checks resolve only the selected providers' declared browser dependencies.

The production stage sets `COREPACK_HOME=/home/node/.cache/node/corepack` before preparing pnpm. The runtime user owns this cache, making pinned pnpm available on first startup without downloading it.

The two-source configuration passed a Cloud Run deployment check on 19 November 2026. See the execution evidence below.

## Verifying a minimal image

The independent `Test Minimal Source Image` CI job creates a Docker context containing the packaged HTTP sources for Triaditsa and Sofiyska Voda, alongside shared helpers. Other crawler directories are absent. The context retains development provider dependencies and records unselected packages in its retention policy, so the ordinary Dockerfile must remove them before builder installation.

To run the same check locally after workspace installation, use a new or empty fixture directory:

```sh
pnpm --dir ingest build
node ingest/dist/scripts/prepare-source-image-fixture.js tmp/source-image
docker build --progress=plain --target builder -t oboapp-source-builder:local -f tmp/source-image/ingest/Dockerfile tmp/source-image
node ingest/dist/scripts/check-source-builder-image.js oboapp-source-builder:local
docker build --progress=plain -t oboapp-source-image:local -f tmp/source-image/ingest/Dockerfile tmp/source-image
node ingest/dist/scripts/check-source-image.js oboapp-source-image:local
```

The fixture command changes copied configuration while preserving the working checkout. Both image verifiers check selected package versions, physical dependency-store contents, source directories and entrypoint loading. The builder check also requires the retention policy to be absent. The production check verifies `USER node`, offline startup, pinned pnpm availability, selected CLI help and rejection of an unselected source.

Offline runtime checks load the selected entrypoints and run the HTTP-only browser check. They verify that database initialization and browser runtimes stay unloaded.

On 19 November 2026, Cloud Build built the two-source fixture from fork revision `c6175377`. Two isolated Cloud Run jobs executed image `sha256:3051fcaf165412558ff7894a32a1466e2b5abb0b8f041265ff5b0a0592befa9a`. Each checked the runtime registry, compiled source directories, non-root user and installed provider packages. The package store contained the SDK, Triaditsa and Sofiyska Voda. [Cloud Build record](https://console.cloud.google.com/cloud-build/builds/1b6964c3-0e4b-480a-8f7c-f081292de007?project=oborishte-map)

The jobs ran the source runner in database-free preview mode against the live providers. Execution `proof586-triaditsa-c617-plhkm` validated 20 notices. Execution `proof586-voda-c617-mk7rg` validated four. Both completed with zero item failures. [Deployment tracker](https://github.com/oboapp/oboapp/issues/610)

## Moving a source

1. Capture contracts for literal identifiers, historical lookups, content, dates, locality and scheduling. Include fixes already deployed by an instance.
2. Review the independent package, then follow its release procedure to publish it and verify the registry archive. Preserve provider parsing tests and source-mapped coverage in the sources repository.
3. Install the exact version with `pnpm --dir ingest add --save-exact <package>@<version>`. Connect the existing command entrypoint to Obo's runner, remove the replaced provider code, and update selection or retention configuration.
4. Test the actual package through raw persistence and ingestion. Cover historical skips, repeated scans, failed-item continuation, later retry and session cleanup. Run the repository's required quality checks and inspect the actual Sonar quality gate.
5. Deploy using the existing job identity. Inspect saved/skipped/failed totals, verify complete raw records reach ingestion, and confirm a later scan skips known identifiers. Record deployment evidence in the migration issue.

With the normal ingest environment configured, `pnpm --dir ingest crawl --source <source-id>` runs a scan and saves new records. A successful empty listing alone does not establish provider health; compare the result with the provider's current eligible items.

To roll back, revert the source integration and deploy the previous image. Existing raw records remain compatible. Preserve the instance catalog and deployment job selection during rollback.

## Production follow-ups and quality

### Pancharevo

Pancharevo uses [`@oboapp/source-rayon-pancharevo-bg@0.1.1`](https://www.npmjs.com/package/@oboapp/source-rayon-pancharevo-bg/v/0.1.1), prepared in [sources#39](https://github.com/oboapp/sources/pull/39). Release verification matched the published npm archive to the inspected [GitHub release assets](https://github.com/oboapp/sources/releases/tag/source-rayon-pancharevo-bg-v0.1.1) and checked the registry README and repository metadata.

Discovery reads the first page of the [planned-repairs RSS feed](https://www.pancharevo.org/gradska-i-okolna-sreda/planovi-remonti?format=feed&type=rss) advertised by the [current listing](https://www.pancharevo.org/gradska-i-okolna-sreda/planovi-remonti). It preserves literal article URLs and title-based Bulgarian event-date filtering. Current articles use `.article-body` content and the authoritative `time[datetime]` publication timestamp. Historical Joomla articles keep their content extraction and date fallbacks. Feed and article attempts keep two-second pacing.

Feed failures fail discovery before saving records. The recorded Cloud Run HTTP 403 responses remain open in [#687](https://github.com/oboapp/oboapp/issues/687). Supported provider access and a healthy production discovery and deduplication scan are still required. Provider changes to historical paths and numeric IDs also require a deduplication review before collection resumes. Preserve source ID `rayon-pancharevo-bg`, locality `bg.sofia` and create-only persistence. Keep historical backfill separate.

### Other sources

Mladost's package reports unsuccessful HTTP navigation as a failure. Provider access from Cloud Run remains blocked in [#677](https://github.com/oboapp/oboapp/issues/677); its migration still needs a healthy discovery and deduplication scan in [#673](https://github.com/oboapp/oboapp/issues/673). Krasna Polyana's provider change and production verification are tracked in [#675](https://github.com/oboapp/oboapp/issues/675).

Obo tests the package-to-ingestion contract. The sources repository owns provider implementation tests, source-mapped coverage and its own Sonar analysis. [#663](https://github.com/oboapp/oboapp/issues/663) records the verified quality-gate setup for extracted code.
