## Plan: Notifications Report Page

Build a public, report-style page (linked from footer) that shows all-time notification delivery analytics, plus click/open conversion and source breakdown, by extending existing notification tracking and reusing the existing report-page + map/heatmap architecture. The heatmap will use message-derived coordinates (the exact message that triggered each notification), producing a 1:1 notification-to-message-coordinate mapping via the aggregate API.

**Steps**

### Phase 1 — Data model, tracking contract, and indexes

- Define new notification match fields and semantics before implementation to avoid ambiguity:
  - `openedAt`: first explicit open/read action by the user (separate from `readAt` semantics used for unread UX).
  - `clickedAt`: first push-notification click event timestamp.
- No new location field is required on `notificationMatches`; location will be derived from the triggering message geometry at query time (or from a report snapshot generated from that join).
- `messageSnapshot.source` remains the source key for per-source metrics.
- Idempotency rule: first-write-wins for `clickedAt`/`openedAt` (do not overwrite existing value).
- Add/update shared and app-level types/schema so API and UI remain type-safe.
- Apply "clean as you code" while touching files: fix adjacent, safely-fixable issues discovered in edited files (without expanding scope into unrelated refactors).
- **Add DB indexes before Phase 2 writes begin** (indexes must be in place before data flows):
  - Mongo (`db/src/indexes.ts`): compound indexes on `notificationMatches` covering `(userId, clickedAt)` and `(userId, openedAt)` for analytics aggregation and idempotent update queries.
  - Firestore (`ingest/firestore.indexes.json`): composite indexes matching the new analytics query patterns.

### Phase 2 — Capture tracking events end-to-end

