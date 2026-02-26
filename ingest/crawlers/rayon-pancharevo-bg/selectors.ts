/**
 * CSS selectors for scraping pancharevo.org
 */
export const SELECTORS = {
  INDEX: {
    // Real structure: div.items-row > article.item with h2[itemprop='name'] and a.readM links
    POST_CONTAINER: "div.items-row article.item, article.item",
    POST_LINK: "a.readM, h2[itemprop='name'] a, a[itemprop='url']",
    // On index there is no dedicated date element; first content block contains date sentence
    POST_DATE: "div.col-md-9:not(.entry-header), .introtext, p",
    POST_TITLE: "h2[itemprop='name'], h2, h3, .entry-title, .post-title",
  },
  POST: {
    // Prefer item-page scoped content; then fallback to generic article body/main containers
    CONTENT: "article.item-page [itemprop='articleBody'], [itemprop='articleBody'], article.item-page, main",
    // Prefer item-page title first; then generic headings and common title classes
    TITLE: "article.item-page h2[itemprop='name'], h1, .entry-title, .post-title",
    // No explicit date node in post header; fallback extraction uses title/body text
    DATE: "article.item-page [itemprop='articleBody'] p:first-child, .article-info, time",
  },
} as const;
