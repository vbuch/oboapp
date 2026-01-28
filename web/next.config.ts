import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  experimental: {
    externalDir: true,
  },
  outputFileTracingIncludes: {
    "/api/**/*": ["../shared/**/*"],
    "/lib/**/*": ["../shared/**/*"],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias["@shared"] = path.resolve(__dirname, "../shared");

    // Ensure shared files are included in the bundle
    if (isServer) {
      config.externals = config.externals || [];
      // Don't externalize shared modules
      if (Array.isArray(config.externals)) {
        config.externals = config.externals.filter(
          (external: any) =>
            typeof external !== "string" || !external.includes("@shared"),
        );
      }
    }

    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

const withMDX = createMDX({
  // Add markdown plugins here, as desired
});

export default withMDX(nextConfig);
