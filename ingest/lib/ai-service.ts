import type { ExtractedData } from "./types";
import type { CategorizationResult } from "./categorize.schema";
import type { IngestErrorRecorder } from "./ingest-errors";
import { logger } from "@/lib/logger";
import { GeminiMockService } from "../__mocks__/services/gemini-mock-service";
import {
  validateText,
  validateModelConfig,
  sanitizeText,
} from "./ai-validation";
import {
  parseCategorizationResponse,
  parseExtractionResponse,
} from "./ai-response-parser";
import { getCategorizePrompt, getExtractionPrompt } from "./ai-prompts";
import { callGeminiApi } from "./ai-client";

// Check if mocking is enabled
const USE_MOCK = process.env.MOCK_GEMINI_API === "true";
const mockService = USE_MOCK ? new GeminiMockService() : null;

export async function categorize(
  text: string,
  ingestErrors?: IngestErrorRecorder,
): Promise<CategorizationResult | null> {
  // Use mock if enabled
  if (USE_MOCK && mockService) {
    logger.info("Using Gemini mock for categorization");
    return mockService.categorize(text);
  }

  // Validate input text
  if (
    !validateText(
      text,
      { maxLength: 10000, purpose: "message categorization" },
      ingestErrors,
    )
  ) {
    return null;
  }

  // Validate model configuration
  const modelConfig = validateModelConfig(ingestErrors);
  if (!modelConfig.isValid) {
    return null;
  }

  // Call Gemini API
  const responseText = await callGeminiApi(
    {
      model: modelConfig.model!,
      contents: text,
      systemInstruction: getCategorizePrompt(),
    },
    ingestErrors,
  );

  if (!responseText) {
    return null;
  }

  // Parse and validate response
  return parseCategorizationResponse(responseText, ingestErrors);
}

export async function extractStructuredData(
  text: string,
  ingestErrors?: IngestErrorRecorder,
): Promise<ExtractedData | null> {
  // Use mock if enabled
  if (USE_MOCK && mockService) {
    logger.info("Using Gemini mock for extraction");
    return mockService.extractStructuredData(text);
  }

  // Validate input text
  if (
    !validateText(
      text,
      { maxLength: 5000, purpose: "data extraction" },
      ingestErrors,
    )
  ) {
    return null;
  }

  // Sanitize input to prevent prompt injection
  const sanitizedText = sanitizeText(text);

  // Validate model configuration
  const modelConfig = validateModelConfig(ingestErrors);
  if (!modelConfig.isValid) {
    return null;
  }

  // Call Gemini API
  const responseText = await callGeminiApi(
    {
      model: modelConfig.model!,
      contents: sanitizedText,
      systemInstruction: getExtractionPrompt(),
    },
    ingestErrors,
  );

  if (!responseText) {
    return null;
  }

  // Parse and validate response
  return parseExtractionResponse(responseText, ingestErrors);
}

// Legacy export for backward compatibility
export const extractAddresses = extractStructuredData;
