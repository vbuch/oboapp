import { describe, expect, it } from "vitest";
import { stripHtmlTags } from "./html-utils";

describe("stripHtmlTags", () => {
  it("removes tags by default", () => {
    expect(stripHtmlTags("<p>Hello</p><strong>World</strong>")).toBe(
      "HelloWorld",
    );
  });

  it("uses replacement token when provided", () => {
    expect(stripHtmlTags("<p>Hello</p><strong>World</strong>", " ")).toBe(
      " Hello  World ",
    );
  });

  it("keeps non-tag angle bracket content", () => {
    expect(stripHtmlTags("2 > 1 and 1 < 2")).toBe("2 > 1 and 1 < 2");
  });

  it("handles malformed trailing tag", () => {
    expect(stripHtmlTags("before <broken")).toBe("before ");
  });
});
