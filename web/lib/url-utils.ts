/**
 * Utility functions for URL manipulation
 */

import type { Message } from "./types";

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

/**
 * Creates a URL for a message, using slug if available, otherwise falls back to ID
 * @param message - The message object
 * @returns The URL path for the message
 *
 * @example
 * createMessageUrl({ id: "123", slug: "aB3xYz12" }) // "/?slug=aB3xYz12"
 * createMessageUrl({ id: "123" }) // "/?messageId=123"
 */
export function createMessageUrl(message: Message): string {
  if (message.slug) {
    return `/?slug=${message.slug}`;
  }
  return `/?messageId=${message.id}`;
}

/**
 * Creates a URL for a message from messageId and optional slug
 * @param messageId - The message ID
 * @param slug - Optional slug
 * @returns The URL path for the message
 *
 * @example
 * createMessageUrlFromId("123", "aB3xYz12") // "/?slug=aB3xYz12"
 * createMessageUrlFromId("123") // "/?messageId=123"
 */
export function createMessageUrlFromId(
  messageId: string,
  slug?: string,
): string {
  if (slug) {
    return `/?slug=${slug}`;
  }
  return `/?messageId=${messageId}`;
}
