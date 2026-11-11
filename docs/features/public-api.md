# Public API

## Overview

OboApp exposes a read-only public REST API for external consumption of disruption data in the localities configured for your deployment.

The public API is served by the dedicated API module and (sub)domain.
The web app does not serve public API endpoints directly.

For backwards compatibility with existing clients that still call the web domain, web permanently redirects `/api/v1/*` requests to the configured public API host.

**Base URL:** deployment-specific (for example `https://api.oboapp.online/v1`)

**Interactive documentation:** `<your-api-host>/v1/docs` (for example [`https://api.oboapp.online/v1/docs`](https://api.oboapp.online/v1/docs))

For configuring hosts and locality-specific deployment setup, see [Deploying oboapp for a New City](../setup/new-locality-instance.md) and [Production Setup](../setup/production-setup.md).

All data endpoints require a registered API key. The OpenAPI specification is available without authentication.

## Legacy Client Redirect

If clients still call `<web>/api/v1/...`, web redirects those requests to the public API host.

Set `PUBLIC_API_HOST` in the web environment to keep this compatibility redirect active.
If `PUBLIC_API_HOST` is not set, web still starts, but `/api/v1/*` requests fail with `500`.

## Endpoints

| Method | Path                            | Description                                                         |
| ------ | ------------------------------- | ------------------------------------------------------------------- |
| `GET`  | `/v1/sources`                   | List all data sources                                               |
| `GET`  | `/v1/sources/:sourceId/snapshot` | Latest successful complete listing count for a source                |
| `GET`  | `/v1/sources/:sourceId/timeline` | Current count, daily closing history, and yesterday comparison       |
| `GET`  | `/v1/sources/:sourceId/incidents` | Complete current Toplo listing and first recorded estimates         |
| `GET`  | `/v1/messages`                  | Fetch messages filtered by geographic bounds and optional categories |
| `GET`  | `/v1/messages/by-id`            | Fetch a single message by ID                                         |
| `GET`  | `/v1/openapi`                   | OpenAPI 3.0 specification (no key required)                           |

## Source Count Snapshots

`GET /v1/sources/toplo-bg/snapshot` returns the latest successful count from the Toplo crawler. The count includes both accidents and repairs currently listed on the source website, before message deduplication and map validation.

```json
{
  "snapshot": {
    "sourceType": "toplo-bg",
    "locality": "bg.sofia",
    "count": 99,
    "observedAt": "2026-11-09T19:30:00.000Z",
    "sourceUrl": "https://toplo.bg/accidents-and-maintenance"
  }
}
```

- `observedAt` is the UTC time of the successful source check. Display it in `Europe/Sofia` for the Bulgarian counter.
- Failed fetches and incomplete parses leave the previous snapshot and its timestamp available. Clients should use `observedAt` to indicate stale data.
- A verified empty listing returns `count: 0`.
- An unknown source or a source outside the configured locality returns `404` with `Source not found`. A configured source without a recorded snapshot returns `404` with `No successful snapshot available for this source`.
- Database errors return `500`.

Snapshot collection currently runs for `toplo-bg`. It follows the deployed crawler schedule. The repository default runs every 30 minutes from 07:00 through 22:30 in `Europe/Sofia`.

Each successful listing check is retained in snapshot history. This endpoint returns only the latest snapshot; the timeline endpoint adds daily closing counts and yesterday's comparison. Counts measure the number of entries published by the source.

## Daily Count Timeline

`GET /v1/sources/toplo-bg/timeline?days=90` returns daily closing counts in ascending date order, together with the latest source check. `days` is an integer from 1 through 366 and defaults to 90. The query window ends on the current Sofia calendar date. Daily records remain stored until explicitly deleted; this query limit controls the size of each response.

```json
{
  "sourceType": "toplo-bg",
  "locality": "bg.sofia",
  "sourceUrl": "https://toplo.bg/accidents-and-maintenance",
  "current": { "count": 99, "observedAt": "2026-11-09T20:30:00.000Z" },
  "daily": [
    { "date": "2026-11-08", "count": 103, "observedAt": "2026-11-08T20:30:00.000Z" }
  ],
  "comparison": {
    "date": "2026-11-08",
    "count": 103,
    "observedAt": "2026-11-08T20:30:00.000Z",
    "change": -4
  }
}
```

The nightly job runs at 23:00 in `Europe/Sofia`. It records the latest successful check within that Sofia calendar day. Repeating a job updates the same source/date point. A missing day remains a gap; no zero or carried-forward count is created.

`comparison` uses the daily closing count from the calendar day before `current.observedAt` in Sofia. Its `change` is the current count minus that daily count. A stale current check retains its actual date, so clients should display `comparison.date` when needed. `current` and `comparison` are `null` when their inputs are missing. Daily history can still be returned without a current check.

Use each point's `observedAt` for the actual source-check time. It can be earlier than the nightly recording time. The endpoint uses the normal API key authentication, rate limits, and usage tracking.

The endpoint requires the same API key as the other data endpoints. Keep that key in server configuration or a GitHub Actions secret. For a counter hosted on GitHub Pages, a workflow can fetch the snapshot and publish a public `snapshot.json` alongside the HTML. The page reads that file and displays the original `observedAt` time. The API response uses `Cache-Control: private, max-age=60`.

## Current Incident List

`GET /v1/sources/toplo-bg/incidents` returns every accident and repair from the
latest complete listing capture. Its `count` and `observedAt` belong to the same
capture as the returned `incidents` array. The source check runs before geometry
validation and message deduplication, so existing entries and entries without
usable map data remain in the list.

```json
{
  "sourceType": "toplo-bg",
  "locality": "bg.sofia",
  "sourceUrl": "https://toplo.bg/accidents-and-maintenance",
  "observedAt": "2026-11-11T15:00:00.000Z",
  "count": 1,
  "incidents": [{
    "id": "example-content-item-id",
    "accidentId": "example-accident-id",
    "name": "Част от Яворов",
    "addresses": "ул. Цар Иван Асен II 42",
    "type": "accident",
    "status": 1,
    "reportedStart": "2025-11-04T15:00:00Z",
    "estimatedEnd": "2026-11-15T20:00:00Z",
    "createdAt": "2025-11-04T13:20:43Z",
    "firstObservedAt": "2026-02-06T19:01:12.027Z",
    "firstReportedStart": "2025-11-04T15:00:00.000Z",
    "firstEstimatedEnd": "2026-02-27T20:00:00.000Z"
  }]
}
```

`id` is Toplo's stable `ContentItemId`; `accidentId` is its visible listing ID.
`type` is `accident` or `repair`. `status` preserves the source's numeric value.
`reportedStart`, `estimatedEnd`, and `createdAt` preserve source dates; missing
or invalid dates are `null`. The source's displayed clock values and its `Z`
suffix need separate timezone verification before treating them as precise
elapsed hours.

The three `first*` fields come from the earliest saved source record with the
same source URL and locality. They are `null` if no baseline is available.
`firstEstimatedEnd` is also `null` for the legacy missing-estimate fallback
where the crawler substituted the start date. These fields describe the first
estimate OboApp captured, which may be later than the original announcement.
They support a net deadline-extension comparison; they cannot reconstruct
intermediate revisions made before per-incident snapshots were enabled.

Age is based on the reported start. Start dates and affected addresses can
change under the same source ID. Listing presence therefore identifies a
currently published record and does not establish continuous loss of service.
Passing an estimated end does not remove an entry from this endpoint.

A verified empty listing returns `count: 0` and `incidents: []`. No detailed
capture, including a legacy count-only snapshot, returns `503`. Unsupported
sources and localities return `404`; corrupt data and storage failures return
`500`. Authentication, rate limits, usage tracking, and the private 60-second
cache policy match the other source endpoints. Existing snapshot and timeline
responses continue to return counts only.

## Authentication

All data endpoints require a valid API key sent in the `X-Api-Key` request header:

```http
GET https://api.oboapp.online/v1/messages?north=42.8&south=42.6&east=23.4&west=23.2
X-Api-Key: obo_abc123...
```

Missing or invalid keys receive a `401 Unauthorized` response.

## Rate Limiting

Rate limiting is optional and controlled by the `PUBLIC_API_RATE_LIMIT_PER_MINUTE` environment variable.

- Disabled by default: when the variable is missing or invalid, requests are not rate-limited
- Enabled mode: set `PUBLIC_API_RATE_LIMIT_PER_MINUTE` to a positive integer (for example `60`)
- Scope: shared across protected data endpoints
- Throttled response: `429 Too Many Requests` (only when rate limiting is enabled)

When rate limiting is enabled and a request is allowed (`2xx`), response headers include:

- `X-RateLimit-Limit`: minute limit for the key
- `X-RateLimit-Remaining`: remaining requests in the current minute window

When a request is throttled (`429`), response headers include:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `Retry-After`: seconds until the next minute window

For non-throttled `4xx/5xx` responses, rate-limit headers are not included.

OboApp also records internal hourly usage counters per key and endpoint for operations monitoring.

## Getting an API Key

Registered OboApp users can generate and revoke their own API key from the **Settings** page (under "Публичен API достъп"). Each user can hold at most one active key.

Guest mode does not include API key management; users must sign in with Google first.

When generating a key, users must provide a URL to a public website, repository, or project page that describes where the data will be used.

Keys have the format `obo_<random>` and can be viewed from the Settings page — treat them as secrets and store them securely.

## Revoking an API Key

From the Settings page, click **Отмени API ключа**. Revocation requires typing **ОТМЕНИ** in the confirmation dialog. This is permanent.
