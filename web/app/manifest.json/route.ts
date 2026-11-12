import { NextResponse } from "next/server";
import { peachColors } from "@/lib/colors";
import { APP_NAME, MANIFEST_ICONS, PWA_ICON_PATHS } from "@/lib/pwa-metadata";
import { getConfiguredLocalityDescription } from "@/lib/locality-metadata";

export async function GET() {
  const manifest = {
    name: APP_NAME,
    short_name: APP_NAME,
    description: getConfiguredLocalityDescription(),
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    theme_color: peachColors.panel,
    background_color: peachColors.background,
    lang: "bg",
    dir: "ltr",
    icons: [...MANIFEST_ICONS],
    categories: ["news", "utilities"],
    shortcuts: [
      {
        name: "Източници",
        short_name: "Източници",
        description: "Виж всички източници на информация",
        url: "/sources",
        icons: [
          {
            src: PWA_ICON_PATHS.icon192,
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
