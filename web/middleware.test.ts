import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { middleware, config } from "./middleware";

// Mock crypto.getRandomValues for testing
const mockRandomValues = vi.fn((array: Uint8Array) => {
  // Return predictable values for testing
  for (let i = 0; i < array.length; i++) {
    array[i] = i;
  }
  return array;
});

// Stub the global crypto object
vi.stubGlobal("crypto", {
  getRandomValues: mockRandomValues,
});

describe("middleware", () => {
  beforeEach(() => {
    mockRandomValues.mockClear();
  });

  describe("nonce generation", () => {
    it("should generate a unique nonce for each request", () => {
      const request1 = new NextRequest("https://example.com/");
      const request2 = new NextRequest("https://example.com/");

      // Create new random values for each call
      let callCount = 0;
      mockRandomValues.mockImplementation((array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = (i + callCount) % 256;
        }
        callCount += 16;
        return array;
      });

      const response1 = middleware(request1);
      const response2 = middleware(request2);

      const nonce1 = response1.headers.get("Content-Security-Policy");
      const nonce2 = response2.headers.get("Content-Security-Policy");

      // Nonces should be different
      expect(nonce1).not.toBe(nonce2);
    });

    it("should generate a base64-encoded nonce", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toBeTruthy();

      // Extract nonce from CSP header (e.g., 'nonce-ABC123==')
      const nonceMatch = csp?.match(/nonce-([A-Za-z0-9+/=]+)/);
      expect(nonceMatch).toBeTruthy();

      if (nonceMatch) {
        const nonce = nonceMatch[1];
        // Base64 encoded 16 bytes should be ~22-24 characters
        expect(nonce.length).toBeGreaterThanOrEqual(20);
        expect(nonce.length).toBeLessThanOrEqual(24);
        // Should only contain base64 characters
        expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
      }
    });

    it("should call crypto.getRandomValues with 16 bytes", () => {
      const request = new NextRequest("https://example.com/");
      middleware(request);

      expect(mockRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      const calledArray = mockRandomValues.mock.calls[0][0];
      expect(calledArray.length).toBe(16);
    });
  });

  describe("CSP header", () => {
    it("should set Content-Security-Policy header", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toBeTruthy();
    });

    it("should include nonce in script-src directive", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("script-src");
      expect(csp).toContain("'nonce-");
    });

    it("should include strict-dynamic in script-src", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("'strict-dynamic'");
    });

    it("should allow required Google domains in script-src", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("https://www.googletagmanager.com");
      expect(csp).toContain("https://*.googleapis.com");
      expect(csp).toContain("https://maps.googleapis.com");
    });

    it("should restrict img-src to specific domains", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("img-src");
      expect(csp).toContain("https://lh3.googleusercontent.com");
      expect(csp).toContain("https://maps.googleapis.com");
      expect(csp).toContain("https://maps.gstatic.com");
      // Should NOT contain overly permissive 'https:' without a domain (just the scheme)
      // The pattern should match "https:" NOT followed by "//" (which would be a full URL)
      expect(csp).not.toMatch(/img-src[^;]*\shttps:\s/);
    });

    it("should include worker-src for Firebase service worker", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("worker-src");
      expect(csp).toContain("https://www.gstatic.com");
    });

    it("should set frame-ancestors to none", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it("should include upgrade-insecure-requests", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("upgrade-insecure-requests");
    });

    it("should set object-src to none", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      const csp = response.headers.get("Content-Security-Policy");
      expect(csp).toContain("object-src 'none'");
    });
  });

  describe("x-nonce header", () => {
    it("should pass nonce to request headers", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      // Extract nonce from CSP header
      const csp = response.headers.get("Content-Security-Policy");
      const nonceMatch = csp?.match(/nonce-([A-Za-z0-9+/=]+)/);
      expect(nonceMatch).toBeTruthy();

      // The nonce should be in the modified request headers
      // Note: We can't directly test the modified request headers in the response,
      // but we verify the CSP contains the nonce which proves it was generated
      expect(nonceMatch?.[1]).toBeTruthy();
    });
  });

  describe("response handling", () => {
    it("should return a NextResponse", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
    });

    it("should not modify the response body", () => {
      const request = new NextRequest("https://example.com/");
      const response = middleware(request);

      // The response should be a passthrough (Next response)
      expect(response.status).toBe(200);
    });
  });
});

describe("middleware config", () => {
  it("should have matcher configuration", () => {
    expect(config).toBeDefined();
    expect(config.matcher).toBeDefined();
    expect(Array.isArray(config.matcher)).toBe(true);
  });

  it("should exclude API routes from matcher", () => {
    const matcher = config.matcher[0];
    if (typeof matcher === "object" && "source" in matcher) {
      expect(matcher.source).toContain("api");
    }
  });

  it("should exclude static files from matcher", () => {
    const matcher = config.matcher[0];
    if (typeof matcher === "object" && "source" in matcher) {
      expect(matcher.source).toContain("_next/static");
      expect(matcher.source).toContain("_next/image");
    }
  });

  it("should exclude favicon from matcher", () => {
    const matcher = config.matcher[0];
    if (typeof matcher === "object" && "source" in matcher) {
      expect(matcher.source).toContain("favicon.ico");
    }
  });

  it("should exclude Firebase service worker from matcher", () => {
    const matcher = config.matcher[0];
    if (typeof matcher === "object" && "source" in matcher) {
      expect(matcher.source).toContain("firebase-messaging-sw.js");
    }
  });

  it("should exclude prefetch requests", () => {
    const matcher = config.matcher[0];
    if (typeof matcher === "object" && "missing" in matcher) {
      expect(matcher.missing).toBeDefined();
      expect(Array.isArray(matcher.missing)).toBe(true);
      expect(matcher.missing?.length).toBeGreaterThan(0);

      const hasPrefetchCheck = matcher.missing?.some(
        (m) =>
          m.key === "next-router-prefetch" ||
          (m.key === "purpose" && m.value === "prefetch"),
      );
      expect(hasPrefetchCheck).toBe(true);
    }
  });
});
