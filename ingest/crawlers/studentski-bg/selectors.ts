/**
 * DOM selectors for studentski.bg crawler
 */
export const SELECTORS = {
  INDEX: {
    POST_CONTAINER: "article.blog-entry", // Container for each post card
    POST_LINK: "a.blog-entry-media-link, .blog-entry-title a", // Link to full article (media link or title link)
    POST_TITLE: ".blog-entry-title a", // Post title
    POST_DATE: ".meta-date time", // Date element with datetime attribute
  },
  POST: {
    TITLE: ".single-post-title, h1.blog-entry-title", // Post title on detail page
    DATE: ".meta-date time", // Post date with datetime attribute
    CONTENT: ".entry-content, .single-content", // Main content area
  },
} as const;
