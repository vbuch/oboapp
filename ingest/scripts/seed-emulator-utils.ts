import { faker } from "@faker-js/faker";
import { SOFIA_BOUNDS } from "@/lib/bounds";

export interface Point {
  readonly lat: number;
  readonly lng: number;
}

export interface GeoJSONFeature {
  readonly type: "Feature";
  readonly geometry: {
    readonly type: string;
    readonly coordinates: readonly number[] | readonly number[][];
  };
  readonly properties: Record<string, never>;
}

export interface GeoJSONFeatureCollection {
  readonly type: "FeatureCollection";
  readonly features: readonly GeoJSONFeature[];
}

// Helper to generate random point within Sofia
export function randomSofiaPoint(): Point {
  return {
    lat: faker.number.float({
      min: SOFIA_BOUNDS.south,
      max: SOFIA_BOUNDS.north,
      fractionDigits: 6,
    }),
    lng: faker.number.float({
      min: SOFIA_BOUNDS.west,
      max: SOFIA_BOUNDS.east,
      fractionDigits: 6,
    }),
  };
}

// Helper to create GeoJSON Point
export function createPointGeoJson(
  lat: number,
  lng: number,
): GeoJSONFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat], // GeoJSON is [lng, lat]
        },
        properties: {}, // Empty properties to avoid Firestore nested entity errors
      },
    ],
  };
}

// Helper to create GeoJSON LineString
export function createLineGeoJson(
  points: readonly Point[],
): GeoJSONFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: points.map((p) => [p.lng, p.lat]),
        },
        properties: {}, // Empty properties to avoid Firestore nested entity errors
      },
    ],
  };
}

export interface Timespan {
  readonly start: Date;
  readonly end: Date;
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

// Event type thresholds based on index
const CURRENT_EVENT_THRESHOLD = 6;
const FUTURE_EVENT_THRESHOLD = 15;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MILLIS_PER_DAY);
}

function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * MILLIS_PER_DAY);
}

function randomDays(min: number, max: number): number {
  return faker.number.int({ min, max });
}

function generateCurrentEventTimespan(now: Date): Timespan {
  // Started 1-2 days ago, ends in 1-5 days
  const daysAgo = randomDays(1, 2);
  const daysUntilEnd = randomDays(1, 5);
  return {
    start: subtractDays(now, daysAgo),
    end: addDays(now, daysUntilEnd),
  };
}

function generateFutureEventTimespan(now: Date): Timespan {
  // Starts in 1-2 days, lasts 1-3 days
  const daysUntilStart = randomDays(1, 2);
  const duration = randomDays(1, 3);
  const start = addDays(now, daysUntilStart);
  return {
    start,
    end: addDays(start, duration),
  };
}

function generatePastEventTimespan(now: Date): Timespan {
  // Ended 0-2 days ago, lasted 1-3 days
  const daysAgoEnded = randomDays(0, 2);
  const duration = randomDays(1, 3);
  const end = subtractDays(now, daysAgoEnded);
  return {
    start: subtractDays(end, duration),
    end,
  };
}

// Generate timespan based on index to ensure variety (current, future, past)
export function generateTimespan(index: number): Timespan {
  const now = new Date();

  if (index < CURRENT_EVENT_THRESHOLD) {
    return generateCurrentEventTimespan(now);
  }
  if (index < FUTURE_EVENT_THRESHOLD) {
    return generateFutureEventTimespan(now);
  }
  return generatePastEventTimespan(now);
}

// Generate LineString with random nearby points
export function generateLineStringPoints(numPoints: number): readonly Point[] {
  const points: Point[] = [];
  const startPoint = randomSofiaPoint();
  points.push(startPoint);

  for (let i = 1; i < numPoints; i++) {
    // Create nearby points (small offset)
    points.push({
      lat:
        startPoint.lat +
        faker.number.float({ min: -0.01, max: 0.01, fractionDigits: 6 }),
      lng:
        startPoint.lng +
        faker.number.float({ min: -0.01, max: 0.01, fractionDigits: 6 }),
    });
  }

  return points;
}
