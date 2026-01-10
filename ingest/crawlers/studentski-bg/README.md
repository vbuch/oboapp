# Studentski-bg Crawler

Crawler for construction and maintenance schedule announcements from Studentski District Municipality (СО-район „Студентски").

## Source

- **Website:** https://studentski.bg/
- **Target Page:** https://studentski.bg/category/%d0%b3%d1%80%d0%b0%d1%84%d0%b8%d1%86%d0%b8/
- **Source Type:** `studentski-bg`
- **Data Type:** HTML/webpage-based (long ingestion flow)

## What it Crawls

This crawler fetches construction and maintenance schedules ("Графици за СМР") from the Studentski district website.

## How it Works

1. **Discovery Phase:**

   - Navigate to the category page using Playwright
   - Extract post cards from `article.blog-entry` containers
   - Parse post URL, title, and date from each card
   - Extract date from `datetime` attribute of `<time>` elements
   - **Only crawl first page** (no pagination)

2. **Extraction Phase:**

   - For each discovered post, navigate to detail page
   - Extract title from `.single-post-title` or `h1.blog-entry-title`
   - Extract date from `.meta-date time[datetime]` attribute
   - Extract content HTML from `.entry-content` or `.single-content`
   - Clean up unwanted elements (scripts, styles, navigation)

3. **Document Creation:**
   - Convert HTML to Markdown using shared `buildWebPageSourceDocument`
   - Generate stable document ID from URL (base64 encoding)
   - Check for duplicates via `isUrlProcessed`
   - Save to Firestore (skip if already processed)
   - Delay 2 seconds between requests

## Ingestion Flow

Since this crawler provides **HTML content** (no GeoJSON), it goes through the **full AI-powered pipeline** (see [messageIngest/README](../../messageIngest/README.md))
