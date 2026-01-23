import { describe, expect, it } from "vitest";
import {
  buildTitle,
  buildMessage,
  buildFeatureProperties,
  buildGeoJsonFeatureCollection,
  buildSourceDocument,
  getFeatureUrl,
  createFeatureCollection,
} from "./builders";
import type { ArcGisFeature, LayerConfig } from "./types";

const mockLayer: LayerConfig = {
  id: 2,
  name: "Текущи спирания",
  titlePrefix: "Текущо спиране",
  where: "ACTIVESTATUS = 'In Progress'",
};

describe("sofiyska-voda/builders", () => {
  describe("getFeatureUrl", () => {
    it("should build correct URL", () => {
      expect(getFeatureUrl(2, 12345)).toBe(
        "https://gispx.sofiyskavoda.bg/arcgis/rest/services/WSI_PUBLIC/InfoCenter_Public/MapServer/2/12345",
      );
    });
  });

  describe("buildTitle", () => {
    it("should build title from all components", () => {
      const attributes = {
        LOCATION: "ул. Иван Вазов",
        ALERTTYPE: "Авария",
        ALERTID: "123",
        OBJECTID: 456,
      };

      const title = buildTitle(attributes, mockLayer);
      expect(title).toBe("Текущо спиране – ул. Иван Вазов – Авария");
    });

    it("should use titlePrefix if no location/type", () => {
      const attributes = {
        ALERTID: "789",
        OBJECTID: 456,
      };

      const title = buildTitle(attributes, mockLayer);
      // titlePrefix is always included, so we get just that
      expect(title).toBe("Текущо спиране");
    });

    it("should use only titlePrefix when no other data", () => {
      const attributes = {
        OBJECTID: 456,
      };

      const title = buildTitle(attributes, mockLayer);
      // Since titlePrefix is always included, we just get that
      // The fallback code with OBJECTID is actually unreachable
      expect(title).toBe("Текущо спиране");
    });
  });

  describe("buildMessage", () => {
    it("should build complete message", () => {
      const attributes = {
        LOCATION: "ул. Иван Вазов",
        DESCRIPTION: "Авария на водопровод",
        START_: new Date("2025-12-29T10:00:00").getTime(),
        ALERTEND: new Date("2025-12-29T18:00:00").getTime(),
        LASTUPDATE: new Date("2025-12-29T12:00:00").getTime(),
        ACTIVESTATUS: "In Progress",
        SOFIADISTRICT: 5,
        CONTACT: "02/123-456",
      };

      const message = buildMessage(attributes, mockLayer);
      expect(message).toContain("ул. Иван Вазов");
      expect(message).toContain("Авария на водопровод");
      expect(message).toContain("Текущи спирания");
      expect(message).toContain("In Progress");
      expect(message).toContain("2025");
    });

    it("should skip duplicate location and description", () => {
      const attributes = {
        LOCATION: "Same text",
        DESCRIPTION: "Same text",
      };

      const message = buildMessage(attributes, mockLayer);
      // Should only include "Same text" once
      const matches = message.match(/Same text/g);
      expect(matches).toHaveLength(1);
    });

    it("should handle missing fields", () => {
      const attributes = {};
      const message = buildMessage(attributes, mockLayer);
      expect(message).toContain("Текущи спирания");
    });
  });

  describe("buildFeatureProperties", () => {
    it("should build properties with all fields", () => {
      const attributes = {
        ALERTID: "123",
        ACTIVESTATUS: "In Progress",
        ALERTTYPE: "Авария",
        LOCATION: "  ул. Иван Вазов  ",
        SOFIADISTRICT: 5,
      };

      const props = buildFeatureProperties(attributes, mockLayer);
      expect(props).toEqual({
        layerId: 2,
        layerName: "Текущи спирания",
        titlePrefix: "Текущо спиране",
        alertId: "123",
        status: "In Progress",
        alertType: "Авария",
        location: "ул. Иван Вазов", // Should be trimmed
        district: 5,
      });
    });

    it("should filter out null and empty values", () => {
      const attributes = {
        ALERTID: null,
        ACTIVESTATUS: "",
        LOCATION: "Test",
      };

      const props = buildFeatureProperties(attributes, mockLayer);
      expect(props).not.toHaveProperty("alertId");
      expect(props).not.toHaveProperty("status");
      expect(props).toHaveProperty("location");
    });
  });

  describe("createFeatureCollection", () => {
    it("should wrap feature in FeatureCollection", () => {
      const feature = {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [23.32, 42.69] as [number, number],
        },
        properties: { test: "value" },
      };

      const collection = createFeatureCollection(feature);
      expect(collection.type).toBe("FeatureCollection");
      expect(collection.features).toHaveLength(1);
      expect(collection.features[0]).toEqual(feature);
    });
  });

  describe("buildGeoJsonFeatureCollection", () => {
    it("should build Point geometry", () => {
      const feature: ArcGisFeature = {
        attributes: { OBJECTID: 1 },
        geometry: { x: 23.32, y: 42.69 },
      };

      const collection = buildGeoJsonFeatureCollection(feature, mockLayer);
      expect(collection?.type).toBe("FeatureCollection");
      expect(collection?.features[0].geometry.type).toBe("Point");
      expect(collection?.features[0].geometry.coordinates).toEqual([
        23.32, 42.69,
      ]);
    });

    it("should build Polygon geometry", () => {
      const feature: ArcGisFeature = {
        attributes: { OBJECTID: 1 },
        geometry: {
          rings: [
            [
              [23.32, 42.69],
              [23.33, 42.69],
              [23.33, 42.7],
              [23.32, 42.7],
              [23.32, 42.69],
            ],
          ],
        },
      };

      const collection = buildGeoJsonFeatureCollection(feature, mockLayer);
      expect(collection?.features[0].geometry.type).toBe("Polygon");
    });

    it("should build LineString geometry", () => {
      const feature: ArcGisFeature = {
        attributes: { OBJECTID: 1 },
        geometry: {
          paths: [
            [
              [23.32, 42.69],
              [23.33, 42.7],
            ],
          ],
        },
      };

      const collection = buildGeoJsonFeatureCollection(feature, mockLayer);
      expect(collection?.features[0].geometry.type).toBe("LineString");
    });

    it("should return null for missing geometry", () => {
      const feature: ArcGisFeature = {
        attributes: { OBJECTID: 1 },
        geometry: null,
      };

      expect(buildGeoJsonFeatureCollection(feature, mockLayer)).toBeNull();
    });

    it("should skip single-point paths", () => {
      const feature: ArcGisFeature = {
        attributes: { OBJECTID: 1 },
        geometry: {
          paths: [[[23.32, 42.69]]], // Only one point
        },
      };

      expect(buildGeoJsonFeatureCollection(feature, mockLayer)).toBeNull();
    });
  });

  describe("buildSourceDocument", () => {
    it("should build full document", async () => {
      const feature: ArcGisFeature = {
        attributes: {
          OBJECTID: 12345,
          LOCATION: "ул. Иван Вазов",
          LASTUPDATE: new Date("2025-12-29T10:00:00").getTime(),
        },
        geometry: { x: 23.32, y: 42.69 },
      };

      const doc = await buildSourceDocument(feature, mockLayer);
      expect(doc).not.toBeNull();
      expect(doc?.url).toContain("12345");
      expect(doc?.title).toContain("ул. Иван Вазов");
      expect(doc?.sourceType).toBe("sofiyska-voda");
      expect(doc?.geoJson).toBeDefined();
    });

    it("should return null without OBJECTID", async () => {
      const feature: ArcGisFeature = {
        attributes: {},
        geometry: { x: 23.32, y: 42.69 },
      };

      expect(await buildSourceDocument(feature, mockLayer)).toBeNull();
    });

    it("should return null without geometry", async () => {
      const feature: ArcGisFeature = {
        attributes: { OBJECTID: 12345 },
        geometry: null,
      };

      expect(await buildSourceDocument(feature, mockLayer)).toBeNull();
    });

    it("should use START_ if no LASTUPDATE", async () => {
      const startTime = new Date("2025-12-29T10:00:00");
      const feature: ArcGisFeature = {
        attributes: {
          OBJECTID: 12345,
          START_: startTime.getTime(),
        },
        geometry: { x: 23.32, y: 42.69 },
      };

      const doc = await buildSourceDocument(feature, mockLayer);
      expect(doc?.datePublished).toContain("2025-12-29");
    });
  });
});
