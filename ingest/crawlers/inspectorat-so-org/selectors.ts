/**
 * CSS selectors for scraping inspectorat-so.org announcements.
 */
export const SELECTORS = {
  INDEX: {
    POST_CONTAINER: ".newsContent",
    POST_LINK: '.titleLink[href*="newsid="]',
    POST_DATE: ".dateCreated",
    POST_TITLE: "h2",
  },

  POST: {
    CONTENT: '[itemprop="articleBody"] > .col-md-12 > div[style*="font-size:14pt"]',
    TITLE: '[itemprop="articleBody"] > .col-md-12 > h2',
    DATE: '[itemprop="articleBody"] .dateCreated, [itemprop="datePublished"], time',
  },
} as const;
