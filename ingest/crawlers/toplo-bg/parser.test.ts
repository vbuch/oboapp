import { describe, it, expect } from "vitest";
import { parseIncidents } from "./parser";

describe("toplo-bg/parser", () => {
  describe("parseIncidents", () => {
    it("should parse valid incident data", () => {
      const html = `
        <html>
          <script>
            function parseAll() {
              var geoJsonString = '[{"type":"Feature","geometry":{"type":"Point","coordinates":[23.32,42.7]},"properties":{}}]'
              var info = {"AccidentId":"acc-1","Name":"Test Incident","Addresses":"Test St","GeolocationSerialized":"","Type":1,"Status":1,"FromDate":"2025-01-01T10:00:00","UntilDate":null,"AffectedService":null,"Region":"Sofia","Locally":false,"CreatedOn":"2025-01-01T09:00:00","ContentItemId":"item-1"}
              if (geoJsonString) { }
            }
          </script>
        </html>
      `;

      const incidents = parseIncidents(html);
      expect(incidents).toHaveLength(1);
      expect(incidents[0].info.AccidentId).toBe("acc-1");
      expect(incidents[0].info.Name).toBe("Test Incident");
      expect(incidents[0].geoJson.type).toBe("FeatureCollection");
      expect(incidents[0].geoJson.features).toHaveLength(1);
      expect(incidents[0].geoJson.features[0].geometry.type).toBe("Point");
    });

    it("should handle multiple incidents", () => {
      const html = `
        <html>
          <script>
            function parseAll() {
              var geoJsonString = '[{"type":"Feature","geometry":{"type":"Point","coordinates":[23.32,42.7]},"properties":{}}]'
              var info = {"AccidentId":"acc-1","Name":"Incident 1","Addresses":"Test St","GeolocationSerialized":"","Type":1,"Status":1,"FromDate":"2025-01-01T10:00:00","UntilDate":null,"AffectedService":null,"Region":"Sofia","Locally":false,"CreatedOn":"2025-01-01T09:00:00","ContentItemId":"item-1"}
              if (geoJsonString) { }
              
              var geoJsonString = '[{"type":"Feature","geometry":{"type":"Point","coordinates":[23.33,42.71]},"properties":{}}]'
              var info = {"AccidentId":"acc-2","Name":"Incident 2","Addresses":"Main St","GeolocationSerialized":"","Type":2,"Status":1,"FromDate":"2025-01-02T10:00:00","UntilDate":null,"AffectedService":"Heating","Region":"Sofia","Locally":true,"CreatedOn":"2025-01-02T09:00:00","ContentItemId":"item-2"}
              if (geoJsonString) { }
            }
          </script>
        </html>
      `;

      const incidents = parseIncidents(html);
      expect(incidents).toHaveLength(2);
      expect(incidents[0].info.Name).toBe("Incident 1");
      expect(incidents[1].info.Name).toBe("Incident 2");
    });

    it("should return empty array when no scripts found", () => {
      const html = `<html><body>No scripts here</body></html>`;
      const incidents = parseIncidents(html);
      expect(incidents).toEqual([]);
    });

    it("should return empty array when parseAll function not found", () => {
      const html = `
        <html>
          <script>
            function otherFunction() {
              console.log("Not parseAll");
            }
          </script>
        </html>
      `;

      const incidents = parseIncidents(html);
      expect(incidents).toEqual([]);
    });

    it("should skip incidents with invalid GeoJSON", () => {
      const html = `
        <html>
          <script>
            function parseAll() {
              var geoJsonString = '[{"type":"Feature","geometry":{"type":"Point","coordinates":[999,999]},"properties":{}}]'
              var info = {"AccidentId":"acc-1","Name":"Invalid Coords","Addresses":"Test St","GeolocationSerialized":"","Type":1,"Status":1,"FromDate":"2025-01-01T10:00:00","UntilDate":null,"AffectedService":null,"Region":"Sofia","Locally":false,"CreatedOn":"2025-01-01T09:00:00","ContentItemId":"item-1"}
              if (geoJsonString) { }
            }
          </script>
        </html>
      `;

      const incidents = parseIncidents(html);
      expect(incidents).toHaveLength(0);
    });

    it("should skip incidents with malformed info JSON", () => {
      const html = `
        <html>
          <script>
            function parseAll() {
              var geoJsonString = '[{"type":"Feature","geometry":{"type":"Point","coordinates":[23.32,42.7]},"properties":{}}]'
              var info = {invalid json here
              if (geoJsonString) { }
            }
          </script>
        </html>
      `;

      const incidents = parseIncidents(html);
      expect(incidents).toHaveLength(0);
    });

    it("should skip incidents with malformed geoJsonString", () => {
      const html = `
        <html>
          <script>
            function parseAll() {
              var geoJsonString = '[invalid json'
              var info = {"AccidentId":"acc-1","Name":"Test","Addresses":"Test St","GeolocationSerialized":"","Type":1,"Status":1,"FromDate":"2025-01-01T10:00:00","UntilDate":null,"AffectedService":null,"Region":"Sofia","Locally":false,"CreatedOn":"2025-01-01T09:00:00","ContentItemId":"item-1"}
              if (geoJsonString) { }
            }
          </script>
        </html>
      `;

      const incidents = parseIncidents(html);
      expect(incidents).toHaveLength(0);
    });

    it("should wrap raw feature arrays in FeatureCollection", () => {
      const html = `
        <html>
          <script>
            function parseAll() {
              var geoJsonString = '[{"type":"Feature","geometry":{"type":"Point","coordinates":[23.32,42.7]},"properties":{"test":"value"}}]'
              var info = {"AccidentId":"acc-1","Name":"Test Incident","Addresses":"Test St","GeolocationSerialized":"","Type":1,"Status":1,"FromDate":"2025-01-01T10:00:00","UntilDate":null,"AffectedService":null,"Region":"Sofia","Locally":false,"CreatedOn":"2025-01-01T09:00:00","ContentItemId":"item-1"}
              if (geoJsonString) { }
            }
          </script>
        </html>
      `;

      const incidents = parseIncidents(html);
      expect(incidents).toHaveLength(1);
      expect(incidents[0].geoJson.type).toBe("FeatureCollection");
      expect(incidents[0].geoJson.features[0].properties).toEqual({
        test: "value",
      });
    });

    it("should handle already-wrapped FeatureCollection", () => {
      const html = `
        <html>
          <script>
            function parseAll() {
              var geoJsonString = '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[23.32,42.7]},"properties":{}}]}'
              var info = {"AccidentId":"acc-1","Name":"Test Incident","Addresses":"Test St","GeolocationSerialized":"","Type":1,"Status":1,"FromDate":"2025-01-01T10:00:00","UntilDate":null,"AffectedService":null,"Region":"Sofia","Locally":false,"CreatedOn":"2025-01-01T09:00:00","ContentItemId":"item-1"}
              if (geoJsonString) { }
            }
          </script>
        </html>
      `;

      const incidents = parseIncidents(html);
      expect(incidents).toHaveLength(1);
      expect(incidents[0].geoJson.type).toBe("FeatureCollection");
    });

    it("should fix swapped coordinates via validateAndFixGeoJSON", () => {
      const html = `
        <html>
          <script>
            function parseAll() {
              var geoJsonString = '[{"type":"Feature","geometry":{"type":"Point","coordinates":[42.7,23.32]},"properties":{}}]'
              var info = {"AccidentId":"acc-1","Name":"Swapped Coords","Addresses":"Test St","GeolocationSerialized":"","Type":1,"Status":1,"FromDate":"2025-01-01T10:00:00","UntilDate":null,"AffectedService":null,"Region":"Sofia","Locally":false,"CreatedOn":"2025-01-01T09:00:00","ContentItemId":"item-1"}
              if (geoJsonString) { }
            }
          </script>
        </html>
      `;

      const incidents = parseIncidents(html);
      expect(incidents).toHaveLength(1);
      // Coordinates should be fixed from [42.7, 23.32] to [23.32, 42.7]
      const coords = (incidents[0].geoJson.features[0].geometry as any)
        .coordinates;
      expect(coords).toEqual([23.32, 42.7]);
    });

    it("should handle LineString geometry", () => {
      const html = `
        <html>
          <script>
            function parseAll() {
              var geoJsonString = '[{"type":"Feature","geometry":{"type":"LineString","coordinates":[[23.32,42.7],[23.33,42.71]]},"properties":{}}]'
              var info = {"AccidentId":"acc-1","Name":"Line Incident","Addresses":"Test St","GeolocationSerialized":"","Type":1,"Status":1,"FromDate":"2025-01-01T10:00:00","UntilDate":null,"AffectedService":null,"Region":"Sofia","Locally":false,"CreatedOn":"2025-01-01T09:00:00","ContentItemId":"item-1"}
              if (geoJsonString) { }
            }
          </script>
        </html>
      `;

      const incidents = parseIncidents(html);
      expect(incidents).toHaveLength(1);
      expect(incidents[0].geoJson.features[0].geometry.type).toBe("LineString");
    });
  });
});
