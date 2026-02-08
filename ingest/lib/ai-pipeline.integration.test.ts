import { describe, it, expect, afterEach } from "vitest";
import dotenv from "dotenv";
import { resolve, join } from "node:path";
import { readFileSync } from "node:fs";
import type { IngestErrorRecorder } from "./ingest-errors";

// Load env vars before anything else (AGENTS.md pattern)
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const HAS_API_KEY = Boolean(process.env.GOOGLE_AI_API_KEY);

function readSourceFixture(name: string): string {
  return readFileSync(
    join(__dirname, "../__mocks__/fixtures/sources", name),
    "utf-8",
  );
}

function createMockRecorder(): IngestErrorRecorder & { errors: string[] } {
  const errors: string[] = [];
  return {
    errors,
    warn: () => {},
    error: (msg: string) => errors.push(msg),
    exception: (msg: string) => errors.push(msg),
  };
}

/**
 * Adds a small delay between tests to be respectful to the Gemini API.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe.skipIf(!HAS_API_KEY)(
  "AI Pipeline Integration (live Gemini API)",
  () => {
    afterEach(async () => {
      await delay(500);
    });

    // ─── Test 1: Irrelevant message ──────────────────────────────────
    describe("irrelevant-message.md", () => {
      it("should detect the job posting as irrelevant and not proceed further", async () => {
        const { filterAndSplit } = await import("./ai-service");
        const text = readSourceFixture("irrelevant-message.md");
        const recorder = createMockRecorder();

        const result = await filterAndSplit(text, recorder);

        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(Array);
        expect(result!.length).toBe(1);

        const msg = result![0];
        expect(msg.isRelevant).toBe(false);
        expect(msg.normalizedText).toBeTruthy();

        // Pipeline should stop here — no categorize or extractLocations
        expect(recorder.errors).toHaveLength(0);
      });
    });

    // ─── Test 2: Simple single message (parking for football) ────────
    describe("single-simple-message.md", () => {
      let normalizedText: string;

      it("filterAndSplit: should produce 1 relevant message", async () => {
        const { filterAndSplit } = await import("./ai-service");
        const text = readSourceFixture("single-simple-message.md");
        const recorder = createMockRecorder();

        const result = await filterAndSplit(text, recorder);

        expect(result).not.toBeNull();
        expect(result!.length).toBe(1);
        expect(result![0].isRelevant).toBe(true);
        expect(result![0].normalizedText).toBeTruthy();
        expect(result![0].markdown_text).toBeTruthy();
        expect(recorder.errors).toHaveLength(0);

        normalizedText = result![0].normalizedText;
      });

      it("categorize: should assign parking/traffic/sports categories", async () => {
        const { categorize } = await import("./ai-service");
        expect(normalizedText).toBeTruthy();
        const recorder = createMockRecorder();

        const result = await categorize(normalizedText, recorder);

        expect(result).not.toBeNull();
        expect(result!.categories).toBeInstanceOf(Array);
        expect(result!.categories.length).toBeGreaterThanOrEqual(1);

        // Should include at least one relevant category
        const relevantCategories = [
          "parking",
          "traffic",
          "sports",
          "road-block",
        ];
        const hasRelevant = result!.categories.some((c) =>
          relevantCategories.includes(c),
        );
        expect(hasRelevant).toBe(true);
        expect(recorder.errors).toHaveLength(0);
      });

      it("extractLocations: should extract stadium location with timespans", async () => {
        const { extractLocations } = await import("./ai-service");
        expect(normalizedText).toBeTruthy();
        const recorder = createMockRecorder();

        const result = await extractLocations(normalizedText, recorder);

        expect(result).not.toBeNull();
        expect(result!.withSpecificAddress).toBe(true);
        expect(result!.cityWide).toBe(false);

        // Should have at least one pin or street referencing the stadium area
        const allAddresses = [
          ...result!.pins.map((p) => p.address),
          ...result!.streets.map((s) => s.street),
        ];
        expect(allAddresses.length).toBeGreaterThanOrEqual(1);

        // At least one address should reference the stadium or related area
        const addressText = allAddresses.join(" ").toLowerCase();
        const hasStadiumRef =
          addressText.includes("левски") ||
          addressText.includes("стадион") ||
          addressText.includes("паркинг");
        expect(hasStadiumRef).toBe(true);

        // Verify timespans are present and reference 2026
        const allTimespans = [
          ...result!.pins.flatMap((p) => p.timespans),
          ...result!.streets.flatMap((s) => s.timespans),
        ];
        expect(allTimespans.length).toBeGreaterThanOrEqual(1);
        const timespanText = JSON.stringify(allTimespans);
        expect(timespanText).toContain("2026");

        expect(recorder.errors).toHaveLength(0);
      });
    });

    // ─── Test 3: Multiple street locations (sidewalk repairs) ────────
    describe("single-message-multiple-locations.md", () => {
      let normalizedText: string;

      it("filterAndSplit: should produce 1 relevant message", async () => {
        const { filterAndSplit } = await import("./ai-service");
        const text = readSourceFixture("single-message-multiple-locations.md");
        const recorder = createMockRecorder();

        const result = await filterAndSplit(text, recorder);

        expect(result).not.toBeNull();
        expect(result!.length).toBe(1);
        expect(result![0].isRelevant).toBe(true);
        expect(result![0].normalizedText).toBeTruthy();
        expect(recorder.errors).toHaveLength(0);

        normalizedText = result![0].normalizedText;
      });

      it("categorize: should assign construction-and-repairs", async () => {
        const { categorize } = await import("./ai-service");
        expect(normalizedText).toBeTruthy();
        const recorder = createMockRecorder();

        const result = await categorize(normalizedText, recorder);

        expect(result).not.toBeNull();
        expect(result!.categories).toContain("construction-and-repairs");
        expect(recorder.errors).toHaveLength(0);
      });

      it("extractLocations: should extract multiple street sections on Oborishte", async () => {
        const { extractLocations } = await import("./ai-service");
        expect(normalizedText).toBeTruthy();
        const recorder = createMockRecorder();

        const result = await extractLocations(normalizedText, recorder);

        expect(result).not.toBeNull();
        expect(result!.withSpecificAddress).toBe(true);

        // Should have multiple street sections (5 sidewalk segments)
        expect(result!.streets.length).toBeGreaterThanOrEqual(2);

        // Streets should reference "Оборище"
        const streetsWithOborishte = result!.streets.filter(
          (s) => s.street.includes("Оборище") || s.street.includes("Оборищe"),
        );
        expect(streetsWithOborishte.length).toBeGreaterThanOrEqual(2);

        // The source has explicit coordinates (42.693576, 23.35161)
        // AI may extract these as pre-resolved coordinates on pins
        const allPinCoords = result!.pins
          .filter((p) => p.coordinates)
          .map((p) => p.coordinates!);
        const allStreetCoords = result!.streets
          .filter((s) => s.fromCoordinates || s.toCoordinates)
          .flatMap((s) => [s.fromCoordinates, s.toCoordinates].filter(Boolean));
        const allCoords = [...allPinCoords, ...allStreetCoords];

        if (allCoords.length > 0) {
          // If coordinates were extracted, they should be near the known location
          const hasNearbyCoord = allCoords.some(
            (c) =>
              c!.lat > 42.69 &&
              c!.lat < 42.7 &&
              c!.lng > 23.35 &&
              c!.lng < 23.36,
          );
          expect(hasNearbyCoord).toBe(true);
        }

        // Timespans should reference the repair period (Feb-Mar 2026)
        const allTimespans = result!.streets.flatMap((s) => s.timespans);
        expect(allTimespans.length).toBeGreaterThanOrEqual(1);
        const timespanText = JSON.stringify(allTimespans);
        expect(timespanText).toContain("2026");

        expect(recorder.errors).toHaveLength(0);
      });
    });

    // ─── Test 4: Multiple timespans (film shooting) ──────────────────
    describe("single-message-mutiple-timespans.md", () => {
      let normalizedTexts: string[] = [];

      it("filterAndSplit: should produce relevant message(s)", async () => {
        const { filterAndSplit } = await import("./ai-service");
        const text = readSourceFixture("single-message-mutiple-timespans.md");
        const recorder = createMockRecorder();

        const result = await filterAndSplit(text, recorder);

        expect(result).not.toBeNull();
        expect(result!.length).toBeGreaterThanOrEqual(1);

        for (const msg of result!) {
          expect(msg.isRelevant).toBe(true);
          expect(msg.normalizedText).toBeTruthy();
        }
        expect(recorder.errors).toHaveLength(0);

        normalizedTexts = result!.map((m) => m.normalizedText);
      });

      it("categorize: should assign parking or traffic categories", async () => {
        const { categorize } = await import("./ai-service");
        expect(normalizedTexts.length).toBeGreaterThanOrEqual(1);

        for (const text of normalizedTexts) {
          const recorder = createMockRecorder();
          const result = await categorize(text, recorder);

          expect(result).not.toBeNull();
          expect(result!.categories.length).toBeGreaterThanOrEqual(1);

          const relevantCategories = ["parking", "traffic", "road-block"];
          const hasRelevant = result!.categories.some((c) =>
            relevantCategories.includes(c),
          );
          expect(hasRelevant).toBe(true);
          expect(recorder.errors).toHaveLength(0);
        }
      });

      it("extractLocations: should extract 2 streets with different timespans", async () => {
        const { extractLocations } = await import("./ai-service");
        expect(normalizedTexts.length).toBeGreaterThanOrEqual(1);

        // Collect all extracted locations from all messages
        const allStreets: Array<{ street: string; timespans: unknown[] }> = [];
        const allPins: Array<{ address: string; timespans: unknown[] }> = [];

        for (const text of normalizedTexts) {
          const recorder = createMockRecorder();
          const result = await extractLocations(text, recorder);

          expect(result).not.toBeNull();
          expect(result!.withSpecificAddress).toBe(true);

          allStreets.push(...result!.streets);
          allPins.push(...result!.pins);
          expect(recorder.errors).toHaveLength(0);
        }

        const allLocations = [
          ...allStreets.map((s) => s.street),
          ...allPins.map((p) => p.address),
        ];
        const locationText = allLocations.join(" ");

        // Should reference both streets from the fixture
        const hasSeptemvri =
          locationText.includes("6 септември") ||
          locationText.includes("Септември") ||
          locationText.includes("септември");
        const hasChehov =
          locationText.includes("Чехов") || locationText.includes("чехов");

        expect(hasSeptemvri).toBe(true);
        expect(hasChehov).toBe(true);

        // Timespans should cover both dates
        const allTimespans = [
          ...allStreets.flatMap((s) => s.timespans),
          ...allPins.flatMap((p) => p.timespans),
        ];
        const timespanText = JSON.stringify(allTimespans);
        expect(timespanText).toContain("02.02.2026");
        expect(timespanText).toContain("03.02.2026");
      });
    });

    // ─── Test 5: Complex message (bus rerouting, street closure) ─────
    describe("complex-single-message.md", () => {
      let normalizedTexts: string[] = [];

      it("filterAndSplit: should produce relevant message(s)", async () => {
        const { filterAndSplit } = await import("./ai-service");
        const text = readSourceFixture("complex-single-message.md");
        const recorder = createMockRecorder();

        const result = await filterAndSplit(text, recorder);

        expect(result).not.toBeNull();
        expect(result!.length).toBeGreaterThanOrEqual(1);

        for (const msg of result!) {
          expect(msg.isRelevant).toBe(true);
          expect(msg.normalizedText).toBeTruthy();
        }
        expect(recorder.errors).toHaveLength(0);

        normalizedTexts = result!.map((m) => m.normalizedText);
      });

      it("categorize: should assign traffic/public-transport/road-block categories", async () => {
        const { categorize } = await import("./ai-service");
        expect(normalizedTexts.length).toBeGreaterThanOrEqual(1);

        const allCategories: string[] = [];

        for (const text of normalizedTexts) {
          const recorder = createMockRecorder();
          const result = await categorize(text, recorder);

          expect(result).not.toBeNull();
          expect(result!.categories.length).toBeGreaterThanOrEqual(1);
          allCategories.push(...result!.categories);
          expect(recorder.errors).toHaveLength(0);
        }

        // Across all messages, should include at least one transport-related category
        const relevantCategories = [
          "traffic",
          "road-block",
          "public-transport",
        ];
        const hasRelevant = allCategories.some((c) =>
          relevantCategories.includes(c),
        );
        expect(hasRelevant).toBe(true);
      });

      it("extractLocations: should extract bus stops, streets, and Iskarska reference", async () => {
        const { extractLocations } = await import("./ai-service");
        expect(normalizedTexts.length).toBeGreaterThanOrEqual(1);

        const allBusStops: string[] = [];
        const allStreets: string[] = [];
        const allPinsAddresses: string[] = [];

        for (const text of normalizedTexts) {
          const recorder = createMockRecorder();
          const result = await extractLocations(text, recorder);

          expect(result).not.toBeNull();
          allBusStops.push(...result!.busStops);
          allStreets.push(...result!.streets.map((s) => s.street));
          allPinsAddresses.push(...result!.pins.map((p) => p.address));
          expect(recorder.errors).toHaveLength(0);
        }

        // Should extract bus stop codes from the fixture
        const expectedBusStopCodes = ["1956", "1531", "2500", "0937", "0936"];
        for (const code of expectedBusStopCodes) {
          const found = allBusStops.some((stop) => stop.includes(code));
          expect(found).toBe(true);
        }

        // Should reference the main street "Искърска"
        const allLocationText = [...allStreets, ...allPinsAddresses].join(" ");
        expect(allLocationText).toContain("Искърска");
      });
    });
  },
);
