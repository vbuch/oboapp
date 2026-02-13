# MongoDB Migration Plan

## Overview

Introduce MongoDB alongside Firestore via a new `@oboapp/db` monorepo package that abstracts all database operations. The migration happens in two stages:

- **Stage 1:** MongoDB added, all data migrated from Firestore, writes go to both databases, reads stay on Firestore.
- **Stage 2:** Reads switch to MongoDB, Firestore becomes a backup write target.

Firebase Auth and FCM remain untouched — only Firestore is being replaced.

MongoDB will eventually be hosted on a VPS.

## Current State

- All frontend data access goes through Next.js API routes using the Firebase Admin SDK (`adminDb`). No direct Firestore client SDK usage on the frontend.
- **6 Firestore collections:** `messages`, `sources`, `interests`, `notificationSubscriptions`, `notificationMatches`, `gtfsStops`
- **Firestore-specific patterns in use:** `FieldValue.serverTimestamp()`, `FieldValue.arrayUnion()`, `batch.commit()`, `doc.create()` (atomic), `Timestamp` types, stringified JSON fields (`geoJson`, `addresses`)
- **~30+ files** directly call `adminDb.collection(...)` across `ingest/` and `web/`
- `processFieldsForFirestore()` handles Firestore-specific serialization (stringifying objects, converting Dates to server timestamps) — will become adapter-specific

## Decisions

| Decision                 | Choice                                                                 | Rationale                                       |
| ------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------- |
| Firebase Auth            | Keep                                                                   | Only Firestore is being replaced                |
| Firebase Cloud Messaging | Keep                                                                   | Push notifications stay on FCM                  |
| Collections migrated     | All 6 from the start                                                   | Dual-write must be comprehensive                |
| DB package location      | Top-level `db/` (`@oboapp/db`)                                         | Clean monorepo separation                       |
| Compose files            | `compose.yml` (MongoDB) + `compose.emulators.yml` (Firebase emulators) | Existing `docker-compose.yml` renamed           |
| Geospatial               | MongoDB 2dsphere indexes                                               | Replaces app-level geo filtering                |
| Type mapping             | MongoDB stores native types                                            | No more stringified JSON or FieldValue wrappers |

## Steps

### Step 0: Document the plan

Write this plan into `docs/features/mongodb-migration-plan.md`.

### Step 1: Infrastructure setup

1. Rename `docker-compose.yml` → `compose.emulators.yml`
2. Create `compose.yml` with MongoDB 7+ service (persistent volume, health check, Mongo Express admin UI)
3. Add `db/` to `pnpm-workspace.yaml`
4. Podman natively supports compose v2 format via `podman compose`

### Step 2: Create `@oboapp/db` package at `db/`

1. `db/package.json` with dependencies: `mongodb`, `@oboapp/shared`
2. `db/tsconfig.json`
3. Database abstraction interface in `db/src/`:
   - `types.ts` — `DbClient` interface: `findOne()`, `findMany()`, `insertOne()`, `updateOne()`, `deleteOne()`, `deleteMany()`, `batchWrite()`, `count()`
   - `firestore-adapter.ts` — Wraps `adminDb` Firestore calls
   - `mongo-adapter.ts` — MongoDB driver implementation
   - `dual-write.ts` — Writes to both, reads from configured primary (`DB_READ_SOURCE` env var)
   - `index.ts` — Factory `createDbClient(config)` and collection helpers
4. Collection repositories in `db/src/collections/`:
   - `messages.ts`, `sources.ts`, `interests.ts`, `notification-matches.ts`, `notification-subscriptions.ts`, `gtfs-stops.ts`
5. Firestore↔MongoDB type mapping:
   - `FieldValue.serverTimestamp()` → `new Date()`
   - `FieldValue.arrayUnion()` → `$addToSet`
   - Firestore `Timestamp` → `Date`
   - Stringified JSON (`geoJson`, `addresses`) → native objects

### Step 3: Migration script at `db/src/migrate/firestore-to-mongo.ts`

1. Read all documents from each Firestore collection
2. Transform Firestore types → MongoDB types (timestamps, parse stringified JSON)
3. Bulk upsert into MongoDB collections (idempotent — safe to re-run)
4. Verify document counts match
5. Log summary report

### Step 4: MongoDB indexes in `db/src/indexes.ts`

Translated from `firestore.indexes.json` plus geospatial:

- **messages:** `{ categories: 1, timespanEnd: -1 }`, `{ timespanEnd: -1, createdAt: -1 }`, `{ source: 1, timespanEnd: -1 }`, `{ notificationsSent: 1, createdAt: 1 }`, `{ "geoJson.features.geometry": "2dsphere" }`, `{ finalizedAt: -1 }`
- **notificationMatches:** `{ notified: 1, userId: 1, notifiedAt: -1 }`
- **notificationSubscriptions:** `{ userId: 1 }`
- **interests:** `{ userId: 1 }`
- **gtfsStops:** `{ _id: 1 }` (stopCode as `_id`)

### Step 5: Refactor consumers

Replace direct `adminDb.collection(...)` calls across the codebase:

**`ingest/` side (write-heavy):**

- `ingest/messageIngest/db/store-incoming-message.ts` → `db.messages.insertOne()`
- `ingest/messageIngest/db/update-message.ts` → `db.messages.updateOne()`
- `ingest/messageIngest/db/get-message.ts` → `db.messages.findOne()`
- `ingest/messageIngest/from-sources.ts` → `db.sources.findMany()`
- `ingest/crawlers/shared/firestore.ts` → `db.sources.insertOne()` / `db.sources.findOne()`
- `ingest/notifications/*` — all files use db abstraction
- `ingest/lib/sources-clean.ts` → `db.sources.deleteMany()`
- `ingest/lib/gtfs-service.ts`, `ingest/lib/gtfs-geocoding-service.ts` → `db.gtfsStops`

**`web/` side (read-heavy + some writes):**

- `web/app/api/messages/route.ts` → `db.messages.findMany()` with native geo queries (Stage 2)
- `web/app/api/messages/by-id/route.ts`
- `web/app/api/messages/by-source/route.ts`
- `web/app/api/messages/ingest-errors/route.ts`
- `web/app/api/interests/route.ts`
- `web/app/api/notifications/*` — subscription, history routes
- `web/app/api/user/route.ts` — user deletion cascade
- `web/app/api/sources/route.ts`
- `web/lib/doc-to-message.ts` — simplify (Mongo stores native types)

### Step 6: Environment configuration

- New env vars: `MONGODB_URI`, `MONGODB_DATABASE`, `DB_READ_SOURCE=firestore|mongodb`
- Stage 1: `DB_READ_SOURCE=firestore` (reads from Firestore, writes to both)
- Stage 2: `DB_READ_SOURCE=mongodb` (reads from MongoDB, writes to both)
- Update `.env.example` files

### Step 7: Documentation

- Update this plan with implementation notes
- Update `AGENTS.md` with `@oboapp/db` conventions

## Verification

- **Integration tests:** Test db adapters against a real local MongoDB instance (via compose)
- **Migration verification:** Script outputs document count comparison per collection
- **Dual-write verification:** Write a message through the pipeline, confirm it appears in both databases
- **Index verification:** `db.messages.getIndexes()` in mongo shell
- **Read toggle:** Switch `DB_READ_SOURCE` between `firestore` and `mongodb`, confirm identical API responses
- Run `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test:run` across all packages
