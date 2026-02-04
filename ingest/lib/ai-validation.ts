import type { IngestErrorRecorder } from "./ingest-errors";
import { getIngestErrorRecorder } from "./ingest-errors";

export interface TextValidationOptions {
  readonly maxLength: number;
  readonly purpose: string;
}

export interface ModelConfigValidation {
  readonly isValid: boolean;
  readonly model?: string;
}

/**
 * Validates text input for AI processing
 */
export function validateText(
  text: unknown,
  options: TextValidationOptions,
  ingestErrors?: IngestErrorRecorder,
): boolean {
  const recorder = getIngestErrorRecorder(ingestErrors);

  if (!text || typeof text !== "string") {
    recorder.error(`Invalid text parameter for ${options.purpose}`);
    return false;
  }

  if (text.length > options.maxLength) {
    recorder.error(
      `Text is too long for ${options.purpose} (max ${options.maxLength} characters)`,
    );
    return false;
  }

  return true;
}

/**
 * Validates and retrieves AI model configuration
 */
export function validateModelConfig(
  ingestErrors?: IngestErrorRecorder,
): ModelConfigValidation {
  const recorder = getIngestErrorRecorder(ingestErrors);
  const model = process.env.GOOGLE_AI_MODEL;

  if (!model) {
    recorder.error("GOOGLE_AI_MODEL environment variable is not set");
    return { isValid: false };
  }

  return { isValid: true, model };
}

/**
 * Sanitizes text to prevent prompt injection
 */
export function sanitizeText(text: string): string {
  return text.replace(/[\n\r]/g, " ").trim();
}
