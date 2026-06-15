/**
 * CSS selectors for sofia2018.bg events pages.
 */
export const SELECTORS = {
  INDEX: {
    POST_CONTAINER: ".tribe-events-calendar-list__event-row",
    POST_LINK: 'a[href*="/event/"]',
    POST_TITLE: ".tribe-events-calendar-list__event-title",
    POST_DATE:
      ".tribe-events-calendar-list__event-date-tag-datetime, .tribe-event-date-start",
  },
  POST: {
    TITLE: ".entry-header h1, h1",
    DATE: ".entry-date, time.published, .post-date",
    CONTENT: "article.post .entry-content",
  },
} as const;
