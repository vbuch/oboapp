import type { Page } from "playwright";
import type { PostLink } from "./types";

/**
 * Extract post links from the index page
 */
export async function extractPostLinks(page: Page): Promise<PostLink[]> {
  console.log("📋 Extracting post links from index page...");

  const posts = await page.evaluate(() => {
    const postLinks: { url: string; title: string; date: string }[] = [];

    // Find all article elements or post containers
    // Based on WordPress structure, each post is likely in an article or div with specific class
    const articles = document.querySelectorAll("article, .post");

    articles.forEach((article) => {
      // Find the link to the post
      const linkEl = article.querySelector('a[href*="rayon-oborishte.bg"]');
      if (!linkEl) return;

      const url = (linkEl as HTMLAnchorElement).href;

      // Skip if it's not a full post URL (avoid category links, etc.)
      if (
        !url.includes(
          "/%d1%83%d0%b2%d0%b5%d0%b4%d0%be%d0%bc%d0%bb%d0%b5%d0%bd%d0%b8%d0%b5-"
        )
      ) {
        return;
      }

      // Extract title - try h2, h3, or the link text
      const titleEl = article.querySelector("h2, h3, .entry-title") || linkEl;
      const title = titleEl.textContent?.trim() || "";

      // Extract date - look for time element or date class
      const dateEl = article.querySelector(
        'time, .date, .published, [class*="date"]'
      );
      const date = dateEl?.textContent?.trim() || "";

      if (url && title) {
        postLinks.push({ url, title, date });
      }
    });

    return postLinks;
  });

  console.log(`📊 Found ${posts.length} posts on index page`);
  return posts;
}

/**
 * Extract post details from individual post page
 */
export async function extractPostDetails(
  page: Page
): Promise<{ title: string; dateText: string; contentHtml: string }> {
  const details = await page.evaluate(() => {
    // Extract title
    const titleEl = document.querySelector("h1, .entry-title, .post-title");
    const title = titleEl?.textContent?.trim() || "";

    // Extract date
    const dateEl = document.querySelector(
      'time, .date, .published, [class*="date"]'
    );
    const dateText = dateEl?.textContent?.trim() || "";

    // Extract main content
    // Try to find the main content area and get its HTML
    const contentEl = document.querySelector(
      ".entry-content, .post-content, article .entry-content"
    );

    let contentHtml = "";
    if (contentEl) {
      // Clone the element to avoid modifying the page
      const clone = contentEl.cloneNode(true) as HTMLElement;

      // Remove unwanted elements (navigation, share buttons, etc.)
      clone
        .querySelectorAll(
          "script, style, nav, .sharedaddy, .share-buttons, .navigation, .post-navigation"
        )
        .forEach((el) => el.remove());

      contentHtml = clone.innerHTML;
    }

    return {
      title,
      dateText,
      contentHtml,
    };
  });

  return details;
}
