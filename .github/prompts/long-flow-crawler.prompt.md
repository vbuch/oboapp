---
description: "Plan the implementation of a new crawler that uses the long ingestion flow."
agent: Plan
---

Plan the implementation of a new crawler (/ingest/crawlers). It should work similar to sofia-bg, rayon-oborishte-bg and mladost-bg since it does not provide ready geoJSON. This means that its output will go through the long ingestion flow.

Make sure to read the documentation for the long ingestion flow in ingest/messageIngest/README.md and ingest/README.md before creating the plan.

Additionally make sure to research the code of the existing long-flow crawlers to try and stick to DRY by extracting any common code into shared utility functions if needed.

Keep utility functions out of the main crawler code.
Write unit tets (in good isolation) for EVERY pure function.

Provide README.md documentation for the new crawler in ingest/crawlers/{new-crawler}/README.md. Keep the README concise but informative. Target audience is defined in the root README.md.

Ask me to save a copy of the HTML page that the crawler will work with so that you can analyze it while writing the plan.
Ask me to prepare a 200x200 logo image for the new source and to put it in /web/public/sources/{new-crawler}.png

Ask me as many clarifying questions as needed.
