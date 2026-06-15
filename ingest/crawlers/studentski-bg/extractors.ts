import type { Page } from "playwright";
import {
  parseRssFeedItems,
  stripWordPressFeedAttribution,
} from "../shared/rss";
import type { RssFeedItem } from "../shared/rss";
import { SELECTORS } from "./selectors";

const SOURCE_HOSTNAME = "studentski.bg";

export function extractFeedItems(xml: string): RssFeedItem[] {
  return parseRssFeedItems(xml, {
    hostname: SOURCE_HOSTNAME,
    contentTransform: stripWordPressFeedAttribution,
  });
}

export async function extractPostDetails(page: Page): Promise<{
  title: string;
  dateText: string;
  contentHtml: string;
}> {
  const details = await page.evaluate((selectors) => {
    const titleEl = document.querySelector(selectors.POST.TITLE);
    const title = titleEl?.textContent?.trim() || "";

    const dateEl = document.querySelector(selectors.POST.DATE);
    const dateText = dateEl?.textContent?.trim() || "";

    const contentEl = document.querySelector(selectors.POST.CONTENT);
    let contentHtml = "";

    if (contentEl) {
      const clone = contentEl.cloneNode(true);
      if (!(clone instanceof HTMLElement))
        return { title: "", dateText: "", contentHtml: "" };

      clone
        .querySelectorAll("script, style, nav, .comments, .sharedaddy")
        .forEach((el) => el.remove());

      contentHtml = clone.innerHTML;
    }

    return { title, dateText, contentHtml };
  }, SELECTORS);

  return details;
}
