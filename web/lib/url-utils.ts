/**
 * Utility functions for URL manipulation
 */

/**
 * Extracts the hostname from a URL and removes common prefixes
 * @param url - The URL to extract hostname from
 * @returns The cleaned hostname, or original URL if parsing fails
 *
 * @example
 * extractHostname("https://www.example.com/path") // "example.com"
 * extractHostname("http://mladost.bg/long/path") // "mladost.bg"
 * extractHostname("invalid-url") // "invalid-url"
 */
export function extractHostname(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace("www.", "");
  } catch {
    return url;
  }
}
