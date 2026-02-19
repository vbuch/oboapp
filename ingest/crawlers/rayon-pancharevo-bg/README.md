# Rayon Pancharevo Crawler

Crawls infrastructure and repair notifications from the Pancharevo municipal website: https://www.pancharevo.org/

## Overview

This crawler extracts posts about water, heating, electricity, and other infrastructure repairs and maintenance notifications from Pancharevo's official website.

## Architecture

- **Index Page:** Paginated list of posts with filtering for repair/infrastructure keywords
- **Detail Pages:** Individual post pages with title, date, and content
- **AI Pipeline:** Filter & Split → Categorize → Extract Locations
- **Database:** Firestore messages collection with geocoded locations

## Configuration

No additional configuration required. The crawler discovers selectors from `selectors.ts`.

## Running

```bash
pnpm crawl:rayon-pancharevo-bg
```

Or via the ingest pipeline:

```bash
pnpm ingest
```

## Testing

```bash
pnpm test rayon-pancharevo-bg
```
