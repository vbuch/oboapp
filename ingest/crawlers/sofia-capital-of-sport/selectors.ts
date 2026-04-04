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
    TITLE: ".tribe-events-single-event-title, h1.entry-title, h1",
    DATE: ".tribe-events-start-date, .tribe-events-schedule time, .tribe-events-schedule",
    CONTENT:
      ".tribe-events-single-event-description, .entry-content, .tribe-events-content",
  },
} as const;
