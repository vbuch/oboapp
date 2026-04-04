import type { Page } from "playwright";
import type { PostLink } from "./types";
import { SELECTORS } from "./selectors";
import {
  extractPostLinks as extractPostLinksShared,
  extractPostDetailsGeneric,
} from "../shared/extractors";

export async function extractPostLinks(page: Page): Promise<PostLink[]> {
  return extractPostLinksShared(page, SELECTORS);
}

export async function extractPostDetails(
  page: Page,
): Promise<{ title: string; dateText: string; contentHtml: string }> {
  return extractPostDetailsGeneric(
    page,
    SELECTORS.POST,
    [
      "script",
      "style",
      "nav",
      "header",
      "footer",
      ".tribe-events-c-subscribe-dropdown",
      ".tribe-events-event-meta",
      ".sharedaddy",
    ],
    "#tribe-events-content",
  );
}
