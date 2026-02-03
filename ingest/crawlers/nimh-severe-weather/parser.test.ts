import { describe, it, expect } from "vitest";
import { parseWeatherPage, hasActiveWarnings } from "./parser";

describe("parseWeatherPage", () => {
  it("parses forecast date from page content", () => {
    const html = `
      <div>прогноза за: 01.02.2026</div>
      <div>издадена на: 2026-01-31 11:02:45</div>
      <table>
        <tr><th>Община</th><th>Висока температура</th><th>Ниска температура</th><th>Вятър</th><th>Дъжд</th><th>Сняг и/или поледица</th></tr>
        <tr><td>Столична</td><td></td><td></td><td></td><td></td><td></td></tr>
      </table>
    `;

    const result = parseWeatherPage(html);

    expect(result).not.toBeNull();
    expect(result?.forecastDate).toBe("2026-02-01");
  });

  it("parses issued date from page content", () => {
    const html = `
      <div>прогноза за: 01.02.2026</div>
      <div>издадена на: 2026-01-31 11:02:45</div>
      <table>
        <tr><th>Община</th><th>Висока температура</th></tr>
        <tr><td>Столична</td><td></td></tr>
      </table>
    `;

    const result = parseWeatherPage(html);

    expect(result).not.toBeNull();
    expect(result?.issuedAt).toBe("2026-01-31T11:02:45");
  });

  it("extracts recommendation text", () => {
    const html = `
      <div>прогноза за: 01.02.2026
      Снеговалежи и образуване на снежна покривка до 10 cm.
      издадена на: 2026-01-31 11:02:45</div>
      <table>
        <tr><td>Столична</td><td></td></tr>
      </table>
    `;

    const result = parseWeatherPage(html);

    expect(result).not.toBeNull();
    expect(result?.recommendation).toContain("Снеговалежи");
  });

  it("extracts warning notes from Sofia row", () => {
    const html = `
      <div>прогноза за: 01.02.2026</div>
      <div>издадена на: 2026-01-31 11:02:45</div>
      <table>
        <tr>
          <th>Община</th>
          <th>Висока температура</th>
          <th>Ниска температура</th>
          <th>Вятър</th>
          <th>Дъжд</th>
          <th>Сняг и/или поледица</th>
        </tr>
        <tr>
          <td>Столична</td>
          <td></td>
          <td>Минимални температури от -14 до -9°С; Отрицателни максимални температури</td>
          <td></td>
          <td></td>
          <td>Първи сняг за сезона; Образуване на снежна покривка до 10 см; Заледяване на пътните настилки</td>
        </tr>
      </table>
    `;

    const result = parseWeatherPage(html);

    expect(result).not.toBeNull();
    expect(result?.sofiaWarnings).toHaveLength(2);

    // Low temperature warnings
    const lowTempWarning = result?.sofiaWarnings.find(
      (w) => w.type === "low_temperature",
    );
    expect(lowTempWarning).toBeDefined();
    expect(lowTempWarning?.notes).toContain(
      "Минимални температури от -14 до -9°С",
    );
    expect(lowTempWarning?.notes).toContain(
      "Отрицателни максимални температури",
    );

    // Snow/ice warnings
    const snowWarning = result?.sofiaWarnings.find(
      (w) => w.type === "snow_ice",
    );
    expect(snowWarning).toBeDefined();
    expect(snowWarning?.notes).toContain("Първи сняг за сезона");
    expect(snowWarning?.notes).toContain(
      "Образуване на снежна покривка до 10 см",
    );
    expect(snowWarning?.notes).toContain("Заледяване на пътните настилки");
  });

  it("returns null if forecast date is not found", () => {
    const html = `<div>No forecast date here</div>`;

    const result = parseWeatherPage(html);

    expect(result).toBeNull();
  });

  it("handles empty table cells", () => {
    const html = `
      <div>прогноза за: 01.02.2026</div>
      <div>издадена на: 2026-01-31 11:02:45</div>
      <table>
        <tr><td>Столична</td><td></td><td></td><td></td><td></td><td></td></tr>
      </table>
    `;

    const result = parseWeatherPage(html);

    expect(result).not.toBeNull();
    expect(result?.sofiaWarnings).toHaveLength(0);
  });
});

describe("hasActiveWarnings", () => {
  it("returns true when recommendation text exists", () => {
    const data = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Снеговалежи и образуване на снежна покривка до 10 cm.",
      sofiaWarnings: [],
    };

    expect(hasActiveWarnings(data)).toBe(true);
  });

  it("returns true when warnings have notes", () => {
    const data = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "",
      sofiaWarnings: [
        {
          type: "snow_ice" as const,
          level: "yellow" as const,
          notes: ["Образуване на снежна покривка до 10 см"],
        },
      ],
    };

    expect(hasActiveWarnings(data)).toBe(true);
  });

  it("returns true when warnings have non-green level", () => {
    const data = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "",
      sofiaWarnings: [
        {
          type: "wind" as const,
          level: "orange" as const,
          notes: [],
        },
      ],
    };

    expect(hasActiveWarnings(data)).toBe(true);
  });

  it("returns false when no recommendation and no warnings", () => {
    const data = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "",
      sofiaWarnings: [],
    };

    expect(hasActiveWarnings(data)).toBe(false);
  });

  it("returns false when recommendation is 'Няма опасност'", () => {
    const data = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Няма опасност",
      sofiaWarnings: [],
    };

    expect(hasActiveWarnings(data)).toBe(false);
  });

  it("returns false when recommendation contains 'няма опасност' (case insensitive)", () => {
    const data = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "За София няма опасност от опасно време.",
      sofiaWarnings: [],
    };

    expect(hasActiveWarnings(data)).toBe(false);
  });

  it("returns false when recommendation is 'без опасност'", () => {
    const data = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Без опасност",
      sofiaWarnings: [],
    };

    expect(hasActiveWarnings(data)).toBe(false);
  });

  it("returns false when recommendation contains 'не се очаква опасност'", () => {
    const data = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Не се очаква опасност от силни ветрове.",
      sofiaWarnings: [],
    };

    expect(hasActiveWarnings(data)).toBe(false);
  });

  it("returns true when there are warnings even if recommendation says no danger", () => {
    const data = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Няма опасност",
      sofiaWarnings: [
        {
          type: "wind" as const,
          level: "yellow" as const,
          notes: ["Силен вятър"],
        },
      ],
    };

    expect(hasActiveWarnings(data)).toBe(true);
  });

  it("returns false when only green warnings exist with no-danger recommendation", () => {
    const data = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Няма опасност",
      sofiaWarnings: [
        {
          type: "wind" as const,
          level: "green" as const,
          notes: [],
        },
      ],
    };

    expect(hasActiveWarnings(data)).toBe(false);
  });
});
