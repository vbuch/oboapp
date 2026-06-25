import { describe, expect, it } from "vitest";
import { isHouseNumberEndpoint } from "./house-number";

describe("isHouseNumberEndpoint", () => {
  it("accepts plain numeric house numbers", () => {
    expect(isHouseNumberEndpoint("12")).toBe(true);
  });

  it("accepts numeric house numbers with suffix letters", () => {
    expect(isHouseNumberEndpoint("12A")).toBe(true);
    expect(isHouseNumberEndpoint("12Б")).toBe(true);
  });

  it("accepts ranges and slash-separated house numbers", () => {
    expect(isHouseNumberEndpoint("12/14")).toBe(true);
    expect(isHouseNumberEndpoint("12-14")).toBe(true);
  });

  it("rejects ordinal street names with digits", () => {
    expect(isHouseNumberEndpoint("6-ти")).toBe(false);
    expect(isHouseNumberEndpoint("6-ти септември")).toBe(false);
  });

  it("rejects non-house-number endpoints", () => {
    expect(isHouseNumberEndpoint("Орлов мост")).toBe(false);
    expect(isHouseNumberEndpoint("бул. България")).toBe(false);
    expect(isHouseNumberEndpoint(" ")).toBe(false);
  });
});
