import { describe, it, expect } from "vitest";
import { getSourceTrust, getGeometryQuality } from "./source-trust";

describe("getSourceTrust", () => {
  it("returns trust 1.0 and quality 3 for toplo-bg", () => {
    const entry = getSourceTrust("toplo-bg");
    expect(entry).toEqual({ trust: 1.0, geometryQuality: 3 });
  });

  it("returns trust 1.0 and quality 3 for sofiyska-voda", () => {
    const entry = getSourceTrust("sofiyska-voda");
    expect(entry).toEqual({ trust: 1.0, geometryQuality: 3 });
  });

  it("returns trust 0.9 and quality 3 for erm-zapad", () => {
    const entry = getSourceTrust("erm-zapad");
    expect(entry).toEqual({ trust: 0.9, geometryQuality: 3 });
  });

  it("returns trust 0.8 and quality 2 for municipality sources", () => {
    const entry = getSourceTrust("sofia-bg");
    expect(entry).toEqual({ trust: 0.8, geometryQuality: 2 });
  });

  it("returns defaults for unknown source", () => {
    const entry = getSourceTrust("nonexistent-source");
    expect(entry).toEqual({ trust: 0.5, geometryQuality: 0 });
  });
});

describe("getGeometryQuality", () => {
  it("returns 3 when hasPrecomputedGeoJson is true regardless of source", () => {
    expect(getGeometryQuality("sofia-bg", true)).toBe(3);
    expect(getGeometryQuality("nonexistent-source", true)).toBe(3);
  });

  it("returns source default quality when no precomputed GeoJSON", () => {
    expect(getGeometryQuality("toplo-bg", false)).toBe(3);
    expect(getGeometryQuality("sofia-bg", false)).toBe(2);
  });

  it("returns 0 for unknown source without precomputed GeoJSON", () => {
    expect(getGeometryQuality("unknown", false)).toBe(0);
  });
});
