import { describe, it, expect } from "vitest";
import { buildGrid, assignToGridCell, getGridCellById } from "./grid";
import type { BoundsDefinition } from "@oboapp/shared";

const sofiaBounds: BoundsDefinition = {
  south: 42.6,
  north: 42.8,
  west: 23.2,
  east: 23.5,
};

describe("buildGrid", () => {
  it("produces cells covering the entire bounds", () => {
    const grid = buildGrid(sofiaBounds);
    expect(grid.length).toBeGreaterThan(0);

    // Every cell must be within the parent bounds
    for (const cell of grid) {
      expect(cell.bounds.south).toBeGreaterThanOrEqual(sofiaBounds.south);
      expect(cell.bounds.north).toBeLessThanOrEqual(sofiaBounds.north + 0.001);
      expect(cell.bounds.west).toBeGreaterThanOrEqual(sofiaBounds.west);
      expect(cell.bounds.east).toBeLessThanOrEqual(sofiaBounds.east + 0.001);
    }
  });

  it("generates unique IDs for all cells", () => {
    const grid = buildGrid(sofiaBounds);
    const ids = grid.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses r{row}c{col} naming convention", () => {
    const grid = buildGrid(sofiaBounds);
    for (const cell of grid) {
      expect(cell.id).toMatch(/^r\d+c\d+$/);
    }
  });

  it("adjusts grid dimensions with cell size", () => {
    const largeCells = buildGrid(sofiaBounds, 8);
    const smallCells = buildGrid(sofiaBounds, 2);
    expect(smallCells.length).toBeGreaterThan(largeCells.length);
  });

  it("produces valid GeoJSON for each cell", () => {
    const grid = buildGrid(sofiaBounds);
    for (const cell of grid) {
      expect(cell.geoJson.type).toBe("FeatureCollection");
      expect(cell.geoJson.features).toHaveLength(1);
      expect(cell.geoJson.features[0].geometry.type).toBe("Polygon");
    }
  });

  it("computes center as midpoint of cell bounds", () => {
    const grid = buildGrid(sofiaBounds);
    for (const cell of grid) {
      const expectedLat = (cell.bounds.south + cell.bounds.north) / 2;
      const expectedLng = (cell.bounds.west + cell.bounds.east) / 2;
      expect(cell.center.lat).toBeCloseTo(expectedLat, 6);
      expect(cell.center.lng).toBeCloseTo(expectedLng, 6);
    }
  });
});

describe("assignToGridCell", () => {
  const grid = buildGrid(sofiaBounds);

  it("assigns a point inside the bounds to a cell", () => {
    const cell = assignToGridCell(grid, 42.7, 23.35);
    expect(cell).not.toBeNull();
    expect(cell!.id).toMatch(/^r\d+c\d+$/);
  });

  it("returns null for a point outside the bounds", () => {
    const cell = assignToGridCell(grid, 41.0, 23.35);
    expect(cell).toBeNull();
  });

  it("assigns the same point to the same cell consistently", () => {
    const cell1 = assignToGridCell(grid, 42.7, 23.35);
    const cell2 = assignToGridCell(grid, 42.7, 23.35);
    expect(cell1!.id).toBe(cell2!.id);
  });
});

describe("getGridCellById", () => {
  const grid = buildGrid(sofiaBounds);

  it("finds existing cell by ID", () => {
    const cell = getGridCellById(grid, "r0c0");
    expect(cell).not.toBeNull();
    expect(cell!.id).toBe("r0c0");
  });

  it("returns null for non-existent ID", () => {
    const cell = getGridCellById(grid, "r999c999");
    expect(cell).toBeNull();
  });
});
