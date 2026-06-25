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

  it("rejects ranges and slash-separated house numbers", () => {
    expect(isHouseNumberEndpoint("12/14")).toBe(false);
    expect(isHouseNumberEndpoint("12-14")).toBe(false);
  });

  it("accepts Bulgarian house-number markers", () => {
    expect(isHouseNumberEndpoint("№111")).toBe(true);
    expect(isHouseNumberEndpoint("№ 38")).toBe(true);
    expect(isHouseNumberEndpoint("бл. 38")).toBe(true);
    expect(isHouseNumberEndpoint("номер 3")).toBe(true);
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
