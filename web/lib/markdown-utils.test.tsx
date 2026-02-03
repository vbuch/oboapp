import { describe, it, expect } from "vitest";
import { stripMarkdown } from "./markdown-utils";

describe("stripMarkdown", () => {
  it("should remove bold markers", () => {
    expect(stripMarkdown("**bold text**")).toBe("bold text");
    expect(stripMarkdown("__bold text__")).toBe("bold text");
  });

  it("should remove italic markers", () => {
    expect(stripMarkdown("*italic text*")).toBe("italic text");
    expect(stripMarkdown("_italic text_")).toBe("italic text");
  });

  it("should remove mixed bold and italic", () => {
    expect(stripMarkdown("**bold** and *italic*")).toBe("bold and italic");
  });

  it("should remove headers", () => {
    expect(stripMarkdown("# Header 1")).toBe("Header 1");
    expect(stripMarkdown("## Header 2")).toBe("Header 2");
    expect(stripMarkdown("### Header 3")).toBe("Header 3");
  });

  it("should remove links but keep text", () => {
    expect(stripMarkdown("[link text](http://example.com)")).toBe("link text");
  });

  it("should remove inline code", () => {
    expect(stripMarkdown("Use `code` here")).toBe("Use code here");
  });

  it("should remove list markers", () => {
    expect(stripMarkdown("- item 1\n- item 2")).toBe("item 1 item 2");
    expect(stripMarkdown("* item 1\n* item 2")).toBe("item 1 item 2");
    expect(stripMarkdown("1. item 1\n2. item 2")).toBe("item 1 item 2");
  });

  it("should handle erm-zapad message format", () => {
    const input =
      "**непланирано**\n\n**Населено място:** кв. СИМЕОНОВО\n**Начало:** 02.01.2026 10:10\n**Край:** 02.01.2026 12:00\n**Мрежов код:** SF_5267_04";
    const result = stripMarkdown(input);
    // Should strip all markdown and normalize whitespace
    expect(result).toContain("непланирано");
    expect(result).toContain("Населено място:");
    expect(result).toContain("SF_5267_04");
    expect(result).not.toContain("**");
  });

  it("should handle toplo-bg message format", () => {
    const input =
      'Част от Дианабад\n\n2 януари 2026 г. в 12:50\nбл. 32, 33, 33А,61; ул. "Крум Кюлявков" № 25, бул. "Г. М. Димитров" № 58\n\nОчаквано възстановяване на 4 януари 2026 г. в 12:50';
    const result = stripMarkdown(input);
    // Whitespace is normalized to single spaces, quotes are decoded to plain text
    expect(result).toBe(
      'Част от Дианабад 2 януари 2026 г. в 12:50 бл. 32, 33, 33А,61; ул. "Крум Кюлявков" № 25, бул. "Г. М. Димитров" № 58 Очаквано възстановяване на 4 януари 2026 г. в 12:50',
    );
  });

  it("should normalize excessive newlines", () => {
    const result = stripMarkdown("Line 1\n\n\n\nLine 2");
    expect(result).toContain("Line 1");
    expect(result).toContain("Line 2");
  });

  it("should trim whitespace", () => {
    expect(stripMarkdown("  **bold**  ")).toBe("bold");
  });

  it("should handle empty string", () => {
    expect(stripMarkdown("")).toBe("");
  });

  it("should handle text without markdown", () => {
    const plain = "Just plain text with no formatting";
    expect(stripMarkdown(plain)).toBe(plain);
  });

  it("should decode HTML entities", () => {
    expect(stripMarkdown("Text with &quot;quotes&quot;")).toBe(
      'Text with "quotes"',
    );
    expect(stripMarkdown("It&apos;s working")).toBe("It's working");
  });

  it("should decode special character entities", () => {
    expect(stripMarkdown("Less &lt; Greater &gt;")).toBe("Less < Greater >");
    expect(stripMarkdown("Non&nbsp;breaking&nbsp;space")).toBe(
      "Non breaking space",
    );
  });

  it("should decode euro symbol", () => {
    expect(stripMarkdown("Price: &euro;100")).toBe("Price: €100");
  });
});
