import { describe, expect, it } from "vitest";
import { toploHtml } from "@/__mocks__/source-contract-fixtures";
import { countListingIncidents } from "./listing";

describe("countListingIncidents", () => {
  it("counts distinct listed incidents, including repairs", () => {
    const html = toploHtml(["one", "two", "one"]).replace('"Type":1', '"Type":0');

    expect(countListingIncidents(html)).toBe(2);
  });

  it("keeps listed entries whose expected restoration date has passed", () => {
    const html = toploHtml(["one"]).replace(
      '"UntilDate":null',
      '"UntilDate":"2025-01-01T00:00:00Z"',
    );

    expect(countListingIncidents(html)).toBe(1);
  });

  it("counts incidents independently of their map geometry", () => {
    const html = toploHtml(["one", "two"]).replaceAll(
      /var geoJsonString = '[^']*'/g,
      "var geoJsonString = ''",
    );

    expect(countListingIncidents(html)).toBe(2);
  });

  it("accepts a complete empty listing", () => {
    expect(countListingIncidents(toploHtml([]))).toBe(0);
  });

  it.each([
    "<html><body>Service unavailable</body></html>",
    toploHtml([]).replace('id="accidentMap"', 'id="other"'),
    toploHtml([]).replace("function parseAll()", "function other()"),
    toploHtml([]).replace("accident-list-homepage", "other"),
    toploHtml([]).replace("</html>", ""),
  ])("rejects an unrecognized or incomplete page", (html) => {
    expect(() => countListingIncidents(html)).toThrow();
  });

  it("rejects partially parsed incident metadata", () => {
    const html = toploHtml(["one", "two"]).replace(
      '"ContentItemId":"two"',
      '"ContentItemId":invalid',
    );

    expect(() => countListingIncidents(html)).toThrow();
  });

  it("rejects missing incident identities", () => {
    const html = toploHtml(["one"]).replace('"ContentItemId":"one"', '"ContentItemId":""');

    expect(() => countListingIncidents(html)).toThrow();
  });

  it("rejects an incident block whose structure has changed", () => {
    const html = toploHtml(["one", "two"]).replace(
      /if \(geoJsonString\)/,
      "if (changedCondition)",
    );

    expect(() => countListingIncidents(html)).toThrow();
  });

  it("rejects a mismatch between the visible list and metadata", () => {
    const html = toploHtml(["one", "two"]).replace(
      'data-accidentId="two"',
      'data-accidentId="unexpected"',
    );

    expect(() => countListingIncidents(html)).toThrow();
  });

  it("rejects a listing row without an identity", () => {
    const html = toploHtml(["one"]).replace('data-accidentId="one"', "");

    expect(() => countListingIncidents(html)).toThrow();
  });
});
