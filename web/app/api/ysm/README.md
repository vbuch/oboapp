# Your Sofia (YSM) API

The Your Sofia mobile application is a client of the OboApp API. **OboApp defines and owns the API contract.** Any change to the API must be reflected in the Your Sofia app.

## Status

Pre-production. The contract may change while Your Sofia is not yet live.

This API surface is limited to YSM-specific notification endpoints that use Firebase Auth.
Public read-only data endpoints are exposed through `/api/v1` and require `X-Api-Key`.

## Schema

A public OpenAPI schema is exposed at:

- /api/ysm/openapi
