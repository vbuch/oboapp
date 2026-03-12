/**
 * CSS selectors for scraping ilinden.sofia.bg
 */
export const SELECTORS = {
  INDEX: {
    POST_CONTAINER: "article, .post, .type-post",
    POST_LINK: 'a[href*="ilinden.sofia.bg/"]',
    POST_DATE: "time, .entry-date, .posted-on, [class*=\"date\"]",
    POST_TITLE: "h2, h3, .entry-title, [class*=\"title\"]",
  },

  POST: {
    CONTENT: "article, .entry-content, .post-content, main",
    TITLE: "h1, .entry-title, .post-title",
    DATE: "time, .entry-date, .posted-on, [class*=\"date\"]",
    MESSAGE: ".entry-content, .post-content, article p",
  },
} as const;
