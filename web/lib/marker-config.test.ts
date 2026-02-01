/**
 * Unit tests for marker configuration utilities
 */

import { describe, it, expect } from "vitest";
import {
  GEOJSON_STYLES,
  createMarkerIcon,
  createClusterIcon,
  getGeometryStyle,
  createCustomGeometryStyle,
  type MarkerIconConfig,
  type GeometryStyleConfig,
} from "./marker-config";
import { colors, opacity } from "./colors";

describe("marker-config", () => {
  describe("GEOJSON_STYLES", () => {
    it("should contain all required geometry styles", () => {
      expect(GEOJSON_STYLES).toHaveProperty("lineString");
      expect(GEOJSON_STYLES).toHaveProperty("lineStringHover");
      expect(GEOJSON_STYLES).toHaveProperty("polygon");
      expect(GEOJSON_STYLES).toHaveProperty("polygonHover");
    });

    it("should use correct colors from color palette", () => {
      expect(GEOJSON_STYLES.lineString.strokeColor).toBe(colors.primary.red);
      expect(GEOJSON_STYLES.polygon.fillColor).toBe(colors.primary.red);
    });

    it("should have different opacities for normal and hover states", () => {
      expect(GEOJSON_STYLES.lineString.strokeOpacity).toBe(opacity.default);
      expect(GEOJSON_STYLES.lineStringHover.strokeOpacity).toBe(opacity.hover);
      expect(GEOJSON_STYLES.polygon.fillOpacity).toBe(opacity.fill);
      expect(GEOJSON_STYLES.polygonHover.fillOpacity).toBe(opacity.fillHover);
    });

    it("should have higher zIndex for hover states", () => {
      expect(GEOJSON_STYLES.lineStringHover.zIndex).toBeGreaterThan(
        GEOJSON_STYLES.lineString.zIndex,
      );
      expect(GEOJSON_STYLES.polygonHover.zIndex).toBeGreaterThan(
        GEOJSON_STYLES.polygon.zIndex,
      );
    });
  });

  describe("createMarkerIcon", () => {
    it("should create default marker icon config", () => {
      const config = createMarkerIcon();

      expect(config).toMatchObject({
        path: "M 0,0 m -8,0 a 8,8 0 1,0 16,0 a 8,8 0 1,0 -16,0",
        fillColor: colors.primary.red,
        fillOpacity: opacity.default,
        strokeWeight: 2,
        strokeColor: colors.map.stroke,
        scale: 1,
      });
    });

    it("should create hovered marker icon config", () => {
      const config = createMarkerIcon(true);

      expect(config).toMatchObject({
        fillOpacity: opacity.hover,
        scale: 1.2,
      });
    });

    it("should accept custom colors", () => {
      const customColors = {
        primary: { red: "#FF0000", grey: "#808080" },
        map: { stroke: "#000000" },
      };
      const config = createMarkerIcon(false, "active", customColors as any);

      expect(config.fillColor).toBe("#FF0000");
      expect(config.strokeColor).toBe("#000000");
    });

    it("should accept custom opacity", () => {
      const customOpacity = {
        default: 0.5,
        hover: 0.9,
      };

      const normalConfig = createMarkerIcon(
        false,
        "active",
        colors,
        customOpacity as any,
      );
      const hoverConfig = createMarkerIcon(
        true,
        "active",
        colors,
        customOpacity as any,
      );

      expect(normalConfig.fillOpacity).toBe(0.5);
      expect(hoverConfig.fillOpacity).toBe(0.9);
    });
  });

  describe("createClusterIcon", () => {
    it("should create cluster icon config for small count", () => {
      const { icon, label } = createClusterIcon(3);

      expect(icon).toMatchObject({
        path: 0, // CIRCLE enum value in test environment
        fillColor: colors.primary.red,
        fillOpacity: 0.8,
        strokeColor: colors.map.stroke,
        strokeWeight: 2,
        scale: 16.5, // 15 + 3/2
      });

      expect(label).toMatchObject({
        text: "3",
        color: "white",
        fontSize: "12px",
        fontWeight: "bold",
      });
    });

    it("should create cluster icon config for large count", () => {
      const { icon, label } = createClusterIcon(100);

      // Should cap at max scale of 25
      expect(icon.scale).toBe(25);
      expect(label.text).toBe("100");
    });

    it("should create cluster icon config for single marker", () => {
      const { icon, label } = createClusterIcon(1);

      expect(icon.scale).toBe(15.5); // 15 + 1/2
      expect(label.text).toBe("1");
    });

    it("should accept custom colors", () => {
      const customColors = {
        primary: { red: "#00FF00", grey: "#808080" },
        map: { stroke: "#111111" },
      };

      const { icon } = createClusterIcon(5, "active", customColors as any);

      expect(icon.fillColor).toBe("#00FF00");
      expect(icon.strokeColor).toBe("#111111");
    });

    it("should scale appropriately for different counts", () => {
      const small = createClusterIcon(2);
      const medium = createClusterIcon(10);
      const large = createClusterIcon(50);

      expect(small.icon.scale).toBeLessThan(medium.icon.scale);
      expect(medium.icon.scale).toBeLessThan(large.icon.scale);
    });
  });

  describe("getGeometryStyle", () => {
    it("should return LineString style for normal state", () => {
      const style = getGeometryStyle("LineString");
      expect(style).toEqual(GEOJSON_STYLES.lineString);
    });

    it("should return LineString hover style when hovered", () => {
      const style = getGeometryStyle("LineString", true);
      expect(style).toEqual(GEOJSON_STYLES.lineStringHover);
    });

    it("should return LineString hover style when selected", () => {
      const style = getGeometryStyle("LineString", false, true);
      expect(style).toEqual(GEOJSON_STYLES.lineStringHover);
    });

    it("should return LineString hover style when both hovered and selected", () => {
      const style = getGeometryStyle("LineString", true, true);
      expect(style).toEqual(GEOJSON_STYLES.lineStringHover);
    });

    it("should return Polygon style for normal state", () => {
      const style = getGeometryStyle("Polygon");
      expect(style).toEqual(GEOJSON_STYLES.polygon);
    });

    it("should return Polygon hover style when hovered", () => {
      const style = getGeometryStyle("Polygon", true);
      expect(style).toEqual(GEOJSON_STYLES.polygonHover);
    });

    it("should return Polygon hover style when selected", () => {
      const style = getGeometryStyle("Polygon", false, true);
      expect(style).toEqual(GEOJSON_STYLES.polygonHover);
    });
  });

  describe("createCustomGeometryStyle", () => {
    it("should create custom LineString style with overrides", () => {
      const customStyle = createCustomGeometryStyle("LineString", {
        strokeColor: "#FF0000",
        strokeWeight: 5,
      });

      expect(customStyle).toMatchObject({
        ...GEOJSON_STYLES.lineString,
        strokeColor: "#FF0000",
        strokeWeight: 5,
      });
    });

    it("should create custom Polygon style with overrides", () => {
      const customStyle = createCustomGeometryStyle("Polygon", {
        fillColor: "#00FF00",
        fillOpacity: 0.5,
        zIndex: 10,
      });

      expect(customStyle).toMatchObject({
        ...GEOJSON_STYLES.polygon,
        fillColor: "#00FF00",
        fillOpacity: 0.5,
        zIndex: 10,
      });
    });

    it("should return base style when no options provided", () => {
      const lineStyle = createCustomGeometryStyle("LineString");
      const polygonStyle = createCustomGeometryStyle("Polygon");

      expect(lineStyle).toEqual(GEOJSON_STYLES.lineString);
      expect(polygonStyle).toEqual(GEOJSON_STYLES.polygon);
    });

    it("should handle partial overrides", () => {
      const customStyle = createCustomGeometryStyle("LineString", {
        strokeOpacity: 0.5,
      });

      expect(customStyle).toMatchObject({
        ...GEOJSON_STYLES.lineString,
        strokeOpacity: 0.5,
      });

      // Should keep other properties unchanged
      expect(customStyle.strokeColor).toBe(
        GEOJSON_STYLES.lineString.strokeColor,
      );
      expect(customStyle.strokeWeight).toBe(
        GEOJSON_STYLES.lineString.strokeWeight,
      );
    });
  });

  describe("type safety", () => {
    it("should enforce correct marker icon config structure", () => {
      const config: MarkerIconConfig = createMarkerIcon();

      // TypeScript should enforce these properties exist
      expect(typeof config.path).toBe("string");
      expect(typeof config.fillColor).toBe("string");
      expect(typeof config.fillOpacity).toBe("number");
      expect(typeof config.strokeWeight).toBe("number");
      expect(typeof config.strokeColor).toBe("string");
      expect(typeof config.scale).toBe("number");
    });

    it("should enforce correct cluster icon config structure", () => {
      const { icon, label } = createClusterIcon(5);

      // TypeScript should enforce these properties exist
      expect(typeof icon.fillColor).toBe("string");
      expect(typeof icon.scale).toBe("number");
      expect(typeof icon.path).toBeTruthy(); // Can be string or SymbolPath
      expect(typeof label.text).toBe("string");
      expect(typeof label.fontSize).toBe("string");
    });

    it("should enforce correct geometry style config structure", () => {
      const style: GeometryStyleConfig = getGeometryStyle("LineString");

      // TypeScript should enforce these properties exist
      expect(typeof style.strokeColor).toBe("string");
      expect(typeof style.strokeOpacity).toBe("number");
      expect(typeof style.strokeWeight).toBe("number");
      expect(typeof style.zIndex).toBe("number");
    });
  });
});
