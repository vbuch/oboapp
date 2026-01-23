import { describe, it, expect } from "vitest";
import { extractHostname } from "./url-utils";

describe("extractHostname", () => {
  it("should extract hostname from https URL", () => {
    expect(extractHostname("https://example.com/path")).toBe("example.com");
  });

  it("should extract hostname from http URL", () => {
    expect(extractHostname("http://example.com/path")).toBe("example.com");
  });

  it("should remove www prefix", () => {
    expect(extractHostname("https://www.example.com/path")).toBe("example.com");
  });

  it("should handle complex paths and query parameters", () => {
    expect(
      extractHostname(
        "https://mladost.bg/%d0%b2%d1%81%d0%b8%d1%87%d0%ba%d0%b8-%d0%bd%d0%be%d0%b2%d0%b8%d0%bd%d0%b8/%d0%b8%d0%bd%d1%84%d0%be%d1%80%d0%bc%d0%b0%d1%86%d0%b8%d1%8f?param=value",
      ),
    ).toBe("mladost.bg");
  });

  it("should handle URLs with ports", () => {
    expect(extractHostname("https://example.com:8080/path")).toBe(
      "example.com",
    );
  });

  it("should handle subdomains", () => {
    expect(extractHostname("https://api.example.com/path")).toBe(
      "api.example.com",
    );
  });

  it("should handle www subdomain with other subdomains", () => {
    expect(extractHostname("https://www.api.example.com/path")).toBe(
      "api.example.com",
    );
  });

  it("should return original string for invalid URLs", () => {
    expect(extractHostname("not-a-url")).toBe("not-a-url");
  });

  it("should return original string for empty string", () => {
    expect(extractHostname("")).toBe("");
  });

  it("should handle URLs without protocol", () => {
    expect(extractHostname("example.com/path")).toBe("example.com/path");
  });

  it("should handle real project URLs", () => {
    expect(extractHostname("https://rayon-oborishte.bg/category/news")).toBe(
      "rayon-oborishte.bg",
    );
    expect(extractHostname("https://www.sofiyskavoda.bg/water-status")).toBe(
      "sofiyskavoda.bg",
    );
    expect(extractHostname("https://so-slatina.org/2024/news")).toBe(
      "so-slatina.org",
    );
  });
});
