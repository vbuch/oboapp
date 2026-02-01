#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import type { Firestore } from "firebase-admin/firestore";
import {
  ArcGisFeature,
  ArcGisQueryResponse,
  LayerConfig,
  SofiyskaVodaSourceDocument,
} from "./types";
import {
  isUrlProcessed,
  saveSourceDocument as saveSourceDocumentShared,
} from "../shared/firestore";
import { buildSourceDocument } from "./builders";

// Load environment variables to match the rest of the crawlers
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const BASE_URL =
  "https://gispx.sofiyskavoda.bg/arcgis/rest/services/WSI_PUBLIC/InfoCenter_Public/MapServer";
const REQUEST_HEADERS = {
  referer: "https://gispx.sofiyskavoda.bg/WebApp.InfoCenter/?a=0&tab=0",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  dnt: "1",
};
const PAGE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 15000;
const DATE_FORMATTER = new Intl.DateTimeFormat("bg-BG", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Sofia",
});

const LAYERS: LayerConfig[] = [
  {
    id: 2,
    name: "Текущи спирания",
    titlePrefix: "Текущо спиране",
    where: "ACTIVESTATUS = 'In Progress'",
  },
  {
    id: 3,
    name: "Планирани спирания",
    titlePrefix: "Планирано спиране",
  },
];

interface CrawlSummary {
  saved: number;
  skipped: number;
  emptyLayers: number;
}

async function fetchLayerFeatures(
  layer: LayerConfig,
): Promise<ArcGisFeature[]> {
  let resultOffset = 0;
  const features: ArcGisFeature[] = [];

  while (true) {
    const params = new URLSearchParams({
      f: "json",
      where: layer.where ?? "1=1",
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      resultOffset: resultOffset.toString(),
      resultRecordCount: PAGE_SIZE.toString(),
      orderByFields: "START_ DESC",
    });

    const url = `${BASE_URL}/${layer.id}/query?${params.toString()}`;
    const payload = await callArcGis(url);

    if (payload.error) {
      throw new Error(
        `ArcGIS returned error for layer ${layer.id}: ${payload.error.message}`,
      );
    }

    const batch = payload.features ?? [];
    features.push(...batch);

    if (!payload.exceededTransferLimit || batch.length === 0) {
      break;
    }

    resultOffset += PAGE_SIZE;
  }

  return features;
}

async function callArcGis(url: string): Promise<ArcGisQueryResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `ArcGIS request failed (${response.status} ${response.statusText})`,
      );
    }

    return (await response.json()) as ArcGisQueryResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function saveSourceDocument(
  doc: SofiyskaVodaSourceDocument,
  adminDb: Firestore,
): Promise<void> {
  await saveSourceDocumentShared(doc, adminDb, {
    transformData: (d) => ({
      ...d,
      geoJson: JSON.stringify(d.geoJson),
      crawledAt: new Date(d.crawledAt),
    }),
    logSuccess: false,
  });
  console.log(`✅ Записано събитие: ${doc.title}`);
}

export async function crawl(): Promise<void> {
  console.log("🚰 Стартиране на crawler за Sofiyska Voda...\n");

  const summary: CrawlSummary = { saved: 0, skipped: 0, emptyLayers: 0 };
  const seenUrls = new Set<string>();
  const adminDb = await maybeInitFirestore();

  for (const layer of LAYERS) {
    const layerSummary = await processLayer(layer, seenUrls, adminDb);
    summary.saved += layerSummary.saved;
    summary.skipped += layerSummary.skipped;
    summary.emptyLayers += layerSummary.emptyLayers;
  }

  logSummary(summary);
}

async function maybeInitFirestore(): Promise<Firestore | null> {
  const firebase = await import("@/lib/firebase-admin");
  return firebase.adminDb;
}

async function processLayer(
  layer: LayerConfig,
  seenUrls: Set<string>,
  adminDb: Firestore | null,
): Promise<CrawlSummary> {
  console.log(`\n📡 Зареждане на слой ${layer.id} – ${layer.name}`);
  const features = await fetchLayerFeatures(layer);
  console.log(`   ➜ Получени записи: ${features.length}`);

  if (features.length === 0) {
    return { saved: 0, skipped: 0, emptyLayers: 1 };
  }

  const result: CrawlSummary = { saved: 0, skipped: 0, emptyLayers: 0 };

  for (const feature of features) {
    await handleFeature(feature, layer, seenUrls, adminDb, result);
  }

  return result;
}

async function handleFeature(
  feature: ArcGisFeature,
  layer: LayerConfig,
  seenUrls: Set<string>,
  adminDb: Firestore | null,
  summary: CrawlSummary,
): Promise<void> {
  const document = await buildSourceDocument(feature, layer, DATE_FORMATTER);
  if (!document) {
    return;
  }

  if (seenUrls.has(document.url)) {
    return;
  }
  seenUrls.add(document.url);

  if (!adminDb) {
    throw new Error("Firestore is not initialized");
  }

  const exists = await isUrlProcessed(document.url, adminDb);
  if (exists) {
    summary.skipped += 1;
    return;
  }

  await saveSourceDocument(document, adminDb);
  summary.saved += 1;
}

function logSummary(summary: CrawlSummary): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 Резюме на обработката");
  console.log(`✅ Нови записи: ${summary.saved}`);
  console.log(`ℹ️ Празни слоеве: ${summary.emptyLayers}`);
  console.log("=".repeat(60));
}

// Run only when executed directly
if (require.main === module) {
  crawl().catch((error) => {
    console.error("❌ Софийска вода crawler се провали:", error);
    process.exit(1);
  });
}
