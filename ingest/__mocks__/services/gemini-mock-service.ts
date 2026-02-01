import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtractedData } from "@/lib/types";
import type { CategorizationResult } from "@/lib/categorize.schema";

interface FixtureMap {
  [key: string]: any;
}

export class GeminiMockService {
  private categorizeFixtures: FixtureMap = {};
  private extractFixtures: FixtureMap = {};
  private customFixturePath: string | null = null;

  constructor() {
    this.loadFixtures();
    this.customFixturePath = process.env.GEMINI_FIXTURE_PATH || null;
  }

  private loadFixtures(): void {
    const fixtureDir = join(__dirname, "../fixtures/gemini");

    try {
      this.categorizeFixtures = {
        water: JSON.parse(
          readFileSync(
            join(fixtureDir, "categorize-water-disruption.json"),
            "utf-8",
          ),
        ),
        traffic: JSON.parse(
          readFileSync(
            join(fixtureDir, "categorize-traffic-block.json"),
            "utf-8",
          ),
        ),
        construction: JSON.parse(
          readFileSync(
            join(fixtureDir, "categorize-construction.json"),
            "utf-8",
          ),
        ),
      };

      this.extractFixtures = {
        pins: JSON.parse(
          readFileSync(join(fixtureDir, "extract-pins-streets.json"), "utf-8"),
        ),
        cadastral: JSON.parse(
          readFileSync(join(fixtureDir, "extract-cadastral.json"), "utf-8"),
        ),
      };
    } catch (error) {
      console.warn("[GeminiMockService] Failed to load fixtures:", error);
    }
  }

  async categorize(text: string): Promise<CategorizationResult | null> {
    // Use custom fixture if specified
    if (this.customFixturePath) {
      return JSON.parse(readFileSync(this.customFixturePath, "utf-8"));
    }

    // Simple pattern matching for fixture selection
    const lowerText = text.toLowerCase();

    if (lowerText.includes("вод") || lowerText.includes("water")) {
      return this.categorizeFixtures.water ?? null;
    }

    if (
      lowerText.includes("движение") ||
      lowerText.includes("трафик") ||
      lowerText.includes("traffic")
    ) {
      return this.categorizeFixtures.traffic ?? null;
    }

    if (
      lowerText.includes("ремонт") ||
      lowerText.includes("строителст") ||
      lowerText.includes("construction")
    ) {
      return this.categorizeFixtures.construction ?? null;
    }

    // Default fallback
    return this.categorizeFixtures.water ?? null;
  }

  async extractStructuredData(text: string): Promise<ExtractedData | null> {
    // Use custom fixture if specified
    if (this.customFixturePath) {
      return JSON.parse(readFileSync(this.customFixturePath, "utf-8"));
    }

    // Simple pattern matching
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes("упи") ||
      lowerText.includes("кв.") ||
      lowerText.includes("cadastral")
    ) {
      return this.extractFixtures.cadastral ?? null;
    }

    // Default to pins and streets
    return this.extractFixtures.pins ?? null;
  }
}
