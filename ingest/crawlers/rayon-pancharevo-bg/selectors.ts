/**
 * CSS selectors for scraping pancharevo.org
 */
export const SELECTORS = {
  // Index page selectors
  INDEX: {
    // Each post card/article on the listing page
    POST_CONTAINER: 'article, .post, [class*="post"]',
    // Link to individual post
    POST_LINK: 'a[href*="pancharevo.org"]',
    // Date on listing
    POST_DATE: 'time, .date, [class*="date"]',
    // Title on listing
    POST_TITLE: 'h2, h3, .title, [class*="title"]',
  },

  // Individual post page selectors
  POST: {
    // Main content area
    CONTENT: "article, .entry-content, .post-content, main",
    // Post title
    TITLE: "h1, .entry-title, .post-title",
    // Post date
    DATE: 'time, .date, [class*="date"]',
  },
};
