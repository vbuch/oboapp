import { NextResponse } from "next/server";
import { getLocalityMetadata } from "@oboapp/shared";

/**
 * Dynamic web app manifest generation based on NEXT_PUBLIC_LOCALITY
 * Generates manifest.webmanifest with locality-specific metadata
 */
export async function GET() {
  const locality = process.env.NEXT_PUBLIC_LOCALITY;
  
  if (!locality) {
    throw new Error("NEXT_PUBLIC_LOCALITY environment variable is required");
  }

  const metadata = getLocalityMetadata(locality);
  
  const manifest = {
    name: "OboApp",
    short_name: "OboApp",
    description: metadata.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    theme_color: "#2c3e50",
    background_color: "#f8f9fa",
    lang: "bg",
    dir: "ltr",
    icons: [
      {
        src: "/icon-32x32.png",
        sizes: "32x32",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-72x72.png",
        sizes: "72x72",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    categories: ["news", "utilities"],
    shortcuts: [
      {
        name: "Източници",
        short_name: "Източници",
        description: "Виж всички източници на информация",
        url: "/sources",
        icons: [
          {
            src: "/icon-192x192.png",
            sizes: "192x192",
          },
        ],
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
