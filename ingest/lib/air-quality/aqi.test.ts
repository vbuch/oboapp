import { describe, it, expect } from "vitest";
import { calculateNowCastAqi, getAqiLabel, getAqiCategory } from "./aqi";

describe("calculateNowCastAqi", () => {
  it("returns 0 for empty input", () => {
    expect(calculateNowCastAqi([])).toBe(0);
  });

  it("returns AQI in 'Good' range for low PM values", () => {
    const hourly = [
      { pm25: 5.0, pm10: 10 },
      { pm25: 4.5, pm10: 12 },
    ];
    const aqi = calculateNowCastAqi(hourly);
    expect(aqi).toBeGreaterThanOrEqual(0);
    expect(aqi).toBeLessThanOrEqual(50);
  });

  it("returns AQI in 'Unhealthy for Sensitive Groups' range for elevated PM", () => {
    const hourly = [
      { pm25: 45.0, pm10: 160 },
      { pm25: 40.0, pm10: 155 },
    ];
    const aqi = calculateNowCastAqi(hourly);
    expect(aqi).toBeGreaterThanOrEqual(101);
    expect(aqi).toBeLessThanOrEqual(150);
  });

  it("returns AQI ≥ 151 for 'Unhealthy' PM values", () => {
    const hourly = [
      { pm25: 80.0, pm10: 280 },
      { pm25: 75.0, pm10: 260 },
    ];
    const aqi = calculateNowCastAqi(hourly);
    expect(aqi).toBeGreaterThanOrEqual(151);
  });

  it("uses max of PM2.5 and PM10 AQI", () => {
    // High PM10 but low PM2.5
    const hourly = [{ pm25: 3.0, pm10: 200 }];
    const aqi = calculateNowCastAqi(hourly);
    // PM10=200 is in 155-254 range → AQI 101-150
    expect(aqi).toBeGreaterThanOrEqual(101);
  });

  it("handles single hour of data", () => {
    const hourly = [{ pm25: 12.0, pm10: 50 }];
    const aqi = calculateNowCastAqi(hourly);
    expect(aqi).toBeGreaterThan(0);
  });

  it("caps AQI at 500 for extreme values", () => {
    const hourly = [{ pm25: 500.0, pm10: 700 }];
    const aqi = calculateNowCastAqi(hourly);
    expect(aqi).toBe(500);
  });

  it("applies NowCast weighting to reduce recent-spike influence", () => {
    // Spike in most recent hour, low values before
    const spikeHours = [
      { pm25: 100.0, pm10: 50 },
      { pm25: 5.0, pm10: 10 },
      { pm25: 5.0, pm10: 10 },
      { pm25: 5.0, pm10: 10 },
    ];
    const steadyHours = [
      { pm25: 100.0, pm10: 50 },
      { pm25: 100.0, pm10: 50 },
      { pm25: 100.0, pm10: 50 },
      { pm25: 100.0, pm10: 50 },
    ];
    const spikeAqi = calculateNowCastAqi(spikeHours);
    const steadyAqi = calculateNowCastAqi(steadyHours);
    // Spike weighting should give lower AQI than steady high
    expect(spikeAqi).toBeLessThan(steadyAqi);
  });
});

describe("getAqiLabel", () => {
  it.each([
    [25, "Добро"],
    [75, "Умерено"],
    [125, "Нездравословно за чувствителни групи"],
    [175, "Нездравословно"],
    [250, "Много нездравословно"],
    [400, "Опасно"],
  ])("returns correct Bulgarian label for AQI %i", (aqi, expected) => {
    expect(getAqiLabel(aqi)).toBe(expected);
  });

  it("returns boundary labels correctly", () => {
    expect(getAqiLabel(50)).toBe("Добро");
    expect(getAqiLabel(51)).toBe("Умерено");
    expect(getAqiLabel(100)).toBe("Умерено");
    expect(getAqiLabel(101)).toBe("Нездравословно за чувствителни групи");
  });
});

describe("getAqiCategory", () => {
  it.each([
    [25, "good"],
    [75, "moderate"],
    [125, "unhealthy-sensitive"],
    [175, "unhealthy"],
    [250, "very-unhealthy"],
    [400, "hazardous"],
  ] as const)("returns correct category for AQI %i", (aqi, expected) => {
    expect(getAqiCategory(aqi)).toBe(expected);
  });
});
