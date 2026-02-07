import { describe, it, expect } from "vitest";
import { buildMessageResponse } from "./build-response";
import type { Address, GeoJSONFeatureCollection } from "@/lib/types";

describe(buildMessageResponse, () => {
  const mockAddress: Address = {
    originalText: "Test Street 123",
    formattedAddress: "Test Street 123, City",
    coordinates: { lat: 42, lng: 23 },
  };

  const mockGeoJson: GeoJSONFeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [23, 42] },
        properties: { address: "Test Street 123" },
      },
    ],
  };

  it("should build response with all fields", async () => {
    const result = await buildMessageResponse(
      "msg-123",
      "Test message",
      [mockAddress],
      mockGeoJson,
    );

    expect(result).toMatchObject({
      id: "msg-123",
      text: "Test message",
      addresses: [mockAddress],
      geoJson: mockGeoJson,
    });
    expect(result.createdAt).toBeDefined();
  });

  it("should convert null geoJson to undefined", async () => {
    const result = await buildMessageResponse(
      "msg-123",
      "Test message",
      [mockAddress],
      null,
    );

    expect(result.geoJson).toBeUndefined();
  });

  it("should handle empty addresses array", async () => {
    const result = await buildMessageResponse("msg-123", "Test message", [], null);

    expect(result.addresses).toEqual([]);
    expect(result.geoJson).toBeUndefined();
  });

  it("should not include extractedData on the response", async () => {
    const result = await buildMessageResponse(
      "msg-123",
      "Test message",
      [mockAddress],
      mockGeoJson,
    );

    expect(result).not.toHaveProperty("extractedData");
  });

  it("should generate a valid ISO timestamp for createdAt", async () => {
    const result = await buildMessageResponse("msg-123", "Test message", [], null);

    const date = new Date(result.createdAt);
    expect(date.toISOString()).toBe(result.createdAt);
  });

  it("should preserve input data by reference", async () => {
    const addresses = [mockAddress];
    const result = await buildMessageResponse(
      "msg-456",
      "Another message",
      addresses,
      mockGeoJson,
    );

    expect(result.id).toBe("msg-456");
    expect(result.text).toBe("Another message");
    expect(result.addresses).toBe(addresses);
    expect(result.geoJson).toBe(mockGeoJson);
  });
});
