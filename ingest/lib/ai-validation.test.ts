import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  validateText,
  validateModelConfig,
  sanitizeText,
} from "./ai-validation";

describe("ai-validation", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("validateText", () => {
    it("should validate valid text", () => {
      const result = validateText("test message", {
        maxLength: 100,
        purpose: "test",
      });
      expect(result).toBe(true);
    });

    it("should reject null text", () => {
      const errors: string[] = [];
      const mockRecorder = {
        error: (msg: string) => errors.push(msg),
        warn: () => {},
        exception: () => {},
      };
      const result = validateText(
        null,
        { maxLength: 100, purpose: "test" },
        mockRecorder,
      );
      expect(result).toBe(false);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Invalid text parameter");
    });

    it("should reject non-string text", () => {
      const errors: string[] = [];
      const mockRecorder = {
        error: (msg: string) => errors.push(msg),
        warn: () => {},
        exception: () => {},
      };
      const result = validateText(
        123,
        { maxLength: 100, purpose: "test" },
        mockRecorder,
      );
      expect(result).toBe(false);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Invalid text parameter");
    });

    it("should reject text exceeding max length", () => {
      const errors: string[] = [];
      const mockRecorder = {
        error: (msg: string) => errors.push(msg),
        warn: () => {},
        exception: () => {},
      };
      const longText = "a".repeat(101);
      const result = validateText(
        longText,
        { maxLength: 100, purpose: "test" },
        mockRecorder,
      );
      expect(result).toBe(false);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("too long");
      expect(errors[0]).toContain("max 100 characters");
    });

    it("should accept text at exactly max length", () => {
      const text = "a".repeat(100);
      const result = validateText(text, { maxLength: 100, purpose: "test" });
      expect(result).toBe(true);
    });
  });

  describe("validateModelConfig", () => {
    it("should validate when GOOGLE_AI_MODEL is set", () => {
      process.env.GOOGLE_AI_MODEL = "gemini-1.5-flash";
      const result = validateModelConfig();
      expect(result.isValid).toBe(true);
      expect(result.model).toBe("gemini-1.5-flash");
    });

    it("should reject when GOOGLE_AI_MODEL is not set", () => {
      delete process.env.GOOGLE_AI_MODEL;
      const errors: string[] = [];
      const mockRecorder = {
        error: (msg: string) => errors.push(msg),
        warn: () => {},
        exception: () => {},
      };
      const result = validateModelConfig(mockRecorder);
      expect(result.isValid).toBe(false);
      expect(result.model).toBeUndefined();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("GOOGLE_AI_MODEL");
    });

    it("should reject empty GOOGLE_AI_MODEL", () => {
      process.env.GOOGLE_AI_MODEL = "";
      const errors: string[] = [];
      const mockRecorder = {
        error: (msg: string) => errors.push(msg),
        warn: () => {},
        exception: () => {},
      };
      const result = validateModelConfig(mockRecorder);
      expect(result.isValid).toBe(false);
      expect(errors).toHaveLength(1);
    });
  });

  describe("sanitizeText", () => {
    it("should replace newlines with spaces", () => {
      const text = "line1\nline2\nline3";
      const result = sanitizeText(text);
      expect(result).toBe("line1 line2 line3");
    });

    it("should replace carriage returns with spaces", () => {
      const text = "line1\rline2\rline3";
      const result = sanitizeText(text);
      expect(result).toBe("line1 line2 line3");
    });

    it("should handle mixed line endings", () => {
      const text = "line1\r\nline2\nline3\rline4";
      const result = sanitizeText(text);
      expect(result).toBe("line1  line2 line3 line4");
    });

    it("should trim whitespace", () => {
      const text = "  test message  ";
      const result = sanitizeText(text);
      expect(result).toBe("test message");
    });

    it("should handle text with no line endings", () => {
      const text = "simple text";
      const result = sanitizeText(text);
      expect(result).toBe("simple text");
    });
  });
});
