import { describe, it, expect } from "vitest";
import { extractDateCandidate, parsePancharevoDateToIso } from "./index";

describe("rayon-pancharevo-bg/index date candidate extraction", () => {
  it("extracts month-name date with day-of-week", () => {
    const input = "Предстоящо спиране на водоподаването на 27 януари (вторник) 2026 г. в с. Лозен";

    expect(extractDateCandidate(input)).toBe("27 януари (вторник) 2026 г.");
  });

  it("extracts same-month range", () => {
    const input = "Ремонтни дейности в периода 24-26.02.2026 г. в района";

    expect(extractDateCandidate(input)).toBe("24-26.02.2026");
  });

  it("extracts cross-month range", () => {
    const input = "Водоподаването ще бъде нарушено на 28.02-02.03.2026 поради авария";

    expect(extractDateCandidate(input)).toBe("28.02-02.03.2026");
  });

  it("extracts numeric single date", () => {
    const input = "Планирано спиране на 05.12.2025 г. от 09:00 до 19:30 часа";

    expect(extractDateCandidate(input)).toBe("05.12.2025");
  });

  it("returns null when no recognizable date exists", () => {
    const input = "Информация за ВиК дейности без посочена дата";

    expect(extractDateCandidate(input)).toBeNull();
  });
});

describe("rayon-pancharevo-bg/index date parser", () => {
  it("parses month-name date text to ISO", () => {
    const iso = parsePancharevoDateToIso(
      "Предстоящо спиране на водоподаването на 27 януари (вторник) 2026 г. в с. Лозен",
    );
    const parsed = new Date(iso);

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(0);
    expect(parsed.getDate()).toBe(27);
  });

  it("parses range date text and uses range start", () => {
    const iso = parsePancharevoDateToIso(
      "Ремонтни дейности в периода 24-26.02.2026 г. в района",
    );
    const parsed = new Date(iso);

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(1);
    expect(parsed.getDate()).toBe(24);
  });
});
