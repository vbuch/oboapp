import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  async headers() {
    return [
      // Service Worker CSP - Defense in depth for worker context
      {
        source: "/firebase-messaging-sw.js",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'none'; script-src 'self' https://www.gstatic.com; connect-src 'self' https://fcm.googleapis.com https://*.googleapis.com; worker-src 'self'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      // General security headers for all pages
      {
        source: "/(.*)",
        headers: [
          // Defense in depth: X-Frame-Options for older browsers that don't support CSP frame-ancestors
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Disable legacy XSS filter (can cause vulnerabilities, CSP is preferred)
          { key: "X-XSS-Protection", value: "0" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value:
              "geolocation=self, camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=self, vibrate=self, fullscreen=self",
          },
        ],
      },
    ];
  },
  transpilePackages: ["@oboapp/shared"],
  serverExternalPackages: ["lightningcss"],
  experimental: {
    externalDir: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  // Production optimizations
  compiler: {
    // Remove debug console logs in production, keep error/warn for monitoring
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },
};

const withMDX = createMDX({
  // Add markdown plugins here, as desired
});

export default withMDX(nextConfig);
