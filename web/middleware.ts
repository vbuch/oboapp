import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware to add Content-Security-Policy headers for XSS protection.
 *
 * Security Strategy:
 * - Uses nonce-based CSP to prevent unauthorized script execution
 * - Each request gets a unique cryptographic nonce
 * - Scripts must include the nonce attribute to execute
 * - 'strict-dynamic' allows nonce-tagged scripts to load additional scripts
 *
 * Why 'strict-dynamic' with explicit domains:
 * The combination of 'nonce-${nonce}' + 'strict-dynamic' implements a modern CSP approach:
 * 1. Only scripts with the correct nonce can execute (blocks XSS)
 * 2. 'strict-dynamic' allows those trusted scripts to load additional scripts dynamically
 *    (e.g., Google Analytics can load gtag.js, Google Maps can load map tiles)
 * 3. In browsers supporting CSP3, explicit domains (googletagmanager.com, etc.) are
 *    ignored when 'strict-dynamic' is present - they're included for backwards compatibility
 *    with older browsers that don't support 'strict-dynamic'
 *
 * Domain allowlist rationale:
 * - googletagmanager.com: Google Analytics initial script
 * - *.googleapis.com: Google services (Maps API, Fonts API)
 * - maps.googleapis.com: Explicitly included for clarity (covered by wildcard)
 * - www.gstatic.com: Firebase service worker scripts (worker-src)
 * - lh3.googleusercontent.com: User profile pictures
 * - maps.gstatic.com: Google Maps static resources
 */
export function middleware(request: NextRequest) {
  // Generate a unique cryptographic nonce for each request (16 bytes = 128 bits)
  const nonce = Buffer.from(
    crypto.getRandomValues(new Uint8Array(16)),
  ).toString("base64");

  // Build Content-Security-Policy header
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com https://*.googleapis.com https://maps.googleapis.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob: https://lh3.googleusercontent.com https://maps.googleapis.com https://maps.gstatic.com;
    connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://maps.googleapis.com;
    worker-src 'self' https://www.gstatic.com;
    frame-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  // Clone the request headers and pass nonce to the layout
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Create response with CSP header
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - firebase-messaging-sw.js (service worker)
     */
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|firebase-messaging-sw.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
