import type { Page } from "playwright";
import type { PostLink } from "./types";
import { SELECTORS } from "./selectors";

/**
 * Extract post links from the index page (first page only)
 */
export async function extractPostLinks(page: Page): Promise<PostLink[]> {
  console.log("📋 Extracting post links from index page...");

  const posts = await page.evaluate((selectors) => {
    const postLinks: { url: string; title: string; date: string }[] = [];

    // Find all article containers
    const containers = document.querySelectorAll(
      selectors.INDEX.POST_CONTAINER
    );

    containers.forEach((container) => {
      // Find the link to the article
      const linkEl = container.querySelector(selectors.INDEX.POST_LINK);
      if (!linkEl) return;

      const url = (linkEl as HTMLAnchorElement).href;

      // Extract title
      const titleEl = container.querySelector(selectors.INDEX.POST_TITLE);
      const title = titleEl?.textContent?.trim() || "";

      // Extract date
      const dateEl = container.querySelector(selectors.INDEX.POST_DATE);
      const date = dateEl?.textContent?.trim() || "";

      if (url && title) {
        postLinks.push({ url, title, date });
      }
    });

    return postLinks;
  }, SELECTORS);

  console.log(`📊 Found ${posts.length} posts on index page`);
  return posts;
}

/**
 * Extract post details from individual post page
 */
export async function extractPostDetails(
  page: Page
): Promise<{ title: string; dateText: string; contentHtml: string }> {
  const details = await page.evaluate((selectors) => {
    // Extract title from first component-paragraph div
    // This contains the title text on sofia.bg article pages
    const componentParagraphs = document.querySelectorAll(
      ".component-paragraph"
    );
    let title = "";

    if (componentParagraphs.length > 0) {
      // First component-paragraph usually contains the title
      const firstParagraph = componentParagraphs[0] as HTMLElement;
      title = firstParagraph.textContent?.trim() || "";

      // If title is very long, it might include content, try to get just first line/paragraph
      const firstChild = firstParagraph.querySelector("p, div");
      if (
        firstChild?.textContent &&
        firstChild.textContent.length < title.length
      ) {
        title = firstChild.textContent.trim();
      }
    }

    // Fallback to h1 or other headings if component-paragraph approach fails
    if (!title) {
      const headingEl = document.querySelector("h1, h2, h3");
      title = headingEl?.textContent?.trim() || "";
    }

    // Extract date - look for date in footer or date elements
    const dateEl = document.querySelector(selectors.POST.DATE);
    const dateText = dateEl?.textContent?.trim() || "";

    // Extract main content - get all component-paragraph divs
    let contentHtml = "";
    if (componentParagraphs.length > 0) {
      // Create a container for all paragraphs
      const container = document.createElement("div");
      componentParagraphs.forEach((p) => {
        const clone = p.cloneNode(true) as HTMLElement;
        // Remove unwanted elements
        clone
          .querySelectorAll(
            "script, style, nav, .navigation, .share-buttons, .social-share"
          )
          .forEach((el) => el.remove());
        container.appendChild(clone);
      });
      contentHtml = container.innerHTML;
    } else {
      // Fallback: get main-content
      const mainContent = document.querySelector("#main-content");
      if (mainContent) {
        const clone = mainContent.cloneNode(true) as HTMLElement;
        clone
          .querySelectorAll(
            "script, style, nav, .navigation, .share-buttons, .social-share, header, footer"
          )
          .forEach((el) => el.remove());
        contentHtml = clone.innerHTML;
      }
    }

    return {
      title,
      dateText,
      contentHtml,
    };
  }, SELECTORS);

  return details;
}
