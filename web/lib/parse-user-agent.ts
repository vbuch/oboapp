import { UAParser } from "ua-parser-js";

export interface ParsedUserAgent {
  browser: string;
  platform: string;
  displayName: string;
}

/**
 * Parse user agent string to extract browser and platform information
 * Uses ua-parser-js library for accurate parsing
 */
export function parseUserAgent(userAgent: string): ParsedUserAgent {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  // Extract browser name
  let browser = result.browser.name || "Unknown Browser";

  // Normalize browser names (ua-parser prefixes some mobile browsers with "Mobile")
  if (browser.startsWith("Mobile ") && !/Safari/i.test(browser)) {
    browser = browser.replace(/^Mobile\s+/i, "");
  }

  // Extract platform (OS + device type)
  let platform = "Unknown Platform";

  if (result.device.type === "mobile" || result.device.type === "tablet") {
    // Mobile/tablet device - show OS name
    platform = result.os.name || "Mobile";
  }
  if (
    result.os.name &&
    result.device.type !== "mobile" &&
    result.device.type !== "tablet"
  ) {
    // Desktop OS
    platform = result.os.name;
  }

  // Normalize macOS naming for consistency
  if (platform === "macOS") {
    platform = "Mac OS";
  }

  const displayName = `${browser} on ${platform}`;

  return {
    browser,
    platform,
    displayName,
  };
}
