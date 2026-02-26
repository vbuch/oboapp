import { describe, it, expect } from "vitest";
import {
  buildContentHash,
  buildUrl,
  buildTitle,
  buildMarkdownText,
  buildMessageText,
  buildTimespan,
  getMaxWarningLevel,
} from "./builders";
import type { WeatherPageData } from "./types";

describe("buildContentHash", () => {
  it("generates stable hash from content", () => {
    const data: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Снеговалежи",
      sofiaWarnings: [],
    };

    const hash1 = buildContentHash(data);
    const hash2 = buildContentHash(data);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(12);
  });

  it("keeps hash stable when only recommendation text changes", () => {
    const dataYellow: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Жълт код за сняг",
      sofiaWarnings: [],
    };

    const dataOrange: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Оранжев код за сняг",
      sofiaWarnings: [],
    };

    const hashYellow = buildContentHash(dataYellow);
    const hashOrange = buildContentHash(dataOrange);

    expect(hashYellow).toBe(hashOrange);
  });

  it("generates different hash when warnings change", () => {
    const data1: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "",
      sofiaWarnings: [
        { type: "snow_ice", level: "yellow", notes: ["Сняг до 5 см"] },
      ],
    };

    const data2: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "",
      sofiaWarnings: [
        { type: "snow_ice", level: "orange", notes: ["Сняг до 15 см"] },
      ],
    };

    const hash1 = buildContentHash(data1);
    const hash2 = buildContentHash(data2);

    expect(hash1).not.toBe(hash2);
  });
});

describe("buildUrl", () => {
  it("builds correct URL with forecast date and content hash", () => {
    const data: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Test",
      sofiaWarnings: [],
    };

    const url = buildUrl(data);

    expect(url).toMatch(
      /^https:\/\/weather\.bg\/obshtini\/index\.php\?z=u&o=SOF&date=2026-02-01&h=[a-f0-9]{12}$/,
    );
  });

  it("keeps URL stable when only recommendation text changes", () => {
    const data1: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Yellow warning",
      sofiaWarnings: [],
    };

    const data2: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Orange warning",
      sofiaWarnings: [],
    };

    const url1 = buildUrl(data1);
    const url2 = buildUrl(data2);

    expect(url1).toBe(url2);
  });
});

describe("buildTitle", () => {
  it("builds Bulgarian title with formatted date", () => {
    const data: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "",
      sofiaWarnings: [],
    };

    const title = buildTitle(data);

    expect(title).toBe("Предупреждение за опасно време - 1 февруари 2026");
  });
});

describe("buildMarkdownText", () => {
  it("includes warning level per type and recommendation", () => {
    const data: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Снеговалежи и образуване на снежна покривка",
      sofiaWarnings: [
        {
          type: "snow_ice" as const,
          level: "yellow" as const,
          notes: ["Сняг до 10 см"],
        },
      ],
    };

    const markdown = buildMarkdownText(data);

    expect(markdown).toContain(
      "**Жълт код за опасно време за 01.02.2026 (неделя)**",
    );
    expect(markdown).toContain("**Жълт код за сняг**");
    expect(markdown).toContain("Снеговалежи и образуване на снежна покривка");
  });

  it("includes warnings organized by level (most severe first)", () => {
    const data: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "",
      sofiaWarnings: [
        {
          type: "low_temperature",
          level: "yellow",
          notes: [
            "Минимални температури от -14 до -9°С",
            "Отрицателни максимални температури",
          ],
        },
        {
          type: "snow_ice",
          level: "orange",
          notes: ["Образуване на снежна покривка до 10 см"],
        },
      ],
    };

    const markdown = buildMarkdownText(data);

    // Should have heading with date (at the start)
    expect(markdown).toMatch(
      /^\*\*Оранжев код за опасно време за 01\.02\.2026 \(неделя\)\*\*/,
    );
    // Orange (more severe) should come first in the list
    expect(markdown).toContain("**Оранжев код за сняг**");
    expect(markdown).toContain("**Жълт код за температура**");
    expect(markdown).toContain("- Минимални температури от -14 до -9°С");
    expect(markdown).toContain("- Отрицателни максимални температури");
    expect(markdown).toContain("- Образуване на снежна покривка до 10 см");

    // Verify orange comes before yellow in output
    const orangeIndex = markdown.indexOf("Оранжев код за сняг");
    const yellowIndex = markdown.indexOf("Жълт код за температура");
    expect(orangeIndex).toBeLessThan(yellowIndex);
  });

  it("filters out green warnings", () => {
    const data: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "",
      sofiaWarnings: [
        { type: "wind", level: "green", notes: [] },
        { type: "snow_ice", level: "yellow", notes: ["Сняг"] },
      ],
    };

    const markdown = buildMarkdownText(data);

    expect(markdown).not.toContain("Зелен");
    expect(markdown).toContain("**Жълт код за сняг**");
  });
});

describe("buildMessageText", () => {
  it("builds plain text message with date", () => {
    const data: WeatherPageData = {
      forecastDate: "2026-02-01",
      issuedAt: "2026-01-31T11:02:45",
      recommendation: "Снеговалежи",
      sofiaWarnings: [
        {
          type: "snow_ice",
          level: "yellow",
          notes: ["Образуване на снежна покривка", "Заледяване"],
        },
      ],
    };

    const text = buildMessageText(data);

    expect(text).toContain("Жълт код за опасно време за 01.02.2026 (неделя)");
    expect(text).toContain("Снеговалежи");
    expect(text).toContain("Образуване на снежна покривка; Заледяване");
  });
});

describe("buildTimespan", () => {
  it("creates timespan covering full day in Bulgaria timezone", () => {
    const { start, end } = buildTimespan("2026-02-01");

    // Start should be midnight
    expect(start.getUTCHours()).toBe(22); // 00:00 EET = 22:00 UTC previous day
    expect(start.getUTCDate()).toBe(31); // January 31 UTC

    // End should be 23:59:59
    expect(end.getUTCHours()).toBe(21); // 23:59 EET = 21:59 UTC
    expect(end.getUTCDate()).toBe(1); // February 1 UTC
  });
});

describe("getMaxWarningLevel", () => {
  it("returns red when any warning is red", () => {
    const warnings = [
      { type: "wind" as const, level: "yellow" as const, notes: [] },
      { type: "snow_ice" as const, level: "red" as const, notes: [] },
    ];

    expect(getMaxWarningLevel(warnings)).toBe("red");
  });

  it("returns orange when highest is orange", () => {
    const warnings = [
      { type: "wind" as const, level: "yellow" as const, notes: [] },
      { type: "snow_ice" as const, level: "orange" as const, notes: [] },
    ];

    expect(getMaxWarningLevel(warnings)).toBe("orange");
  });

  it("returns green for empty warnings", () => {
    expect(getMaxWarningLevel([])).toBe("green");
  });
});
