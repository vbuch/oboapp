/**
 * CSS selectors for scraping so-slatina.org
 */
export const SELECTORS = {
  // Index page selectors
  INDEX: {
    // Each post card on the listing page (homepage uses .video-item class for articles)
    POST_CONTAINER: ".video-item",
    // Link to individual post
    POST_LINK: ".item-head h3 a",
    // Title on listing
    POST_TITLE: ".item-head h3 a",
    // Date on listing (not displayed on homepage, but required by interface)
    POST_DATE: ".item-date .post-date",
  },

  // Individual post page selectors
  POST: {
    // Main content area
    CONTENT: "#content article .item-content",
    // Title (appears in .blog-heading section)
    TITLE: ".blog-heading h1",
    // Date (format: DD/MM/YYYY HH:MM)
    DATE: ".item-date .post-date",
  },
} as const;
