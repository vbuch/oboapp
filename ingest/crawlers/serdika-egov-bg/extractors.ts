import type { PostLink } from "./types";
import { stripHtmlTags } from "@oboapp/shared";
import { parseBulgarianDate } from "../shared/date-utils";
import { delay } from "@/lib/delay";
import { logger } from "@/lib/logger";

// IBM WebSphere Portal search feed — populated server-side, no JavaScript needed.
const SOURCE_TYPE = "serdika-egov-bg";
const SEARCH_FEED_BASE =
  "https://serdika.egov.bg/wps/contenthandler/searchfeed/search";
const SEARCH_SCOPE_ID = "1672924193550";
const SITE_HOST = "https://serdika.egov.bg";
const DEFAULT_PORTAL_CONTEXT_PATH = "/wps/portal/serdika.egov.bg-15783";
const WCM_CONTENT_PREFIX = "/content/site/";
const FEED_FETCH_TIMEOUT_MS = 30_000;
const FEED_FETCH_MAX_ATTEMPTS = 3;
const DETAIL_FETCH_TIMEOUT_MS = 45_000;
const DETAIL_FETCH_MAX_ATTEMPTS = 3;
const DETAIL_FETCH_RETRY_BASE_DELAY_MS = 1_000;
const DETAIL_FETCH_RETRY_MAX_DELAY_MS = 4_000;
const CONTENT_UNWANTED_TAGS = ["script", "style", "nav", "header"];
const ATTACHMENT_NOTE_TEXT =
  "Публикацията съдържа само прикачени файлове без текст в страницата.";

/**
 * Fetch the list of posts for one site section from the portal's ATOM search
 * feed — avoiding Playwright entirely for the listing page (the AJAX-rendered
 * `#search-results-container` is unreachable from Cloud Run IPs).
 *
 * @param sectionKeyword  e.g. "actualmessages", "actualnews", "actualevents"
 */
export async function fetchPostLinksFromFeed(
  sectionKeyword: string,
): Promise<PostLink[]> {
  const params = new URLSearchParams({
    queryLang: "en",
    locale: "bg",
    resultLang: "bg",
    start: "0",
    results: "20",
    scope: SEARCH_SCOPE_ID,
    query: "*",
    sortKey: "effectivedate",
    sortOrder: "desc",
  });
  // Two separate constraint params (URLSearchParams.append keeps both)
  params.append(
    "constraint",
    JSON.stringify({
      type: "field",
      id: "authoringtemplate",
      values: ["contentFromList"],
    }),
  );
  params.append(
    "constraint",
    JSON.stringify({ type: "field", id: "keywords", values: [sectionKeyword] }),
  );

  const feedUrl = `${SEARCH_FEED_BASE}?${params.toString()}`;
  const xml = await fetchFeedXmlWithRetry(feedUrl, sectionKeyword);

  // Parse ATOM entries with simple regex — the WCM feed has a fixed, machine-
  // generated structure so regex is sufficient here.
  const postLinks: PostLink[] = [];
  const entryRe = /<atom:entry>([\s\S]*?)<\/atom:entry>/g;
  let m: RegExpExecArray | null;

  while ((m = entryRe.exec(xml)) !== null) {
    const entryXml = m[1];

    const title = decodeHtmlEntities(
      /<atom:title[^>]*>([\s\S]*?)<\/atom:title>/.exec(entryXml)?.[1]
        ?.trim() ?? "",
    );
    const linkHref = decodeHtmlEntities(
      /<atom:link[^>]*href="([^"]+)"[^>]*type="text\/html"[^>]*\/?/i
        .exec(entryXml)
        ?.[1]
        ?.trim() ?? "",
    );
    const portalContextPath = decodeHtmlEntities(
      /<wplc:field id="portalcontextpath">([\s\S]*?)<\/wplc:field>/
        .exec(entryXml)
        ?.[1]
        ?.trim() ?? DEFAULT_PORTAL_CONTEXT_PATH,
    );

    // contentpath field: "/content/site/actual/messages/<slug>"
    const contentPath =
      /<wplc:field id="contentpath">([\s\S]*?)<\/wplc:field>/
        .exec(entryXml)
        ?.[1]
        ?.trim() ?? "";
    if (!contentPath.startsWith(WCM_CONTENT_PREFIX)) continue;

    const url = buildCanonicalDetailUrl(
      contentPath,
      linkHref,
      portalContextPath,
    );

    // effectivedate is a Unix timestamp in milliseconds
    const effectiveDateMs = Number(
      /<wplc:field id="effectivedate">(\d+)<\/wplc:field>/
        .exec(entryXml)
        ?.[1] ?? "0",
    );
    const date = effectiveDateMs
      ? formatDateDDMMYYYY(new Date(effectiveDateMs))
      : "";

    postLinks.push({ url, title, date });
  }

  return postLinks;
}

