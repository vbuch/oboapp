import { readFileSync } from "node:fs";

export class CadastreMockService {
  private customFixturePath: string | null = null;

  constructor() {
    this.customFixturePath = process.env.CADASTRE_FIXTURE_PATH || null;
  }

  async geocodeCadastralPropertiesFromIdentifiers(
    properties: any[],
  ): Promise<any[]> {
    // Use custom fixture if specified
    if (this.customFixturePath) {
      return JSON.parse(readFileSync(this.customFixturePath, "utf-8"));
    }

    // Simulate delay (cadastre is slow)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Return empty - Cadastre data requires real API calls with session
    // Developers can add fixtures for specific properties over time
    return [];
  }
}
