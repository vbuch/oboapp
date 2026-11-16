# Source package migration

Tracking: [#586](https://github.com/oboapp/oboapp/issues/586). Published collectors and their provider documentation live in [oboapp/sources](https://github.com/oboapp/sources).

Work on #586 starts in [vbuch/oboapp](https://github.com/vbuch/oboapp). Validate changes against this fork's selected sources, CI and production deployment before backporting generic changes to `oboapp/oboapp`. Preserve this instance's catalog, jobs and deployment settings during both steps.

## Current transition

Each selected source uses either a published package or a remaining legacy crawler. Both collection paths save complete raw records for the same ingestion, event-matching and notification pipeline. Sources that supply GeoJSON keep their existing processing path.

| Responsibility | Legacy sources | Packaged sources |
| --- | --- | --- |
| Provider requests, parsing and content conversion | Collector code in Obo | Independently versioned source packages |
| Historical lookup, validation and raw persistence | Obo's collection helpers | Obo's scheduled source runner |
| Scheduling, catalog selection and downstream processing | Obo | Obo |

Installed package versions are pinned in `ingest/package.json` and `pnpm-lock.yaml`. The [remaining migration tracker](https://github.com/oboapp/oboapp/issues/609) records source cutovers. [Selection and deployment work](https://github.com/oboapp/oboapp/issues/610) tracks deployment of a minimal instance. The image checks below exercise a two-source builder and production image.

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

Each migration preserves provider-specific URL filtering, date fallback, content conversion and legacy deduplication. Contract fixtures protect these behaviors before the old provider implementation is removed. Sofia's historical title fallback must remain supported when that source migrates.

Toplo illustrates synthetic identifiers: raw-record URLs identify incidents, while empty public detail links prevent navigation to invented detail pages. Its restricted compatibility profile preserves historical empty titles and malformed publication-date strings while validating content and geometry. Its preview validates candidates without database initialization; preview counts describe items that would be saved.

ERM Zapad uses `@oboapp/source-erm-zapad@0.1.0` for HTTP municipality discovery and incident collection. It collects every municipality before choosing the lowest event ID for matching pins, then groups the remaining points by event ID. Two-second request spacing and literal synthetic identifiers stay compatible with the legacy collector. Discovery returns identifiers while the source instance keeps the complete snapshot for fetching.

ERM content preserves the original first pin's text and dates, valid center points from mixed-geometry incidents and omitted optional fields. Dates keep the legacy host-local timezone behavior. Obo repairs swapped coordinates during validation and retains historical base64/MD5 lookups. The adapter fails the job when every discovered incident fails to process; empty scans succeed. Package-to-ingestion contracts cover these rules, complete raw records, no overwrites, failures and retries. The existing emergent job keeps its thirty-minute schedule.

NIMH uses `@oboapp/source-nimh-severe-weather@0.1.1` with SDK 0.2.0. Chromium
waits for `domcontentloaded` before reading the server-rendered warning text and
tables, so discovery can finish while background requests remain active.
Discovery keeps complete warning data in the source instance, and fetching
returns that cached content for the historical synthetic identifier. The package
preserves browser-serialized warning hashes, city-wide scope, empty GeoJSON and
fixed `+02:00` forecast timespans. The adapter fails the job when every discovered
warning fails to process. Warning-free scans succeed. Provider parsing tests live
in the sources repository; Obo tests the published package through persistence
and ingestion.

### Lozenets

Lozenets pins [`@oboapp/source-lozenets-sofia-bg@0.2.0`](https://www.npmjs.com/package/@oboapp/source-lozenets-sofia-bg/v/0.2.0), prepared in [sources#43](https://github.com/oboapp/sources/pull/43). The published npm archive matches the inspected [GitHub release](https://github.com/oboapp/sources/releases/tag/source-lozenets-sofia-bg-v0.2.0), and the registry README and repository metadata are verified. It uses shared RSS helper 0.5.0.

Feed discovery makes at most two attempts within one 30-second budget covering requests, body reads and the retry delay. Eligible transient failures wait at least two seconds before another attempt. Supported `Retry-After` values can extend the delay when it fits the remaining budget. The [helper's retry policy](https://github.com/oboapp/sources/blob/source-web-utils-v0.5.0/packages/source-web-utils/README.md#rss-retries-and-diagnostics) defines eligible network codes and HTTP statuses. Persistent access, certificate and invalid-content failures remain scan failures.

The adapter records `RSS feed retry scheduled` as a warning and `RSS feed recovered after retry` as information in Cloud Logging and Sentry breadcrumbs. Flat diagnostic fields include `sourceType`, `feedUrl`, `diagnosticCode` and feed attempt counts, alongside Cloud Run execution and task context. Feed attempt counts describe requests inside one scan; `cloudRunTaskAttempt` identifies the scheduler attempt. Breadcrumbs accompany later Sentry exceptions, while successful recovery remains visible in Cloud Logging. Final failures retain the feed identity, attempt count and sanitized nested network cause.

Literal article URLs, RSS dates, article extraction, two-second detail pacing, source ID `lozenets-sofia-bg` and locality `bg.sofia` remain compatible. Historical base64/MD5 lookups and create-only persistence preserve stored records. The native RSS investigation in [#688](https://github.com/oboapp/oboapp/issues/688) and the older browser-navigation issue [#451](https://github.com/oboapp/oboapp/issues/451) concern different collection stages; article navigation uses `domcontentloaded`. Deployment and subsequent scheduled scans still need to confirm production recovery before closing #688.

### Pancharevo

Pancharevo uses [`@oboapp/source-rayon-pancharevo-bg@0.1.1`](https://www.npmjs.com/package/@oboapp/source-rayon-pancharevo-bg/v/0.1.1), prepared in [sources#39](https://github.com/oboapp/sources/pull/39). The published npm archive matches the inspected [GitHub release assets](https://github.com/oboapp/sources/releases/tag/source-rayon-pancharevo-bg-v0.1.1), and the registry README and repository metadata are verified.

Discovery reads the first page of the [planned-repairs RSS feed](https://www.pancharevo.org/gradska-i-okolna-sreda/planovi-remonti?format=feed&type=rss) advertised by the [current listing](https://www.pancharevo.org/gradska-i-okolna-sreda/planovi-remonti). It preserves literal article URLs and title-based Bulgarian event-date filtering. Current articles use the scoped `.article-body` content and their authoritative `time[datetime]` publication timestamp. Historical Joomla articles retain their existing content extraction and date fallbacks. Feed and article attempts keep two-second pacing.

The provider changed historical paths and some numeric IDs. Before production collection, compare discovered candidates with historical records and review deduplication while preserving source ID `rayon-pancharevo-bg`, locality `bg.sofia` and create-only persistence. Cloud Run access remains blocked by the recorded HTTP 403 responses in [#687](https://github.com/oboapp/oboapp/issues/687). Supported provider access and a healthy production discovery and deduplication scan remain required; keep historical backfill separate.

## Instance selection and deployment

Keep the selected catalog in `shared/src/sources.ts` aligned with `ingest/terraform/source-jobs.<locality>.json`. Job keys identify deployed resources, so preserve them when translating existing configuration. Terraform selects locality maps through `var.localities`. A non-empty `var.crawlers` is an explicit manual override outside the checked selection.

The `crawl` and `pipeline` commands share a [runtime registry](../../ingest/sources/registry.ts) derived from the selected `SOURCES` array. Their help lists selected sources. `crawl --source <source-id>` rejects unselected IDs even when their directories exist. `pipeline --all` runs every selected source; `pipeline --emergent` runs selected sources whose definition has `emergent: true`. Implementations load only when their selected source runs, after environment configuration.

The upstream demo selects a small source set. `ingest/source-package-policy.json` explicitly lists unselected packages retained in the development workspace for integration tests during the transition. Retained packages still require isolated valid metadata, exact versions and unique source IDs. Unexpected unselected dependencies and stale policy entries fail validation. Remove a package's retention entry when selecting its source or removing its dependency. An absent or empty policy enables strict selection for all installed source packages. Docker omits retained packages and their policy from both the builder installation and production workspace.

Upstream's default Sofia job file matches its three-source demo. This fork selects 22 sources and all 18 installed provider packages, with no development retention policy. Four selected collectors still use legacy implementations: Sofia BG, Krasna Polyana, Sofia Capital of Sport and Serdika. The full Sofia template under `ingest/terraform/examples/` is inactive. Existing deployments must retain their own catalog and job selection when rebasing. See the [instance setup guide](../setup/new-locality-instance.md) for translating the full template and updating the retention policy before deployment.

Check configuration without provider or database access:

```sh
pnpm --dir ingest exec tsx scripts/check-source-config.ts
```

The check rejects version ranges, duplicate IDs, metadata differences, unsupported localities, missing entrypoints, missing or extra jobs, reused job keys and emergent schedule differences. It loads browser-safe metadata without loading provider runtimes. The image build also checks compiled entrypoints. Source-package Chromium checks follow selected installed packages and their declared browser dependencies, including Playwright supplied through `@oboapp/source-web-utils`, and run as the production user.

## Building selected sources

Run `pnpm --dir ingest build` after building the database package. The build reads `SOURCES` from the shared instance assembly and uses each selected crawler's `index.ts` as a compiler entrypoint. Other crawler directories and test helpers are excluded from broad file discovery; imported shared helpers and runtime mock services remain available.

To remove an integration from a fork's checkout, remove its unselected provider dependency with `pnpm --dir ingest remove <package>`, remove its retention-policy entry, and remove its unselected crawler directory. Keep the source catalog and deployment jobs aligned. The production build requires selected entrypoints and their imports. Repository-wide integration tests still cover retained integrations, so forks removing them must also adapt the corresponding tests.

Docker first installs only the root package's build tools. This stage contains no provider packages. The [build workspace preparation command](../../ingest/scripts/prepare-build-workspace.mjs) reads `retainedUnselectedPackages` before any provider installation and removes those dependencies from the ingest manifest and matching lockfile importer entries. It preserves other dependencies, locked resolutions, peer information, overrides and configured patches. It requires no installed source metadata or compiled shared package.

A fresh builder stage installs the projected workspace with `pnpm install --frozen-lockfile --ignore-scripts`, builds the selected entrypoints and validates installed metadata against the catalog and deployment jobs. The development retention policy is absent there, so unexpected unselected packages fail validation. Keep the policy aligned with the catalog: excluding a selected provider makes its entrypoint fail compilation. The normal development CI checks still validate retained packages and the original policy.

To inspect the generated inputs locally after installing root tooling:

```sh
node ingest/scripts/prepare-build-workspace.mjs . tmp/build-workspace
pnpm --dir tmp/build-workspace install --frozen-lockfile --ignore-scripts
```

The target must be new or empty. This command writes installation inputs; Docker copies application sources into the builder separately.

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

Deployment of a minimal instance remains in [#610](https://github.com/oboapp/oboapp/issues/610).

## Verifying a minimal image

The independent `Test Minimal Source Image` CI job creates a Docker context containing the packaged HTTP sources for Triaditsa and Sofiyska Voda, alongside shared helpers. Other crawler directories are absent. The context retains the development provider dependencies and records unselected packages in its retention policy, so the ordinary Dockerfile must remove them before the builder installation.

To run the same check locally after workspace installation, use a new or empty fixture directory:

```sh
pnpm --dir ingest build
node ingest/dist/scripts/prepare-source-image-fixture.js tmp/source-image
docker build --progress=plain --target builder -t oboapp-source-builder:local -f tmp/source-image/ingest/Dockerfile tmp/source-image
node ingest/dist/scripts/check-source-builder-image.js oboapp-source-builder:local
docker build --progress=plain -t oboapp-source-image:local -f tmp/source-image/ingest/Dockerfile tmp/source-image
node ingest/dist/scripts/check-source-image.js oboapp-source-image:local
```

The [fixture preparation command](../../ingest/scripts/prepare-source-image-fixture.ts) changes the copied catalog and deployment jobs while preserving the working checkout. The [builder verifier](../../ingest/scripts/check-source-builder-image.ts) checks the builder's manifests, physical pnpm store, selected implementations and absence of the retention policy. The [production image verifier](../../ingest/scripts/check-source-image.ts) checks that the final pnpm store contains only the source SDK, Triaditsa and Sofiyska Voda packages, and that compiled crawler directories contain the two selected sources and shared helpers. It also checks `USER node`, offline startup through the default command, pinned pnpm availability, selected CLI help and rejection of an unselected source.

Runtime checks use containers with networking disabled. They load selected entrypoints and run the HTTP-only browser check, verifying that database initialization and browser runtimes stay unloaded. Source collection is never invoked. The two-source Linux image has passed these checks locally. A minimal cloud deployment remains separate work.

## Moving a source

1. Capture contracts for literal identifiers, historical lookups, content, dates, locality and scheduling. Include fixes already deployed by an instance.
2. Review and publish the independent package. Preserve provider parsing tests and source-mapped coverage in the sources repository.
3. Install the exact version with `pnpm --dir ingest add --save-exact <package>@<version>`. Connect the existing command entrypoint to Obo's runner, remove the replaced provider code, and update selection or retention configuration.
4. Test the actual package through raw persistence and ingestion. Cover historical skips, repeated scans, failed-item continuation, later retry and session cleanup. Run the repository's required quality checks and inspect the actual Sonar quality gate.
5. Deploy using the existing job identity. Inspect saved/skipped/failed totals, verify complete raw records reach ingestion, and confirm a later scan skips known identifiers. Record deployment evidence in the migration issue.

With the normal ingest environment configured, `pnpm --dir ingest crawl --source <source-id>` runs a scan and saves new records. A successful empty listing alone does not establish provider health; compare the result with the provider's current eligible items.

To roll back, revert the source integration and deploy the previous image. Existing raw records remain compatible. Preserve the instance catalog and deployment job selection during rollback.

## Production follow-ups and quality

Mladost's package reports unsuccessful HTTP navigation as a failure. Provider access from Cloud Run remains blocked in [#677](https://github.com/oboapp/oboapp/issues/677); its migration still needs a healthy discovery and deduplication scan in [#673](https://github.com/oboapp/oboapp/issues/673). Legacy provider repairs remain part of the remaining migration tracker.

Obo tests the package-to-ingestion contract. The sources repository owns provider implementation tests, source-mapped coverage and its own Sonar analysis. [#663](https://github.com/oboapp/oboapp/issues/663) records the verified quality-gate setup for extracted code.