async function fetchFeedXmlWithRetry(
  feedUrl: string,
  sectionKeyword: string,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= FEED_FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchWithTimeout(feedUrl, FEED_FETCH_TIMEOUT_MS);
      if (!response.ok) {
        if (
          shouldRetryStatus(response.status) &&
          attempt < FEED_FETCH_MAX_ATTEMPTS
        ) {
          const waitMs = calculateRetryDelayMs(attempt);
          await response.body?.cancel?.().catch(() => undefined);
          logger.debug(
            "Retrying Serdika feed fetch after retryable HTTP status",
            {
              sourceType: SOURCE_TYPE,
              sectionKeyword,
              attempt,
              maxAttempts: FEED_FETCH_MAX_ATTEMPTS,
              status: response.status,
              waitMs,
            },
          );
          await delay(waitMs);
          continue;
        }

        throw new Error(
          `Search feed returned ${response.status} for keyword "${sectionKeyword}"`,
        );
      }

      const xml = await response.text();
      if (xml.includes("<atom:feed")) {
        return xml;
      }

      if (attempt === FEED_FETCH_MAX_ATTEMPTS) {
        throw new Error(
          `Unexpected response format (not an ATOM feed) for keyword "${sectionKeyword}"`,
        );
      }

      const waitMs = calculateRetryDelayMs(attempt);
      logger.debug("Retrying Serdika feed fetch after non-ATOM response", {
        sourceType: SOURCE_TYPE,
        sectionKeyword,
        attempt,
        maxAttempts: FEED_FETCH_MAX_ATTEMPTS,
        responseLength: xml.length,
        waitMs,
      });
      await delay(waitMs);
    } catch (error) {
      lastError = error;

      if (!shouldRetryError(error) || attempt === FEED_FETCH_MAX_ATTEMPTS) {
        throw error;
      }

      const waitMs = calculateRetryDelayMs(attempt);
      logger.debug(
        "Retrying Serdika feed fetch after transient network error",
        {
          sourceType: SOURCE_TYPE,
          sectionKeyword,
          attempt,
          maxAttempts: FEED_FETCH_MAX_ATTEMPTS,
          waitMs,
          error: getErrorMessage(error),
        },
      );
      await delay(waitMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchPostDetailsFromHttp(
  url: string,
): Promise<{ title: string; dateText: string; contentHtml: string }> {
  const response = await fetchWithRetry(url, {
    timeoutMs: DETAIL_FETCH_TIMEOUT_MS,
    maxAttempts: DETAIL_FETCH_MAX_ATTEMPTS,
  });
  if (!response.ok) {
    throw new Error(`Detail page returned ${response.status} for ${url}`);
  }

  const html = await response.text();
  return extractPostDetailsFromHtml(html, url);
}

function buildCanonicalDetailUrl(
  contentPath: string,
  linkHref: string,
  portalContextPath: string,
): string {
  const normalizedPortalContextPath =
    portalContextPath || DEFAULT_PORTAL_CONTEXT_PATH;

  if (linkHref.startsWith("http://") || linkHref.startsWith("https://")) {
    return linkHref;
  }

  if (linkHref.startsWith("?")) {
    return `${SITE_HOST}${normalizedPortalContextPath}${linkHref}`;
  }

  if (linkHref.startsWith("/")) {
    return `${SITE_HOST}${linkHref}`;
  }

  const uriPath = `wcm:path:${contentPath}`;
  return `${SITE_HOST}${normalizedPortalContextPath}?urile=${encodeURIComponent(uriPath)}`;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(
  url: string,
  options: { timeoutMs: number; maxAttempts: number },
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options.timeoutMs);
      if (
        !shouldRetryStatus(response.status) ||
        attempt === options.maxAttempts
      ) {
        return response;
      }

      const waitMs = calculateRetryDelayMs(attempt);
      await response.body?.cancel?.().catch(() => undefined);

      logger.debug(
        "Retrying Serdika detail fetch after retryable HTTP status",
        {
          sourceType: SOURCE_TYPE,
          url,
          attempt,
          maxAttempts: options.maxAttempts,
          status: response.status,
          waitMs,
        },
      );

      await delay(waitMs);
    } catch (error) {
      lastError = error;

      if (!shouldRetryError(error) || attempt === options.maxAttempts) {
        throw error;
      }

      const waitMs = calculateRetryDelayMs(attempt);
      logger.debug(
        "Retrying Serdika detail fetch after transient network error",
        {
          sourceType: SOURCE_TYPE,
          url,
          attempt,
          maxAttempts: options.maxAttempts,
          waitMs,
          error: getErrorMessage(error),
        },
      );

      await delay(waitMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function shouldRetryError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError") {
    return true;
  }

  const causeCode = getErrorCauseCode(error);
  if (
    causeCode &&
    [
      "ECONNRESET",
      "ETIMEDOUT",
      "UND_ERR_BODY_TIMEOUT",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_SOCKET",
    ].includes(causeCode)
  ) {
    return true;
  }

  return /ECONNRESET|ETIMEDOUT|timed out|fetch failed/i.test(
    getErrorMessage(error),
  );
}

function calculateRetryDelayMs(attempt: number): number {
  return Math.min(
    DETAIL_FETCH_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1),
    DETAIL_FETCH_RETRY_MAX_DELAY_MS,
  );
}

function hasCauseCode(val: unknown): val is { code: unknown } {
  return typeof val === "object" && val !== null && "code" in val;
}

function hasCauseMessage(val: unknown): val is { message: unknown } {
  return typeof val === "object" && val !== null && "message" in val;
}

function getErrorCauseCode(error: Error): string | null {
  if (!hasCauseCode(error.cause)) {
    return null;
  }
  return String(error.cause.code);
}

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  if (!hasCauseMessage(error.cause)) {
    return error.message;
  }
  return `${error.message}: ${String(error.cause.message)}`;
}

