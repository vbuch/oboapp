import { beforeEach, describe, expect, it, vi } from "vitest";
import { crawl } from "./index";
import { parseInspectoratDate } from "./index";
import { extractPostDetails, extractPostLinks } from "./extractors";
import {
  crawlWordpressPage,
  processWordpressPost,
} from "../shared/webpage-crawlers";

vi.mock("./extractors", () => ({
  extractPostLinks: vi.fn(),
  extractPostDetails: vi.fn(),
}));

vi.mock("../shared/webpage-crawlers", () => ({
  crawlWordpressPage: vi.fn(),
  processWordpressPost: vi.fn(),
}));

describe("inspectorat-so-org/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("configures crawlWordpressPage with inspectorat settings", async () => {
    const mockedCrawlWordpressPage = vi.mocked(crawlWordpressPage);
    mockedCrawlWordpressPage.mockResolvedValueOnce();

    await crawl();

    expect(mockedCrawlWordpressPage).toHaveBeenCalledTimes(1);

    const [options] = mockedCrawlWordpressPage.mock.calls[0];

    expect(options.indexUrl).toBe(
      "https://inspectorat-so.org/%D0%BD%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8",
    );
    expect(options.sourceType).toBe("inspectorat-so-org");
    expect(options.delayBetweenRequests).toBe(2000);
    expect(options.extractPostLinks).toBe(extractPostLinks);
    expect(typeof options.processPost).toBe("function");
  });

  it("delegates post processing to processWordpressPost", async () => {
    const mockedCrawlWordpressPage = vi.mocked(crawlWordpressPage);
    const mockedProcessWordpressPost = vi.mocked(processWordpressPost);
    mockedCrawlWordpressPage.mockResolvedValueOnce();
    mockedProcessWordpressPost.mockResolvedValueOnce();

    await crawl();

    const [options] = mockedCrawlWordpressPage.mock.calls[0];

    const browser = {} as any;
    const db = {} as any;
    const postLink = {
      url: "https://inspectorat-so.org/%D0%BD%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8/?newsid=%D0%BC%D0%B8%D0%B5%D0%BD%D0%B5-%D0%BD%D0%B0-%D0%BF%D0%BE%D0%B4%D0%BB%D0%B5%D0%B7",
      title: "Миене на подлези",
      date: "06апр.",
    };

    await options.processPost(browser, postLink, db);

    expect(mockedProcessWordpressPost).toHaveBeenCalledTimes(1);
    expect(mockedProcessWordpressPost).toHaveBeenCalledWith(
      browser,
      postLink,
      db,
      "inspectorat-so-org",
      "bg.sofia",
      2000,
      extractPostDetails,
      expect.any(Function),
    );
  });

  it("propagates crawlWordpressPage errors", async () => {
    const mockedCrawlWordpressPage = vi.mocked(crawlWordpressPage);
    mockedCrawlWordpressPage.mockRejectedValueOnce(new Error("crawl failed"));

    await expect(crawl()).rejects.toThrow("crawl failed");
  });

  describe("parseInspectoratDate", () => {
    it("parses short month dates as previous year when they are too far in the future", () => {
      const referenceDate = new Date("2026-01-05T12:00:00+02:00");
      const iso = parseInspectoratDate("29 дек.", "", referenceDate);
      const parsed = new Date(iso);

      expect(parsed.getUTCFullYear()).toBe(2025);
      expect(parsed.getUTCMonth()).toBe(11);
      expect(parsed.getUTCDate()).toBe(28);
    });

    it("keeps short month dates in current year when near future threshold", () => {
      const referenceDate = new Date("2026-04-01T12:00:00+03:00");
      const iso = parseInspectoratDate("06 апр.", "", referenceDate);
      const parsed = new Date(iso);

      expect(parsed.getUTCFullYear()).toBe(2026);
      expect(parsed.getUTCMonth()).toBe(3);
      expect(parsed.getUTCDate()).toBe(5);
    });
  });
});
