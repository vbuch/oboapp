---
description: "Plan the implementation of a new crawler that uses the long ingestion flow."
agent: Plan
---

Plan the implementation of a new crawler (/ingest/crawlers). It should work similar to sofia-bg, rayon-oborishte-bg and mladost-bg since it does not provide ready GeoJSON. This means that its output will go through the long ingestion flow. The addition of a source requires changes in both /ingest (for adding the crawler and documentation) and /web (for adding the source logo and metadata).

## Research

Before starting to plan do an extensive research on existing code. Make sure to:

- read the documentation for the long ingestion flow in ingest/messageIngest/README.md and ingest/README.md
- research the code of the existing long-flow crawlers
- understand any relevant documentation about shared utilities used by the crawlers
- understand how data fetched by the crawler will be processed in the ingestion flow and reach the end user in /web

Ask me as many clarifying questions as needed.

## Reminders

Remind me to:

- save a copy of the HTML page(s) that the crawler will work with so that you can analyze it while writing the plan.
- prepare a 200x200 logo image for the new source and to put it in /web/public/sources/{new-crawler}.png
- confirm the crawler identifier (e.g. `sredec-sofia-org`)

## Code Quality

- Keep utility functions out of the main crawler code.
- Use shared utilities where possible.
- Follow existing code style and patterns.

## Testing

- We do not do integration testing
- We do not do end-to-end testing
- We do not do component testing
- We only do unit testing for pure or critical functions
- Unit test should be written in good isolation
- Unit tests are collocated with the code they test

## Documentation

Provide README.md documentation for the new crawler in ingest/crawlers/{new-crawler}/README.md. Keep the README concise but informative. Target audience is defined in the root README.md.
