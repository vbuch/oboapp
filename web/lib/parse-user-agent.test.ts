import { describe, it, expect } from "vitest";
import { parseUserAgent } from "./parse-user-agent";

const chromeDesktopUA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const safariIOSUA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const androidChromeUA =
  "Mozilla/5.0 (Linux; Android 12; Pixel 6 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36";

describe("parseUserAgent", () => {
  it("should parse desktop Chrome user agent", () => {
    const result = parseUserAgent(chromeDesktopUA);
    expect(result.browser).toBe("Chrome");
    expect(result.platform).toBe("Mac OS");
    expect(result.displayName).toBe("Chrome on Mac OS");
  });

  it("should use OS name for mobile Safari", () => {
    const result = parseUserAgent(safariIOSUA);
    expect(result.browser).toBe("Mobile Safari");
    expect(result.platform).toBe("iOS");
    expect(result.displayName).toBe("Mobile Safari on iOS");
  });

  it("should detect Android Chrome as mobile platform", () => {
    const result = parseUserAgent(androidChromeUA);
    expect(result.browser).toBe("Chrome");
    expect(result.platform).toBe("Android");
    expect(result.displayName).toBe("Chrome on Android");
  });

  it("should fallback to Unknown values when UA empty", () => {
    const result = parseUserAgent("");
    expect(result.browser).toBe("Unknown Browser");
    expect(result.platform).toBe("Unknown Platform");
    expect(result.displayName).toBe("Unknown Browser on Unknown Platform");
  });
});
