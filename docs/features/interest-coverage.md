# Public interest coverage report

`/interest-coverage` displays a precomputed, anonymized report of currently saved
zones through the public `GET /api/interests/report` endpoint. No sign-in is
required. Both are available when `GCS_GENERIC_BUCKET` is configured, using the
same report-page gate and footer section as the history report.

## Generation and storage

From `ingest/`, run `pnpm interest-coverage-report` or
`pnpm interest-coverage-report --dry-run`. The script loads dotenv before database
initialization, reads only user ID, coordinates and radius through `@oboapp/db`,
and uploads **only the approved aggregate** to `interests/report.json`.
Terraform schedules a Cloud Run job monthly on the first day at 06:00 in
`schedule_timezone` (Europe/Sofia by default). Override
`schedules.interest_coverage_report` to change the cadence, or execute the job
manually. A failed job logs an error and is covered by the standard log alert.

The report expires after 45 days. Existing report prefixes retain their ten-day
retention. `interests/revision.json` has no lifecycle expiry: it is a persistent
privacy control, not a disposable snapshot. For longer generation intervals,
increase the report retention and its documented maximum age together.

## Coverage and privacy

Active means valid, currently saved zones with circle coverage intersecting the
configured locality's shared rectangular bounds. It does not imply a registered
push device. Malformed IDs/coordinates and radii outside 100–1000 meters are
excluded. Zones centered just outside the bounds can contribute if their circles
intersect the city grid. The default locality is Sofia; forks can use another
locality present in the shared bounds registry.

The fixed grid uses approximately 2 km cells (clipped at the city bounds).
Circle/rectangle intersections use a local metric approximation. A colored cell
means some zone coverage intersects that cell, not that every address in it is
covered. The map intentionally sacrifices precision and completeness.

1. Fewer than ten distinct contributing users produces an unavailable snapshot
   with **no cells and no counts**. Multiple zones from one user count once.
2. Each user's union of touched cells forms a coarse spatial signature. Only
   signatures shared by at least ten users contribute to the published map. This
   protects uncommon multi-cell combinations as well as isolated cells.
3. Each cell counts distinct users from those eligible groups. Overlapping zones
   belonging to one user never inflate its density. Counts are published in
   ten-wide bands; total zone/user bands include valid saved zones even when their
   spatial contribution is suppressed. No group memberships or signatures are
   published.
4. Empty and suppressed cells are indistinguishable: both have no published
   color. Never describe an uncolored cell as confirmed zero coverage.
5. The report/API contain no raw centers, radii, labels, IDs or individual records.
   The server validates the schema, fixed-grid coordinates and minimum band sizes.
   There are no geographic/category/source filters or alternate grid resolutions;
   zooming displays the same coarse cells.

This is conservative spatial suppression, not a claim of differential privacy or
protection against every auxiliary-data attack. Public snapshots can be copied
and compared over time. Review changes to grid resolution, thresholds, bands and
release cadence as changes to the privacy policy; never introduce raw details or
personalized subsets. If no signature can be published, the whole map is withheld.

## Changes, invalidation and concurrency

Interest create/update/delete and account deletion wrap database mutations with a
GCS revision update **before** writing. A generation-conditional write increments
the pending-mutation count and changes the revision; completion decrements it and
changes the revision again. Concurrent mutations use compare-and-swap retries.
Failure to invalidate blocks the mutation. Failure to complete invalidation leaves
the report unavailable; it must not silently restore an old snapshot.

Generation checks the revision before and after reading/aggregating and refuses
to publish across a mutation. The public endpoint reads the GCS revision before
and after downloading the report, rejects pending/mismatched revisions, and uses
`Cache-Control: no-store`. It never queries interests or aggregates on requests.
The page rechecks every minute and clears the displayed map on unavailable/error
responses. A source change makes the page unavailable until scheduled or manual
regeneration; generation is intentionally infrequent.

The web service account must be able to read report objects and write
`interests/revision.json` (the existing ingest service account has bucket-scoped
object admin). Keep the bucket private; public access is through the endpoint.
Maintenance scripts or external writes that bypass the web mutation wrapper must
invalidate the revision before modifying interests. If a crashed mutation leaves
`pending` nonzero, confirm that no mutation is running before an operator resets
the marker with a fresh revision and regenerates the report. Never delete the
marker to bypass checks.

## Interpreting a heartbeat with no matches

The timestamp says when **coverage** was sampled. It does not identify messages
eligible during the heartbeat's default 24-hour lookback. `/history` displays
historic finalized message locations and cannot establish recent eligibility.

Check notification pipeline logs and `message-fetcher.ts` / `match-processor.ts`
for: unprocessed status, expired `timespanEnd`, message creation after the zone
was created, geometry/city-wide matching, category/source preferences and
experimental-source opt-in. City-wide messages can match without local geometry.
Match creation and successful push delivery are separate; a user can have zones
without a registered push device. Coverage alone cannot establish pipeline health,
delivery success, or a shortage of eligible messages.
