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
