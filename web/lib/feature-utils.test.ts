import { describe, it, expect } from "vitest";
import {
  extractFeaturesFromMessages,
  filterUnclusteredFeatures,
  FeatureData,
} from "./feature-utils";
import { Message } from "@/lib/types";

describe("feature-utils", () => {
  describe("extractFeaturesFromMessages", () => {
    it("should extract features from valid messages", () => {
      const messages: Message[] = [
        {
          id: "msg1",
          locality: "bg.sofia",
          text: "Test message",
          createdAt: "2024-01-01",
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [23.3219, 42.6977], // Sofia coordinates
                },
                properties: {
                  address: "Test Address",
                },
              },
              {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [23.3219, 42.6977],
                    [23.3229, 42.6987],
                  ],
                },
                properties: {
                  street_name: "Test Street",
                },
              },
            ],
          },
        },
        {
          id: "msg2",
          locality: "bg.sofia",
          text: "Another message",
          createdAt: "2024-01-02",
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [23.321, 42.697],
                      [23.322, 42.697],
                      [23.322, 42.698],
                      [23.321, 42.698],
                      [23.321, 42.697],
                    ],
                  ],
                },
                properties: {
                  name: "Test Area",
                },
              },
            ],
          },
        },
      ];

      const features = extractFeaturesFromMessages(messages);

      expect(features).toHaveLength(3);

      // Check first feature (Point)
      expect(features[0]).toEqual({
        messageId: "msg1",
        featureIndex: 0,
        geometry: {
          type: "Point",
          coordinates: [23.3219, 42.6977],
        },
        properties: {
          address: "Test Address",
        },
        centroid: {
          lat: 42.6977,
          lng: 23.3219,
        },
        classification: "archived",
      });

      // Check second feature (LineString)
      expect(features[1]).toEqual({
        messageId: "msg1",
        featureIndex: 1,
        geometry: {
          type: "LineString",
          coordinates: [
            [23.3219, 42.6977],
            [23.3229, 42.6987],
          ],
        },
        properties: {
          street_name: "Test Street",
        },
        centroid: expect.objectContaining({
          lat: expect.any(Number),
          lng: expect.any(Number),
        }),
        classification: "archived",
      });

      // Check third feature (Polygon)
      expect(features[2]).toEqual({
        messageId: "msg2",
        featureIndex: 0,
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [23.321, 42.697],
              [23.322, 42.697],
              [23.322, 42.698],
              [23.321, 42.698],
              [23.321, 42.697],
            ],
          ],
        },
        properties: {
          name: "Test Area",
        },
        centroid: expect.objectContaining({
          lat: expect.any(Number),
          lng: expect.any(Number),
        }),
        classification: "archived",
      });
    });

    it("should handle messages without geoJson", () => {
      const messages: Message[] = [
        {
          id: "msg1",
          locality: "bg.sofia",
          text: "Message without geoJson",
          createdAt: "2024-01-01",
        },
        {
          id: "msg2",
          locality: "bg.sofia",
          text: "Another message",
          createdAt: "2024-01-02",
          geoJson: undefined,
        },
      ];

      const features = extractFeaturesFromMessages(messages);

      expect(features).toHaveLength(0);
    });

    it("should handle messages without features", () => {
      const messages: Message[] = [
        {
          id: "msg1",
          locality: "bg.sofia",
          text: "Message with empty features",
          createdAt: "2024-01-01",
          geoJson: {
            type: "FeatureCollection",
            features: [],
          },
        },
      ];

      const features = extractFeaturesFromMessages(messages);

      expect(features).toHaveLength(0);
    });

    it("should handle features with invalid geometry", () => {
      const messages: Message[] = [
        {
          id: "msg1",
          locality: "bg.sofia",
          text: "Message with invalid geometry",
          createdAt: "2024-01-01",
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: null as any,
                properties: {},
              },
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [],
                } as any,
                properties: {},
              },
            ],
          },
        },
      ];

      const features = extractFeaturesFromMessages(messages);

      expect(features).toHaveLength(0);
    });

    it("should handle messages without id", () => {
      const messages: Message[] = [
        {
          locality: "bg.sofia",
          text: "Message without id",
          createdAt: "2024-01-01",
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [23.3219, 42.6977],
                },
                properties: {},
              },
            ],
          },
        },
      ];

      const features = extractFeaturesFromMessages(messages);

      expect(features).toHaveLength(1);
      expect(features[0].messageId).toBe("unknown");
    });

    it("should handle features without properties", () => {
      const messages: Message[] = [
        {
          id: "msg1",
          locality: "bg.sofia",
          text: "Test message",
          createdAt: "2024-01-01",
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [23.3219, 42.6977],
                },
                properties: null as any,
              },
            ],
          },
        },
      ];

      const features = extractFeaturesFromMessages(messages);

      expect(features).toHaveLength(1);
      expect(features[0].properties).toEqual({});
    });

    it("should handle empty messages array", () => {
      const features = extractFeaturesFromMessages([]);

      expect(features).toHaveLength(0);
    });

    it("should throw error for invalid input", () => {
      expect(() => extractFeaturesFromMessages(null as any)).toThrow(
        "Invalid input: messages must be an array"
      );
      expect(() => extractFeaturesFromMessages("not an array" as any)).toThrow(
        "Invalid input: messages must be an array"
      );
    });

    it("should handle null messages in array", () => {
      const messages: Message[] = [
        null as any,
        {
          id: "msg1",
          text: "Valid message",
          createdAt: "2024-01-01",
          geoJson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [23.3219, 42.6977],
                },
                properties: {},
              },
            ],
          },
        },
      ];

      const features = extractFeaturesFromMessages(messages);

      expect(features).toHaveLength(1);
      expect(features[0].messageId).toBe("msg1");
    });
  });

  describe("filterUnclusteredFeatures", () => {
    const mockFeatures: FeatureData[] = [
      {
        messageId: "msg1",
        featureIndex: 0,
        geometry: {
          type: "Point",
          coordinates: [23.3219, 42.6977],
        },
        properties: { address: "Address 1" },
        centroid: { lat: 42.6977, lng: 23.3219 },
        classification: "archived" as const,
      },
      {
        messageId: "msg1",
        featureIndex: 1,
        geometry: {
          type: "Point",
          coordinates: [23.3229, 42.6987],
        },
        properties: { address: "Address 2" },
        centroid: { lat: 42.6987, lng: 23.3229 },
        classification: "archived" as const,
      },
      {
        messageId: "msg2",
        featureIndex: 0,
        geometry: {
          type: "LineString",
          coordinates: [
            [23.3219, 42.6977],
            [23.3229, 42.6987],
          ],
        },
        properties: { street_name: "Street 1" },
        centroid: { lat: 42.6982, lng: 23.3224 },
        classification: "archived" as const,
      },
    ];

    it("should filter features based on unclustered keys", () => {
      const unclusteredKeys = new Set(["msg1-0", "msg2-0"]);

      const filtered = filterUnclusteredFeatures(mockFeatures, unclusteredKeys);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].messageId).toBe("msg1");
      expect(filtered[0].featureIndex).toBe(0);
      expect(filtered[1].messageId).toBe("msg2");
      expect(filtered[1].featureIndex).toBe(0);
    });

    it("should return empty array when no keys match", () => {
      const unclusteredKeys = new Set(["nonexistent-key"]);

      const filtered = filterUnclusteredFeatures(mockFeatures, unclusteredKeys);

      expect(filtered).toHaveLength(0);
    });

    it("should return all features when all keys are unclustered", () => {
      const unclusteredKeys = new Set(["msg1-0", "msg1-1", "msg2-0"]);

      const filtered = filterUnclusteredFeatures(mockFeatures, unclusteredKeys);

      expect(filtered).toHaveLength(3);
    });

    it("should handle empty features array", () => {
      const unclusteredKeys = new Set(["msg1-0"]);

      const filtered = filterUnclusteredFeatures([], unclusteredKeys);

      expect(filtered).toHaveLength(0);
    });

    it("should handle empty unclustered keys set", () => {
      const unclusteredKeys = new Set<string>();

      const filtered = filterUnclusteredFeatures(mockFeatures, unclusteredKeys);

      expect(filtered).toHaveLength(0);
    });

    it("should throw error for invalid features input", () => {
      const unclusteredKeys = new Set(["msg1-0"]);

      expect(() =>
        filterUnclusteredFeatures(null as any, unclusteredKeys)
      ).toThrow("Invalid input: features must be an array");
      expect(() =>
        filterUnclusteredFeatures("not an array" as any, unclusteredKeys)
      ).toThrow("Invalid input: features must be an array");
    });

    it("should throw error for invalid unclusteredKeys input", () => {
      expect(() =>
        filterUnclusteredFeatures(mockFeatures, null as any)
      ).toThrow("Invalid input: unclusteredKeys must be a Set");
      expect(() => filterUnclusteredFeatures(mockFeatures, [] as any)).toThrow(
        "Invalid input: unclusteredKeys must be a Set"
      );
    });

    it("should preserve feature data integrity", () => {
      const unclusteredKeys = new Set(["msg1-0"]);

      const filtered = filterUnclusteredFeatures(mockFeatures, unclusteredKeys);

      expect(filtered[0]).toEqual(mockFeatures[0]);
      expect(filtered[0]).toBe(mockFeatures[0]); // Should be same object reference for performance
    });
  });
});
