# Sredets collection

The crawler discovers posts through the RSS feeds for Новини, Съобщения,
Полезна информация, Инвестиционни намерения, and Обществени обсъждания.
Each category URL ends in `/feed/`; later pages use `?paged=2`, `?paged=3`, etc.

Live checks on 26 October 2026 confirmed RSS and Atom support. The feeds returned
one excerpt per page. The crawler therefore reads paginated RSS and fetches full
article content with the existing detail extractor. Feed URLs and publication
dates are preserved. Posts shared across categories are fetched once, and stored
URLs are skipped before opening article pages.

Requests are spaced by two seconds. Pagination stops at an empty feed, a
later-page HTTP 404, or a post at least 90 days old, matching ingestion's UTC
midnight cutoff. A repeated page or more than 100 pages in one category fails the
scan visibly. Other HTTP failures also propagate to the runner. Discovery must
complete before article collection starts.

Administrative notices enter the normal AI relevance filter. Category membership
alone does not establish relevance. The XML fixtures were captured from the
public category feeds on 26 October 2026; tests also cover multi-page discovery,
cross-category duplicates, age boundaries, and HTTP failures.

A read-only run of the updated discovery on 26 October 2026 found 12 recent posts.
The graffiti-cleaning notice was on page 8 of Съобщения. The existing detail
extractor successfully returned its full text, including the Slaveykov Square
address, and retained its original URL and publication date. This verified
collection without writing to a database or running AI ingestion.

## Deployment verification and historical records

Run the existing `sredec-sofia-org` job after deployment. Inspect collection and
ingestion logs, then confirm that a second scan skips stored URLs. The configured
full pipeline runs three times daily. This change keeps that schedule.

The issue's ten unprocessed documents belong to the `vbuch/oboapp` database.
Ingestion currently leaves age-excluded documents with `processed: false`.
The latest Полезна информация feed entry is dated 14 July 2025, so it is excluded
by the current age limit. The publication dates and historical execution logs of
the ten records still need read-only verification before assigning a root cause.

This change does not backfill or update existing database records. Before any
historical replay, inspect the records through `@oboapp/db`, identify which notices
are still useful, and prepare an explicit list of URLs and intended state changes.
Validate those records in isolated storage before applying an approved live replay.
The existing ingest `--dry-run` previews eligibility and does not execute AI stages
or demonstrate message creation.
