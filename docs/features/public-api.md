# Public API (`/api/v1`)

## Overview

OboApp exposes a read-only public REST API at `/api/v1` for external consumption of Sofia city-infrastructure disruption data. All data endpoints require a registered API key. The OpenAPI specification is available without authentication at `/api/v1/openapi`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/sources` | List all data sources |
| `GET` | `/api/v1/messages` | Fetch messages filtered by geographic bounds and optional category |
| `GET` | `/api/v1/messages/by-id` | Fetch a single message by ID |
| `GET` | `/api/v1/openapi` | OpenAPI 3.0 specification (no key required) |

## Authentication

All data endpoints require a valid API key sent in the `X-Api-Key` request header:

```http
GET /api/v1/messages?north=42.8&south=42.6&east=23.4&west=23.2
X-Api-Key: obo_abc123...
```

Missing or invalid keys receive a `401 Unauthorized` response.

## Getting an API Key

Registered OboApp users can generate and revoke their own API key from the **Settings** page (under "Публичен API достъп"). Each user can hold at most one active key.

When generating a key, users must provide a URL to a public website, repository, or project page that describes where the data will be used.

Keys have the format `obo_<random>` and are shown once at creation — copy and store them securely.

## Revoking an API Key

From the Settings page, click **Отмени API ключа**. Revocation requires typing **ОТМЕНИ** in the confirmation dialog. This is permanent.

## Static Keys (Pre-configured)

The `PUBLIC_API_KEYS` environment variable accepts a comma-separated list of static API keys that bypass the database lookup (fast path). Useful for internal or pre-provisioned clients (e.g., the YSM mobile app):

```bash
# web/.env.local
PUBLIC_API_KEYS=key-ysm-abc123
```

## Query Parameters

### `GET /api/v1/messages`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `north` | number | Yes | Northern latitude bound |
| `south` | number | Yes | Southern latitude bound |
| `east` | number | Yes | Eastern longitude bound |
| `west` | number | Yes | Western longitude bound |
| `category` | string | No | Filter by category |
| `limit` | integer | No | Maximum number of results |

### `GET /api/v1/messages/by-id`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Message document ID |

## Backward Compatibility

The `/api/ysm` routes remain unchanged and continue to serve the YSM mobile app.
