import { describe, expect, it } from "vitest";
import { buildWebPageSourceDocument } from "./webpage-crawlers";

describe("shared/webpage-crawlers", () => {
  describe("buildWebPageSourceDocument", () => {
    it("should build source document with HTML to Markdown conversion", () => {
      const doc = buildWebPageSourceDocument(
        "https://example.com/post",
        "Test Title",
        "15 декември 2025",
        "<h2>Heading</h2><p>Paragraph</p>",
        "test-source"
      );

      expect(doc.url).toBe("https://example.com/post");
      expect(doc.title).toBe("Test Title");
      expect(doc.sourceType).toBe("test-source");
      expect(doc.message).toContain("Heading");
      expect(doc.message).toContain("Paragraph");
      expect(doc.datePublished).toBeTruthy();
    });

    it("should throw error for empty title", () => {
      expect(() =>
        buildWebPageSourceDocument(
          "https://example.com/post",
          "",
          "1 януари 2025",
          "<p>Content</p>",
          "test-source"
        )
      ).toThrow("Failed to extract title");
    });

    it("should throw error for empty content", () => {
      expect(() =>
        buildWebPageSourceDocument(
          "https://example.com/post",
          "Title",
          "1 януари 2025",
          "",
          "test-source"
        )
      ).toThrow("Failed to extract content");
    });

    it("should handle complex HTML", () => {
      const html = `
        <div>
          <h1>Main Title</h1>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
          <p>Text with <strong>bold</strong> and <em>italic</em></p>
        </div>
      `;

      const doc = buildWebPageSourceDocument(
        "https://example.com/post",
        "Test",
        "1 януари 2025",
        html,
        "test-source"
      );

      expect(doc.message).toContain("Main Title");
      expect(doc.message).toContain("Item 1");
      expect(doc.message).toContain("**bold**");
      expect(doc.message).toContain("_italic_"); // Turndown uses underscores for emphasis
    });
  });
});
