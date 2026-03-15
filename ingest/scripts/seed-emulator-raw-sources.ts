/**
 * Raw source document fixtures for testing the ingestion pipeline.
 *
 * These simulate what crawlers store in the `sources` collection:
 * - toplo-bg: precomputed GeoJSON, skips AI pipeline
 * - rayon-oborishte-bg: plain text, goes through full 3-step AI pipeline
 *
 * Two sources describe the same real-world heating disruption in the
 * Oborishte neighborhood, so event aggregation should match them.
 */

import type { Firestore } from "firebase-admin/firestore";
import { encodeDocumentId } from "@/crawlers/shared/firestore";

// A point on ul. Shishman 14-20 in Oborishte (lat 42.693, lng 23.331)
const SHARED_LOCATION = { lat: 42.693, lng: 23.331 };

const now = new Date();
const startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
const endDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

/**
 * Source 1: toplo-bg — precomputed GeoJSON, skips AI pipeline.
 * Simulates what the toplo-bg crawler stores after parsing toplo.bg HTML.
 */
const toploBgSource = {
  url: "https://toplo.bg/incidents/seed-test-001",
  deepLinkUrl: "",
  datePublished: startDate.toISOString(),
  title: "Авария на магистрален топлопровод на ул. Шишман",
  message: [
    "Авария на магистрален топлопровод на ул. Шишман",
    "",
    startDate.toLocaleDateString("bg-BG"),
    "ул. Шишман 14-20, район Оборище",
    "",
    `Очаквано възстановяване на ${endDate.toLocaleDateString("bg-BG")}`,
  ].join("\n"),
  markdownText: [
    "Авария на магистрален топлопровод на ул. Шишман",
    "",
    startDate.toLocaleDateString("bg-BG"),
    "ул. Шишман 14-20, район Оборище",
    "",
    `Очаквано възстановяване на ${endDate.toLocaleDateString("bg-BG")}`,
  ].join("\n"),
  sourceType: "toplo-bg",
  locality: "bg.sofia",
  crawledAt: new Date(),
  categories: ["heating"],
  isRelevant: true,
  timespanStart: startDate,
  timespanEnd: endDate,
  geoJson: JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [SHARED_LOCATION.lng, SHARED_LOCATION.lat],
        },
        properties: {},
      },
    ],
  }),
};

/**
 * Source 2: rayon-oborishte-bg — plain text, goes through 3-step AI pipeline.
 * Simulates what a WordPress crawler stores after scraping the Oborishte
 * municipality website.  The text describes the same heating disruption.
 */
const oborishteSource = {
  url: "https://rayon-oborishte.bg/уведомления/seed-test-heating-shishman",
  datePublished: new Date(startDate.getTime() + 3 * 60 * 60 * 1000).toISOString(), // few hours later
  title: "Уведомление за прекъсване на топлоподаването на ул. Шишман",
  message: [
    "## Уведомление за прекъсване на топлоподаването",
    "",
    `Уважаеми жители на район Оборище,`,
    "",
    `Уведомяваме ви, че поради авария на магистрален топлопровод на ул. Шишман в участъка от №14 до №20`,
    `ще бъде прекъснато топлоподаването в периода ${startDate.toLocaleDateString("bg-BG")} – ${endDate.toLocaleDateString("bg-BG")}.`,
    "",
    "Топлофикация София работи по отстраняване на аварията.",
    "",
    "За повече информация: тел. 0700 11 111",
  ].join("\n"),
  sourceType: "rayon-oborishte-bg",
  locality: "bg.sofia",
  crawledAt: new Date(),
  // No geoJson, no categories, no isRelevant — these come from the AI pipeline
};

export interface RawSourceFixture {
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly sourceType: string;
}

export const RAW_SOURCE_FIXTURES: readonly RawSourceFixture[] = [
  {
    id: encodeDocumentId(toploBgSource.url),
    data: toploBgSource as unknown as Record<string, unknown>,
    sourceType: "toplo-bg",
  },
  {
    id: encodeDocumentId(oborishteSource.url),
    data: oborishteSource as unknown as Record<string, unknown>,
    sourceType: "rayon-oborishte-bg",
  },
];

export async function seedRawSources(db: Firestore): Promise<void> {
  console.log("Creating raw source documents for pipeline testing...");

  for (const fixture of RAW_SOURCE_FIXTURES) {
    await db.collection("sources").doc(fixture.id).set(fixture.data);
    console.log(`  ✓ ${fixture.sourceType}: ${(fixture.data as { title: string }).title}`);
  }

  console.log(`✅ Created ${RAW_SOURCE_FIXTURES.length} raw source documents for ingestion pipeline testing\n`);
}
