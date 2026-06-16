# Public API

## Overview

OboApp exposes a read-only public REST API for external consumption of Sofia city-infrastructure disruption data.

**Base URL:** `https://api.oboapp.online/v1`

**Interactive documentation:** [`https://api.oboapp.online/v1/docs`](https://api.oboapp.online/v1/docs)

All data endpoints require a registered API key. The OpenAPI specification is available without authentication.

## Endpoints

| Method | Path                 | Description                                                          |
| ------ | -------------------- | -------------------------------------------------------------------- |
| `GET`  | `/v1/sources`        | List all data sources                                                |
| `GET`  | `/v1/messages`       | Fetch messages filtered by geographic bounds and optional categories |
| `GET`  | `/v1/messages/by-id` | Fetch a single message by ID                                         |
| `GET`  | `/v1/openapi`        | OpenAPI 3.0 specification (no key required)                          |

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
