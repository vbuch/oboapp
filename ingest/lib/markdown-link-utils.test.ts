import { describe, expect, it } from "vitest";
import { hasMarkdownInlineLink } from "./markdown-link-utils";

describe("hasMarkdownInlineLink", () => {
  it("returns true for a markdown inline link", () => {
    expect(hasMarkdownInlineLink("[линк](https://example.com)")).toBe(true);
  });

  it("returns false when there is no markdown link", () => {
    expect(hasMarkdownInlineLink("обикновен текст без линк")).toBe(false);
  });

  it("returns false for incomplete markdown link syntax", () => {
    expect(hasMarkdownInlineLink("[линк](https://example.com")).toBe(false);
  });

  it("returns true when at least one valid markdown inline link exists", () => {
    expect(
      hasMarkdownInlineLink("[broken](https://example.com [ok](https://x.y)"),
    ).toBe(true);
  });
});