function extractPostDetailsFromHtml(
  html: string,
  url: string,
): { title: string; dateText: string; contentHtml: string } {
  const contentOuterHtml = extractElementOuterHtmlById(html, "div", "body");
  if (!contentOuterHtml) {
    throw new Error(`Failed to extract content from ${url}`);
  }

  const titleRegion =
    extractElementOuterHtmlByClass(html, "div", "content-wrapper") ?? html;
  const title = cleanText(
    extractFirstTagText(titleRegion, "h2") ??
      extractFirstTagText(html, "h2") ??
      "",
  );
  const dateText = cleanText(
    stripTags(
      stripOuterTag(
        extractElementOuterHtmlById(html, "div", "publish-date") ?? "",
        "div",
      ),
    ),
  );
  const contentHtml = removeUnwantedElements(
    stripOuterTag(contentOuterHtml, "div"),
    CONTENT_UNWANTED_TAGS,
  ).trim();

  if (cleanText(stripTags(contentHtml))) {
    return { title, dateText, contentHtml };
  }

  const attachmentFallbackHtml = extractAttachmentFallbackHtml(html);
  if (attachmentFallbackHtml) {
    return { title, dateText, contentHtml: attachmentFallbackHtml };
  }

  throw new Error(`Failed to extract content from ${url}`);
}

function formatDateDDMMYYYY(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function decodeHtmlEntities(s: string): string {
  return s.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      }

      if (entity.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      }

      const namedEntities: Record<string, string> = {
        amp: "&",
        apos: "'",
        bdquo: '"',
        gt: ">",
        hellip: "...",
        ldquo: '"',
        lsquo: "'",
        lt: "<",
        mdash: "-",
        nbsp: " ",
        ndash: "-",
        quot: '"',
        rdquo: '"',
        rsquo: "'",
      };

      return namedEntities[entity] ?? match;
    },
  );
}

function extractElementOuterHtmlById(
  html: string,
  tagName: string,
  id: string,
): string | null {
  const pattern = new RegExp(
    String.raw`<${tagName}\b[^>]*\bid=("|')${escapeRegExp(id)}\1[^>]*>`,
    "i",
  );
  const match = pattern.exec(html);
  return match ? extractBalancedElement(html, tagName, match) : null;
}

function extractElementOuterHtmlByClass(
  html: string,
  tagName: string,
  className: string,
): string | null {
  const pattern = new RegExp(
    String.raw`<${tagName}\b[^>]*\bclass=("|')[^"']*\b${escapeRegExp(className)}\b[^"']*\1[^>]*>`,
    "i",
  );
  const match = pattern.exec(html);
  return match ? extractBalancedElement(html, tagName, match) : null;
}

function extractBalancedElement(
  html: string,
  tagName: string,
  match: RegExpExecArray,
): string | null {
  const startIndex = match.index;
  const tokenRe = new RegExp(String.raw`<\/?${tagName}\b[^>]*>`, "gi");
  tokenRe.lastIndex = startIndex + match[0].length;

  let depth = 1;
  let tokenMatch: RegExpExecArray | null;

  while ((tokenMatch = tokenRe.exec(html)) !== null) {
    const token = tokenMatch[0];
    const isClosingTag = token.startsWith("</");
    const isSelfClosingTag = token.endsWith("/>");

    if (isClosingTag) {
      depth--;
    } else if (!isSelfClosingTag) {
      depth++;
    }

    if (depth === 0) {
      return html.slice(startIndex, tokenRe.lastIndex);
    }
  }

  return null;
}

