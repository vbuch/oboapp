import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchPostLinksFromFeed,
  fetchPostDetailsFromHttp,
  parseSerdikaDate,
} from "./extractors";

// ---------------------------------------------------------------------------
// Helpers for building minimal ATOM feed responses
// ---------------------------------------------------------------------------
function atomFeed(entries: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<atom:feed xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/"
           xmlns:wplc="http://www.ibm.com/wplc/atom/1.0"
           xmlns:atom="http://www.w3.org/2005/Atom">
  <opensearch:totalResults exact="true">${entries ? "1" : "0"}</opensearch:totalResults>
  ${entries}
</atom:feed>`;
}

function atomEntry({
  title,
  contentPath,
  effectiveDateMs,
  linkHref,
  portalContextPath,
}: {
  title: string;
  contentPath: string;
  effectiveDateMs: number;
  linkHref?: string;
  portalContextPath?: string;
}): string {
  const detailHref = linkHref ?? `?urile=${encodeURIComponent(`wcm:path:${contentPath}`)}`;
  const contextPath = portalContextPath ?? "/wps/portal/serdika.egov.bg-15783";

  return `<atom:entry>
    <atom:title type="text/html">${title}</atom:title>
    <atom:link href="${detailHref}" type="text/html" />
    <wplc:field id="contentpath">${contentPath}</wplc:field>
    <wplc:field id="portalcontextpath">${contextPath}</wplc:field>
    <wplc:field id="effectivedate">${effectiveDateMs}</wplc:field>
  </atom:entry>`;
}
// ---------------------------------------------------------------------------
// fetchPostLinksFromFeed
// ---------------------------------------------------------------------------
describe("serdika-egov-bg/extractors", () => {
  describe("fetchPostLinksFromFeed", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    function mockFetch(xml: string) {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(xml),
      });
    }

    it("parses title, URL, and date from a valid ATOM entry", async () => {
      // 2025-04-08T00:00:00Z = 1744070400000 ms
      const ts = 1744070400000;
      mockFetch(atomFeed(atomEntry({ title: "Съобщение за ИУМПС", contentPath: "/content/site/actual/messages/msg1", effectiveDateMs: ts })));

      const links = await fetchPostLinksFromFeed("actualmessages");
      expect(links).toHaveLength(1);
      expect(links[0].url).toBe("https://serdika.egov.bg/wps/portal/serdika.egov.bg-15783?urile=wcm%3Apath%3A%2Fcontent%2Fsite%2Factual%2Fmessages%2Fmsg1");
      expect(links[0].title).toBe("Съобщение за ИУМПС");
      expect(links[0].date).toBe("08.04.2025"); // UTC date for 1744070400000
    });

    it("decodes XML entities in titles", async () => {
      mockFetch(atomFeed(atomEntry({ title: "Район &quot;Сердика&quot; &amp; Новини", contentPath: "/content/site/actual/messages/x", effectiveDateMs: 1744070400000 })));

      const links = await fetchPostLinksFromFeed("actualmessages");
      expect(links[0].title).toBe('Район "Сердика" & Новини');
    });

    it("skips entries whose contentpath does not start with /content/site/", async () => {
      mockFetch(atomFeed(atomEntry({ title: "Skip me", contentPath: "/wrong/path/msg1", effectiveDateMs: 1744070400000 })));

      const links = await fetchPostLinksFromFeed("actualmessages");
      expect(links).toHaveLength(0);
    });

    it("returns empty array when the feed contains no entries", async () => {
      mockFetch(atomFeed(""));

      const links = await fetchPostLinksFromFeed("actualmessages");
      expect(links).toHaveLength(0);
    });

    it("throws when the feed returns a non-OK HTTP status", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503 });

      await expect(fetchPostLinksFromFeed("actualmessages")).rejects.toThrow("503");
    });

    it("builds correct canonical URLs for news and events sections", async () => {
      const ts = 1744070400000;
      const newsXml = atomFeed(atomEntry({ title: "News 1", contentPath: "/content/site/actual/news/news1", effectiveDateMs: ts }));
      mockFetch(newsXml);
      const newsLinks = await fetchPostLinksFromFeed("actualnews");
      expect(newsLinks[0].url).toBe("https://serdika.egov.bg/wps/portal/serdika.egov.bg-15783?urile=wcm%3Apath%3A%2Fcontent%2Fsite%2Factual%2Fnews%2Fnews1");

      const eventsXml = atomFeed(atomEntry({ title: "Event 1", contentPath: "/content/site/actual/events/event1", effectiveDateMs: ts }));
      mockFetch(eventsXml);
      const eventLinks = await fetchPostLinksFromFeed("actualevents");
      expect(eventLinks[0].url).toBe("https://serdika.egov.bg/wps/portal/serdika.egov.bg-15783?urile=wcm%3Apath%3A%2Fcontent%2Fsite%2Factual%2Fevents%2Fevent1");
    });

    it("falls back to a canonical urile URL when the feed link is missing", async () => {
      const ts = 1744070400000;
      mockFetch(atomFeed(atomEntry({ title: "Fallback", contentPath: "/content/site/actual/news/news2", effectiveDateMs: ts, linkHref: "" })));

      const links = await fetchPostLinksFromFeed("actualnews");
      expect(links[0].url).toBe("https://serdika.egov.bg/wps/portal/serdika.egov.bg-15783?urile=wcm%3Apath%3A%2Fcontent%2Fsite%2Factual%2Fnews%2Fnews2");
    });

    it("retries transient feed fetch failures before succeeding", async () => {
      vi.useFakeTimers();

      const fetchMock = fetch as ReturnType<typeof vi.fn>;
      fetchMock
        .mockRejectedValueOnce(
          Object.assign(new TypeError("fetch failed"), {
            cause: { code: "ECONNRESET", message: "read ECONNRESET" },
          }),
        )
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(atomFeed(atomEntry({
            title: "Retry feed",
            contentPath: "/content/site/actual/messages/retry-feed",
            effectiveDateMs: 1744070400000,
          }))),
        });

      const linksPromise = fetchPostLinksFromFeed("actualmessages");
      await vi.runAllTimersAsync();
      const links = await linksPromise;

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(links[0].url).toContain("retry-feed");
    });
  });



  describe("fetchPostDetailsFromHttp", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("extracts title, date, and nested body HTML from detail pages", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <div class="content-wrapper">
            <h2>Съобщение за поставени стикери-предписания за преместване на ИУМПС</h2>
            <div id="publish-date">Дата на публикуване: 07.04.2026 Последна актуализация: 07.04.2026</div>
            <div id="body" class="card0">
              <div>
                <p>В изпълнение на чл. 46 от Наредба за управление на отпадъците...</p>
              </div>
              <script>window.ignore = true;</script>
            </div>
          </div>
        `),
      });

      const details = await fetchPostDetailsFromHttp("https://serdika.egov.bg/detail");

      expect(details.title).toContain("ИУМПС");
      expect(details.dateText).toContain("07.04.2026");
      expect(details.contentHtml).toContain("отпадъците");
      expect(details.contentHtml).not.toContain("window.ignore");
    });

    it("falls back to attachment links when the detail body is empty", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <div class="content-wrapper">
            <h2>Уведомление</h2>
            <div id="publish-date">Дата на публикуване: 07.04.2026</div>
            <div id="body" class="card0"></div>
          </div>
          <div class="card20 image-50">
            <img src="/wps/wcm/myconnect/site/documents/notice.png?MOD=AJPERES" />
          </div>
        `),
      });

      const details = await fetchPostDetailsFromHttp("https://serdika.egov.bg/detail");

      expect(details.contentHtml).toContain("прикачени файлове без текст в страницата");
      expect(details.contentHtml).toContain("notice.png");
      expect(details.contentHtml).toContain("https://serdika.egov.bg/wps/wcm/myconnect/site/documents/notice.png?MOD=AJPERES");
    });

    it("throws when the detail page request fails", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 });

      await expect(fetchPostDetailsFromHttp("https://serdika.egov.bg/detail")).rejects.toThrow("404");
    });

    it("retries transient network errors before succeeding", async () => {
      vi.useFakeTimers();

      const fetchMock = fetch as ReturnType<typeof vi.fn>;
      fetchMock
        .mockRejectedValueOnce(
          Object.assign(new TypeError("fetch failed"), {
            cause: { code: "ECONNRESET", message: "read ECONNRESET" },
          }),
        )
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(`
            <div class="content-wrapper">
              <h2>Retry success</h2>
              <div id="publish-date">Дата на публикуване: 07.04.2026</div>
              <div id="body"><p>Body after retry</p></div>
            </div>
          `),
        });

      const detailsPromise = fetchPostDetailsFromHttp("https://serdika.egov.bg/detail");
      await vi.runAllTimersAsync();
      const details = await detailsPromise;

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(details.title).toBe("Retry success");
      expect(details.contentHtml).toContain("Body after retry");
    });
  });

  describe("parseSerdikaDate", () => {
    it("should prefer 'Дата на публикуване' date for events with multiple labels", () => {
      const text =
        "Дата на събитие: 20.04.2026 Дата на публикуване: 07.04.2026 Последна актуализация: 07.04.2026";
      const iso = parseSerdikaDate(text);
      expect(iso).toContain("2026-04-07");
    });

    it("should extract publish date from messages/news format", () => {
      const text =
        "Дата на публикуване: 08.04.2026 Последна актуализация: 08.04.2026";
      const iso = parseSerdikaDate(text);
      expect(iso).toContain("2026-04-08");
    });

    it("should fall back to the first DD.MM.YYYY when no publish label", () => {
      const text = "Some header 15.03.2026 footer";
      const iso = parseSerdikaDate(text);
      expect(iso).toContain("2026-03-15");
    });
  });
});
