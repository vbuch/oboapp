/**
 * CSS selectors for scraping lozenets.sofia.bg
 */
export const SELECTORS = {
  // Index page selectors
  INDEX: {
    // Each post card/article on the listing page
    POST_CONTAINER: "article.blog-entry",
    // Link to individual post
    POST_LINK: ".blog-entry-title a",
    // Date on listing
    POST_DATE: ".meta-date .updated",
    // Title on listing
    POST_TITLE: ".blog-entry-title",
  },

  // Individual post page selectors
  POST: {
    // Main content area
    CONTENT: ".single-blog-content.entry",
    // Title
    TITLE: ".single-post-title",
    // Date
    DATE: ".meta-date time",
  },
} as const;