function extractFirstTagText(html: string, tagName: string): string | null {
  const match = new RegExp(
    String.raw`<${tagName}\b[^>]*>([\s\S]*?)<\/${tagName}>`,
    "i",
  ).exec(html);
  return match ? stripTags(match[1]) : null;
}

function stripOuterTag(outerHtml: string, tagName: string): string {
  return outerHtml
    .replace(new RegExp(String.raw`^<${tagName}\b[^>]*>`, "i"), "")
    .replace(new RegExp(String.raw`<\/${tagName}>$`, "i"), "");
}

function removeUnwantedElements(html: string, tagNames: string[]): string {
  let cleaned = html;

  for (const tagName of tagNames) {
    cleaned = cleaned.replace(
      new RegExp(String.raw`<${tagName}\b[^>]*>[\s\S]*?<\/${tagName}>`, "gi"),
      "",
    );
    cleaned = cleaned.replace(new RegExp(String.raw`<${tagName}\b[^>]*/>`, "gi"), "");
  }

  return cleaned;
}

function extractAttachmentFallbackHtml(html: string): string {
  const candidateHtml = [
    extractElementOuterHtmlByClass(html, "div", "card20"),
    extractElementOuterHtmlByClass(html, "div", "image-gallery-wrapper"),
    extractElementOuterHtmlByClass(html, "ul", "galleryList"),
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");

  if (!candidateHtml) {
    return "";
  }

  const attachmentUrls = extractAttachmentUrls(candidateHtml);
  if (attachmentUrls.length === 0) {
    return "";
  }

  const linksHtml = attachmentUrls
    .map((attachmentUrl, index) => {
      const label = buildAttachmentLabel(attachmentUrl, index);
      return `<li><a href="${attachmentUrl}">${label}</a></li>`;
    })
    .join("");

  return `<p>${ATTACHMENT_NOTE_TEXT}</p><ul>${linksHtml}</ul>`;
}

function extractAttachmentUrls(html: string): string[] {
  const urls = new Set<string>();
  const attributeRe = /<(?:a|img)\b[^>]*(?:href|src)=(["'])([^"']+)\1[^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = attributeRe.exec(html)) !== null) {
    const normalizedUrl = normalizeUrl(match[2]);
    if (normalizedUrl) {
      urls.add(normalizedUrl);
    }
  }

  return [...urls];
}

function normalizeUrl(rawUrl: string): string | null {
  const decodedUrl = decodeHtmlEntities(rawUrl.trim());
  if (!decodedUrl || decodedUrl.startsWith("data:")) {
    return null;
  }

  try {
    return new URL(decodedUrl, SITE_HOST).toString();
  } catch {
    return null;
  }
}

function buildAttachmentLabel(url: string, index: number): string {
  const pathname = new URL(url).pathname;
  const rawName = pathname.split("/").pop() ?? "";
  const decodedName = decodeURIComponent(rawName).trim();
  return decodedName || `Прикачен файл ${index + 1}`;
}

function stripTags(html: string): string {
  return decodeHtmlEntities(stripHtmlTags(html, " "));
}

function cleanText(text: string): string {
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFirstBulgarianDate(text: string): string | null {
  const isDigit = (char: string) => char >= "0" && char <= "9";

  for (let i = 0; i <= text.length - 10; i++) {
    if (
      isDigit(text[i]) &&
      isDigit(text[i + 1]) &&
      text[i + 2] === "." &&
      isDigit(text[i + 3]) &&
      isDigit(text[i + 4]) &&
      text[i + 5] === "." &&
      isDigit(text[i + 6]) &&
      isDigit(text[i + 7]) &&
      isDigit(text[i + 8]) &&
      isDigit(text[i + 9])
    ) {
      return text.slice(i, i + 10);
    }
  }

  return null;
}

/**
 * Parse the `#publish-date` block on Serdika detail pages.
 *
 * The div bundles multiple labeled dates (e.g. for events: `Дата на събитие`,
 * `Дата на публикуване`, `Последна актуализация`). We prefer the publish date
 * if present, otherwise the first `DD.MM.YYYY` occurrence.
 */
export function parseSerdikaDate(dateText: string): string {
  const publishLabel = "дата на публикуване";
  const lowerDateText = dateText.toLowerCase();
  const publishLabelIndex = lowerDateText.indexOf(publishLabel);
  if (publishLabelIndex !== -1) {
    const afterLabel = dateText.slice(publishLabelIndex + publishLabel.length);
    const publishDate = findFirstBulgarianDate(afterLabel);
    if (publishDate) {
      return parseBulgarianDate(publishDate);
    }
  }

  const firstDate = findFirstBulgarianDate(dateText);
  if (firstDate) {
    return parseBulgarianDate(firstDate);
  }

  return parseBulgarianDate(dateText.trim());
}
