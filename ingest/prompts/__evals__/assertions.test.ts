import { describe, expect, it } from "vitest";
import { assertNoLinks } from "./assertions";

describe("assertNoLinks", () => {
  it("passes when plainText and markdownText do not contain links", () => {
    const output = JSON.stringify([
      {
        plainText: "Съобщение без линков",
        markdownText: "Съобщение без линков",
      },
    ]);

    const result = assertNoLinks(output, {});

    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it("fails when markdown inline links are present", () => {
    const output = JSON.stringify([
      {
        plainText: "Текст",
        markdownText: "[линк](https://example.com)",
      },
    ]);

    const result = assertNoLinks(output, {});

    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toContain("contains a link");
  });

  it("fails when bare URLs are present", () => {
    const output = JSON.stringify([
      {
        plainText: "Виж https://example.com",
        markdownText: "Текст",
      },
    ]);

    const result = assertNoLinks(output, {});

    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toContain("contains a link");
  });

  it("fails when reference-style links are present", () => {
    const output = JSON.stringify([
      {
        plainText: "[ref]: https://example.com",
        markdownText: "Текст",
      },
    ]);

    const result = assertNoLinks(output, {});

    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toContain("contains a link");
  });
});
