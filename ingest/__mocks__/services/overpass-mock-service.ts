import { readFileSync } from "node:fs";
import { join } from "node:path";

export class OverpassMockService {
  private customFixturePath: string | null = null;

  constructor() {
    this.customFixturePath = process.env.OVERPASS_FIXTURE_PATH || null;
  }

  async geocodeStreets(streets: any[]): Promise<any[]> {
    // Use custom fixture if specified
    if (this.customFixturePath) {
      return JSON.parse(readFileSync(this.customFixturePath, "utf-8"));
    }

    // Simulate delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Return empty - Overpass data requires real API calls
    // Developers can add fixtures for specific streets over time
    return [];
  }
}