**`matchId` propagation (already established — extend, don't replace):**
`notification-sender.ts` already includes `matchId` in the FCM `data` payload, and the SW template already captures it in `notificationOptions.data.matchId`, making it available in the `notificationclick` handler via `event.notification.data.matchId`. The only gap is that the current `NOTIFICATION_CLICKED` postMessage only forwards `messageId` — fix this to also forward `matchId`.

**Click endpoint auth strategy:**
Service workers cannot call authenticated endpoints directly (no Firebase auth token available in SW context). Use a two-step approach:

1. SW `notificationclick` handler sends `NOTIFICATION_CLICKED` postMessage to the app client, forwarding both `messageId` and `matchId`.
2. The app client receives the message and calls `/api/notifications/click` with the user's Firebase auth token (same `verifyAuthToken` pattern as `mark-read`).
3. As a best-effort fallback when no app window is open, the SW can fire-and-forget a POST with `matchId` only (no user auth). The endpoint handles both cases: authenticated path verifies the notification belongs to the user before writing; unauthenticated path records the click for aggregate counts without userId attribution. Apply a 3-second `AbortController` timeout to the SW fallback fetch to avoid blocking notification navigation inside `event.waitUntil`.

**Steps:**

- Fix SW template to include `matchId` in the `NOTIFICATION_CLICKED` postMessage.
- Add app-side handler for `NOTIFICATION_CLICKED` that calls `/api/notifications/click` with the auth token.
- Add `/api/notifications/click` route: accepts `{ matchId }`, uses `verifyAuthToken` for the authenticated path (verifies notification belongs to user before writing), accepts unauthenticated requests as a fallback. First-write-wins for `clickedAt`.
- Update the single-notification open/read route (`mark-read`) to also set `openedAt` (first-write-wins), while keeping existing `readAt` behavior for unread badge UX.
- Keep bulk `mark-all-read` from writing `openedAt` to avoid inflating true opens.

### Phase 3 — Analytics aggregation API

- Add a new public report API route (`/api/notifications/report`) returning all-time aggregate payload:
  - Top-level KPIs: notifications sent, unique users sent to, notifications clicked, notifications opened.
  - Heatmap points from the triggering message coordinates (1:1 with notification records), with server-side filter mode: `all`/`clicked`/`opened`.
  - Enforce privacy threshold at API level: if the selected heatmap dataset has fewer than 50 records, return no map points and a `heatmapHiddenForPrivacy: true` flag.
  - Source breakdown from `messageSnapshot.source`: sent count, clicked count (and optional CTR field for UI).
- **Auth/gating:** Route is unauthenticated (public aggregate data only). Gate with `hasReportPagesEnabled()` at the route level — return 503 when not configured, matching the pattern used by existing report endpoints.
- Extract aggregation/math/filter logic into pure functions (separate module from route handler) so behavior is unit-testable without web runtime dependencies.
- Reuse report-route behavior from existing report endpoints (node runtime, caching headers where safe, graceful 503/404 handling when report infrastructure is unavailable).

### Phase 4 — New footer-linked report page

- Add a new page under web report pages and gate visibility using existing report-page gating pattern (`hasReportPagesEnabled`). Depends on Phase 3 API.
- Use page naming convention: `Notifications` in English surfaces and `Известия` in Bulgarian UI text.
- Add footer link in "Данни и отчети" section when report pages are enabled, labeled `Известия`.
- Build page sections:
  - KPI cards for sent/users/clicked/opened.
  - Heatmap component showing notification-location density from API data.
  - Privacy-safe rendering: when API returns `heatmapHiddenForPrivacy` (dataset < 50 records), hide the map and show a clear informational message instead.
  - Filter control to switch map dataset (`all`/`clicked`/`opened`), with clicked-through mode explicitly named.
  - Source table/chart listing sent and clicked counts per source.
- Keep Bulgarian UI copy in informal (ти)/neutral register according to web language rules.

### Phase 5 — Tests and rollout checks

- Add/adjust tests with pure-function-first coverage:
  - Unit tests for pure aggregation/filter/coordinate extraction functions (happy paths + edge cases).
  - Route tests for notification tracking endpoints (click/open idempotency, auth path and unauthenticated fallback behavior).
  - API contract tests for analytics response shape, counts, and filter modes.
  - Service worker click wiring test: assert `NOTIFICATION_CLICKED` postMessage includes `matchId`.
  - Page-level tests for report availability gating and footer-link visibility with and without report bucket config.

**Relevant files**

- `/Users/Valeri_Buchinski/code/oboapp/ingest/lib/types.ts` — add new NotificationMatch fields (`clickedAt`, `openedAt`) only.
- `/Users/Valeri_Buchinski/code/oboapp/web/app/api/messages/by-id/route.ts` — reuse message lookup patterns when joining notification matches to triggering messages for coordinates in report aggregation.
- `/Users/Valeri_Buchinski/code/oboapp/web/lib/types.ts` — keep web type parity for new notification analytics fields.
- `/Users/Valeri_Buchinski/code/oboapp/shared/src/schema/notification-history.schema.ts` — extend schema if history payload needs new open/click fields.
- `/Users/Valeri_Buchinski/code/oboapp/db/src/indexes.ts` — add indexes for click/open/filter aggregation paths.
- `/Users/Valeri_Buchinski/code/oboapp/ingest/firestore.indexes.json` — add Firestore composite indexes matching new analytics queries.
- `/Users/Valeri_Buchinski/code/oboapp/ingest/notifications/notification-sender.ts` — ensure payload carries match identifier in URL/data for click tracking.
- `/Users/Valeri_Buchinski/code/oboapp/web/scripts/firebase-messaging-sw.template.js` — send click tracking event on notification click.
- `/Users/Valeri_Buchinski/code/oboapp/web/public/firebase-messaging-sw.js` — generated output updated via existing generation script.
- `/Users/Valeri_Buchinski/code/oboapp/web/app/api/notifications/mark-read/route.ts` — write `openedAt` on explicit open.
- `/Users/Valeri_Buchinski/code/oboapp/web/app/api/notifications/mark-all-read/route.ts` — keep unread logic without mass `openedAt` writes.
- `/Users/Valeri_Buchinski/code/oboapp/web/app/api/notifications/click/route.ts` — new endpoint to record `clickedAt` idempotently.
- `/Users/Valeri_Buchinski/code/oboapp/web/app/api/notifications/report/route.ts` — new aggregate analytics API for KPIs, heatmap points, and per-source metrics.
- `/Users/Valeri_Buchinski/code/oboapp/web/components/Footer.tsx` — add new report page link under data/reports.
- `/Users/Valeri_Buchinski/code/oboapp/web/lib/report-pages.ts` — reuse existing report gating strategy.
- `/Users/Valeri_Buchinski/code/oboapp/web/app/notifications-report/page.tsx` — new report page shell + gating with title `Известия` (Bulgarian UI) and internal/report naming `Notifications`.
- `/Users/Valeri_Buchinski/code/oboapp/web/app/notifications-report/NotificationsReportClient.tsx` — client UI for metrics, filters, and source breakdown.
- `/Users/Valeri_Buchinski/code/oboapp/web/app/notifications-report/NotificationsReportMapClient.tsx` — map/heatmap renderer with clicked/opened filter.

**Verification**

- Run unit tests for extracted pure functions (aggregation/filter/coordinate extraction) and route tests for click/open tracking.
- Run report API and page tests to confirm filter behavior, payload contract, and report-page gating.
- Add explicit privacy-threshold tests: for each heatmap mode (`all`, `clicked`, `opened`), verify `< 50` records returns no points and `heatmapHiddenForPrivacy=true`, while `>= 50` returns points.
- **SW generation pipeline:** After modifying the template, run `node web/scripts/generate-firebase-messaging-sw.mjs` (or the equivalent build step) and confirm the generated `web/public/firebase-messaging-sw.js` reflects the `matchId` change. The generated file must be committed alongside the template change.
- Manual smoke test in browser:
  - Send a test notification.
  - Click notification from system tray; confirm click count increments.
  - Open from in-app notifications list; confirm opened count increments.
  - Confirm heatmap toggles between `all`/`clicked`/`opened`.
  - Confirm privacy threshold behavior: with fewer than 50 records in selected mode, map is hidden and explanatory message is shown.
  - Confirm source breakdown sent/clicked counts align with sampled records.
- Mandatory pre-PR quality gates from AGENTS.md:
  - In `shared/`: `pnpm build`.
  - In `ingest/`: `pnpm lint` and `pnpm tsc --noEmit`.
  - In `web/`: `pnpm lint` and `pnpm tsc --noEmit`.
  - From repo root: `pnpm test:run`.

**Decisions**

- Page visibility: Public report page (same model as current report pages).
- Time scope: All-time totals (no date range in this iteration).
- Click/open model: Separate metrics for clicked and opened.
- Reach metric: Unique users sent to (not device count as primary KPI).
- Source breakdown: Sent + clicked counts per source.
- Privacy guardrail: heatmap is never shown for datasets with fewer than 50 records (threshold evaluated per selected heatmap mode).
- Included scope: Footer link (label `Известия`), tracking instrumentation, aggregate API, report page (`Notifications`/`Известия` naming), filterable heatmap by engagement mode with k-anonymity thresholding.
- Excluded scope: Time-range filtering UI/API, advanced attribution windows, admin-only access control, retroactive coordinate backfill beyond what can be derived from existing triggering messages.

**Further Considerations**

1. Backfill strategy recommendation: start with forward-only tracking and show analytics from rollout timestamp; optional one-off backfill can be added later if you need historical continuity.
2. Reliability recommendation: implement both service-worker click logging and app-side fallback logging to reduce undercount from browser/service-worker edge cases.
3. Privacy recommendation: keep page at aggregate level only (no user-level drilldown), consistent with public report visibility choice.
