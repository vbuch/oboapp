import type { Page } from "playwright";
import type { PostLink } from "./types";
import { SELECTORS } from "./selectors";
import {
  extractPostLinks as extractPostLinksShared,
  extractPostDetailsGeneric,
} from "../shared/extractors";

export async function extractPostLinks(page: Page): Promise<PostLink[]> {
  const posts = await extractPostLinksShared(page, SELECTORS, (url) => {
    let decodedUrl = "";

    try {
      decodedUrl = decodeURIComponent(url).toLowerCase();
    } catch {
      decodedUrl = url.toLowerCase();
    }

    // Keep all article links and let downstream AI stages decide relevance.
    return decodedUrl.includes("inspectorat-so.org") && decodedUrl.includes("newsid=");
  });

  // Preserve latest duplicate (same behavior as nadezhda crawler).
  return Array.from(new Map(posts.map((post) => [post.url, post])).values());
}

export async function extractPostDetails(
  page: Page,
): Promise<{ title: string; dateText: string; contentHtml: string }> {
  return extractPostDetailsGeneric(page, SELECTORS.POST, [
    "script",
    "style",
    "nav",
    "footer",
    ".breadcrumb",
    ".article-info",
  ]);
}
