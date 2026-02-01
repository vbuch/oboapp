import type { Firestore } from "firebase-admin/firestore";
import { faker } from "@faker-js/faker";
import { MESSAGE_CONFIGS, type MessageConfig } from "./seed-emulator-fixtures";
import {
  randomSofiaPoint,
  createPointGeoJson,
  createLineGeoJson,
  generateTimespan,
  generateLineStringPoints,
  type GeoJSONFeatureCollection,
  type Point,
} from "./seed-emulator-utils";

interface SourceData {
  readonly url: string;
  readonly title: string;
  readonly text: string;
  readonly createdAt: Date;
  readonly timespanStart: Date;
  readonly timespanEnd: Date;
}

interface MessageData {
  readonly sourceDocumentId: string;
  readonly text: string;
  readonly markdownText: string;
  readonly categories: readonly string[];
  readonly createdAt: Date;
  readonly finalizedAt: Date;
  readonly timespanStart: Date;
  readonly timespanEnd: Date;
  readonly geoJson: string;
}

function createSourceData(
  config: MessageConfig,
  index: number,
  timespan: { start: Date; end: Date },
): SourceData {
  return {
    url: `https://example.com/source/${index + 1}`,
    title: `${config.text} на ${config.street}`,
    text: `${config.text} на ${config.street} от ${timespan.start.toLocaleDateString("bg-BG")} до ${timespan.end.toLocaleDateString("bg-BG")}`,
    createdAt: new Date(),
    timespanStart: timespan.start,
    timespanEnd: timespan.end,
  };
}

function createMessageData(
  config: MessageConfig,
  sourceId: string,
  timespan: { start: Date; end: Date },
  geoJson: GeoJSONFeatureCollection,
): MessageData {
  return {
    sourceDocumentId: sourceId,
    text: `${config.text} на ${config.street}`,
    markdownText: `**${config.text}**\n\nЛокация: ${config.street}\n\nПериод: ${timespan.start.toLocaleDateString("bg-BG")} - ${timespan.end.toLocaleDateString("bg-BG")}`,
    categories: config.category,
    createdAt: new Date(),
    finalizedAt: new Date(),
    timespanStart: timespan.start,
    timespanEnd: timespan.end,
    geoJson: JSON.stringify(geoJson), // Firestore requires GeoJSON as string
  };
}

function createGeoJsonForMessage(config: MessageConfig): {
  geoJson: GeoJSONFeatureCollection;
  point: Point;
} {
  if (config.type === "point") {
    const point = randomSofiaPoint();
    const geoJson = createPointGeoJson(point.lat, point.lng);
    return { geoJson, point };
  } 
    // LineString with 3-5 points
    const numPoints = faker.number.int({ min: 3, max: 5 });
    const points = generateLineStringPoints(numPoints);
    const geoJson = createLineGeoJson(points);
    return { geoJson, point: points[0] };
  
}

export async function seedSourcesAndMessages(db: Firestore): Promise<void> {
  console.log("Creating sources and messages...");

  for (let i = 0; i < MESSAGE_CONFIGS.length; i++) {
    const config = MESSAGE_CONFIGS[i];
    const sourceId = `test-source-${i + 1}`;
    const messageId = `test-message-${i + 1}`;

    const timespan = generateTimespan(i);
    const sourceData = createSourceData(config, i, timespan);

    await db.collection("sources").doc(sourceId).set(sourceData);

    const { geoJson } = createGeoJsonForMessage(config);
    const messageData = createMessageData(config, sourceId, timespan, geoJson);

    await db.collection("messages").doc(messageId).set(messageData);
  }

  console.log(`✅ Created ${MESSAGE_CONFIGS.length} sources and messages\n`);
}
