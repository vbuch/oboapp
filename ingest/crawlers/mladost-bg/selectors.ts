/**
 * CSS selectors for scraping mladost.bg (Joomla-based site)
 */
export const SELECTORS = {
  // Index page selectors
  INDEX: {
    // Each article card on the listing page
    POST_CONTAINER: "article.blog-card",
    // Link to individual post (slug-based URLs)
    POST_LINK: 'a[href*="/planovi-remonti/"]',
    // Date on listing (format: DD Month YYYY in Bulgarian)
    POST_DATE: "time",
    // Title on listing
    POST_TITLE: "h3.blog-card__title",
  },

  // Individual post page selectors
  POST: {
    // Main content area
    CONTENT: "div.article-body",
    // Title
    TITLE: "h1.article-title",
    // Date on detail page
    DATE: "time",
  },
} as const;
