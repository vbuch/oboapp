# Historical source daily counts

`toplo-bg-2026-10-11-to-2026-11-09.json` contains recovered closing counts for
`toplo-bg` in `bg.sofia`. It is an import array with `sourceType`, `locality`,
`date`, `count`, and `observedAt` on every record.

OboApp owns this archive, its import process, and the ongoing stored history.
API consumers such as [Na Stud](https://github.com/vbuch/nastud) read that history
through the public API.

## Coverage

Recovered on 10 November 2026 from 1,049 retained crawler completion summaries:

- First daily record: 11 October 2026.
- Last daily record: 9 November 2026.
- Daily records: 30.
- Missing dates inside this period: none.

The source Cloud Logging `_Default` bucket has a 30-day retention period.
This coverage describes the available logs. Earlier crawler activity can have
expired from retention. Missing historical dates must remain unknown rather
than being filled with zero.

## Record selection

Each date is a calendar day in `Europe/Sofia`, including its daylight-saving
offset. The count is taken from the last successful `Crawl complete` summary
on that date. Runs with `failed: 0` take priority; all-failed runs are excluded.
Every recovered day had a summary with `failed: 0`, so no fallback to a
partially failed run was needed.

`observedAt` is the original completion-log time in UTC, at millisecond
precision. It remains separate from the Sofia calendar date. It records when
the crawler reported the count, rather than the time of this recovery.

## Provenance

These historical totals come from the previous crawler's parsed incident
listing. That parser validated geometry before reporting its total. The new
snapshot collector counts the complete verified source listing independently
of map geometry. Historical HTML was not retained for a separate recheck.

This archive was originally stored at `counter/data/historical-daily-counts.json`.
Its 30 records were retained unchanged when the frontend moved to its own
repository.

## Import and ongoing updates

These 30 records have already been imported into the production database.
The file remains an archive for a one-time import into a new database.
Run from `ingest/` with the target locality and database configuration loaded
from `ingest/.env.local`:

```sh
pnpm exec tsx source-daily-counts.ts --import data/source-daily-counts/toplo-bg-2026-10-11-to-2026-11-09.json
```

The importer validates every record before writing. Repeated imports update
the same source, locality, and date records.

Future nightly records use the latest successful source snapshot for each
completed Sofia day. The API returns those stored records alongside the
imported history, so future dates require no changes to this archive.
