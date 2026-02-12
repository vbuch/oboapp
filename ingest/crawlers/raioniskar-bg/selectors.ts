/**
 * CSS selectors for scraping raioniskar.bg
 */
export const SELECTORS = {
  // Index page selectors
  INDEX: {
    // Each post card/article on the listing page (important messages section)
    POST_CONTAINER: '.articles.list.type-important_messages .article',
    // Link to individual post
    POST_LINK: 'h2.title a',
    // Date on listing
    POST_DATE: '.date-and-category',
    // Title on listing
    POST_TITLE: 'h2.title a',
  },

  // Individual post page selectors
  POST: {
    // Main content area
    CONTENT: '.articles.view',
    // Title
    TITLE: 'h1.title',
    // Date
    DATE: '.date-and-category',
  },
} as const;
