import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExtractedData } from "./types";
import {
  CategorizationResponseSchema,
  CategorizationResult,
} from "./categorize.schema";
import {
  formatIngestErrorText,
  getIngestErrorRecorder,
  truncateIngestPayload,
  type IngestErrorRecorder,
} from "./ingest-errors";
import { GeminiMockService } from "../__mocks__/services/gemini-mock-service";

// Check if mocking is enabled
const USE_MOCK = process.env.MOCK_GEMINI_API === "true";
const mockService = USE_MOCK ? new GeminiMockService() : null;

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || "" });
const MAX_INGEST_ERROR_LENGTH = 1000;

// Read the message categorization prompt template
let categorizeSystemInstruction: string;
try {
  categorizeSystemInstruction = readFileSync(
    join(process.cwd(), "prompts/categorize.md"),
    "utf-8",
  );
} catch (error) {
  console.error(
    "Failed to load message categorization prompt template:",
    error,
  );
  throw new Error("Message categorization prompt template file not found");
}

// Read the data extraction prompt template
// Uses Overpass-optimized prompt for hybrid geocoding (Google for pins, Overpass for streets)
let extractionSystemInstruction: string;
try {
  extractionSystemInstruction = readFileSync(
    join(process.cwd(), "prompts/data-extraction-overpass.md"),
    "utf-8",
  );
} catch (error) {
  console.error("Failed to load data extraction prompt template:", error);
  throw new Error("Data extraction prompt template file not found");
}

export async function categorize(
  text: string,
  ingestErrors?: IngestErrorRecorder,
): Promise<CategorizationResult | null> {
  // Use mock if enabled
  if (USE_MOCK && mockService) {
    console.log("[MOCK] Using Gemini mock for categorization");
    return mockService.categorize(text);
  }

  const recorder = getIngestErrorRecorder(ingestErrors);
  try {
    // Validate message
    if (!text || typeof text !== "string") {
      recorder.error("Invalid text parameter for message categorization");
      return null;
    }

    // Validate message length
    if (text.length > 10000) {
      recorder.error(
        "Text is too long for message categorization (max 10000 characters)",
      );
      return null;
    }

    // Validate required environment variable
    const model = process.env.GOOGLE_AI_MODEL;
    if (!model) {
      recorder.error("GOOGLE_AI_MODEL environment variable is not set");
      return null;
    }

    // Make request to Gemini API
    const response = await ai.models.generateContent({
      model: model,
      contents: text,
      config: {
        systemInstruction: categorizeSystemInstruction,
        responseMimeType: "application/json",
      },
    });
    const responseText = response.text || "";

    try {
      // Parse the JSON response
      const parsedResponse = JSON.parse(responseText);

      // Strict validation using Zod schema - fails fast on any validation error
      const validatedResponse =
        CategorizationResponseSchema.parse(parsedResponse);

      return validatedResponse;
    } catch (parseError) {
      recorder.error(
        `Failed to parse or validate JSON response from AI: ${formatIngestErrorText(
          parseError,
        )}`,
      );
      const responseSummary = truncateIngestPayload(
        responseText,
        MAX_INGEST_ERROR_LENGTH,
      );
      recorder.error(
        `Full AI response (${responseSummary.originalLength} chars): ${responseSummary.summary}`,
      );
      return null;
    }
  } catch (error) {
    recorder.error(
      `Error categorizing message: ${formatIngestErrorText(error)}`,
    );
    return null;
  }
}

export async function extractStructuredData(
  text: string,
  ingestErrors?: IngestErrorRecorder,
): Promise<ExtractedData | null> {
  // Use mock if enabled
  if (USE_MOCK && mockService) {
    console.log("[MOCK] Using Gemini mock for extraction");
    return mockService.extractStructuredData(text);
  }

  const recorder = getIngestErrorRecorder(ingestErrors);
  try {
    // Validate message
    if (!text || typeof text !== "string") {
      recorder.error("Invalid text parameter for data extraction");
      return null;
    }

    // Validate message length
    if (text.length > 5000) {
      recorder.error(
        "Text is too long for data extraction (max 5000 characters)",
      );
      return null;
    }

    // Sanitize input to prevent prompt injection
    const sanitizedText = text.replace(/[\n\r]/g, " ").trim();

    // Validate required environment variable
    const model = process.env.GOOGLE_AI_MODEL;
    if (!model) {
      recorder.error("GOOGLE_AI_MODEL environment variable is not set");
      return null;
    }

    // Make request to Gemini API
    const response = await ai.models.generateContent({
      model: model,
      contents: sanitizedText,
      config: {
        systemInstruction: extractionSystemInstruction,
        responseMimeType: "application/json",
      },
    });
    const responseText = response.text || "";

    // Parse the JSON response to extract the full structured data
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsedResponse = JSON.parse(jsonMatch[0]);

        // Validate and filter pins array
        const validPins = Array.isArray(parsedResponse.pins)
          ? parsedResponse.pins
              .filter(
                (pin: unknown): pin is Record<string, unknown> =>
                  pin !== null &&
                  typeof pin === "object" &&
                  "address" in pin &&
                  typeof (pin as Record<string, unknown>)["address"] ===
                    "string" &&
                  ((pin as Record<string, unknown>)["address"] as string).trim()
                    .length > 0 &&
                  "timespans" in pin &&
                  Array.isArray((pin as Record<string, unknown>)["timespans"]),
              )
              .map((pin: Record<string, unknown>) => ({
                address: pin["address"],
                timespans: (pin["timespans"] as unknown[]).filter(
                  (time: unknown): time is Record<string, unknown> =>
                    time !== null &&
                    typeof time === "object" &&
                    "start" in time &&
                    typeof (time as Record<string, unknown>)["start"] ===
                      "string" &&
                    "end" in time &&
                    typeof (time as Record<string, unknown>)["end"] ===
                      "string",
                ),
              }))
          : [];

        // Validate and filter streets array
        const validStreets = Array.isArray(parsedResponse.streets)
          ? parsedResponse.streets
              .filter(
                (street: unknown): street is Record<string, unknown> =>
                  street !== null &&
                  typeof street === "object" &&
                  "street" in street &&
                  typeof (street as Record<string, unknown>)["street"] ===
                    "string" &&
                  "from" in street &&
                  typeof (street as Record<string, unknown>)["from"] ===
                    "string" &&
                  "to" in street &&
                  typeof (street as Record<string, unknown>)["to"] ===
                    "string" &&
                  "timespans" in street &&
                  Array.isArray(
                    (street as Record<string, unknown>)["timespans"],
                  ),
              )
              .map((street: Record<string, unknown>) => ({
                street: street["street"],
                from: street["from"],
                to: street["to"],
                timespans: (street["timespans"] as unknown[]).filter(
                  (time: unknown): time is Record<string, unknown> =>
                    time !== null &&
                    typeof time === "object" &&
                    "start" in time &&
                    typeof (time as Record<string, unknown>)["start"] ===
                      "string" &&
                    "end" in time &&
                    typeof (time as Record<string, unknown>)["end"] ===
                      "string",
                ),
              }))
          : [];

        // Validate and filter cadastralProperties array
        const validCadastralProperties = Array.isArray(
          parsedResponse.cadastralProperties,
        )
          ? parsedResponse.cadastralProperties
              .filter(
                (prop: unknown): prop is Record<string, unknown> =>
                  prop !== null &&
                  typeof prop === "object" &&
                  "identifier" in prop &&
                  typeof (prop as Record<string, unknown>)["identifier"] ===
                    "string" &&
                  (
                    (prop as Record<string, unknown>)["identifier"] as string
                  ).trim().length > 0 &&
                  "timespans" in prop &&
                  Array.isArray((prop as Record<string, unknown>)["timespans"]),
              )
              .map((prop: Record<string, unknown>) => ({
                identifier: prop["identifier"],
                timespans: (prop["timespans"] as unknown[]).filter(
                  (time: unknown): time is Record<string, unknown> =>
                    time !== null &&
                    typeof time === "object" &&
                    "start" in time &&
                    typeof (time as Record<string, unknown>)["start"] ===
                      "string" &&
                    "end" in time &&
                    typeof (time as Record<string, unknown>)["end"] ===
                      "string",
                ),
              }))
          : [];

        // Return the full structured data
        const extractedData: ExtractedData = {
          responsible_entity: parsedResponse.responsible_entity || "",
          pins: validPins,
          streets: validStreets,
          cadastralProperties: validCadastralProperties,
          markdown_text: parsedResponse.markdown_text || "",
        };

        return extractedData;
      } catch (parseError) {
        recorder.error(
          `Failed to parse JSON response from AI: ${formatIngestErrorText(
            parseError,
          )}`,
        );
        const rawJsonSummary = truncateIngestPayload(
          jsonMatch[0],
          MAX_INGEST_ERROR_LENGTH,
        );
        recorder.error(
          `Raw JSON that failed to parse (${rawJsonSummary.originalLength} chars): ${rawJsonSummary.summary}`,
        );
        const fullResponseSummary = truncateIngestPayload(
          responseText,
          MAX_INGEST_ERROR_LENGTH,
        );
        recorder.error(
          `Full AI response (${fullResponseSummary.originalLength} chars): ${fullResponseSummary.summary}`,
        );
        return null;
      }
    }

    return null;
  } catch (error) {
    recorder.error(
      `Error extracting structured data: ${formatIngestErrorText(error)}`,
    );
    return null;
  }
}

// Legacy export for backward compatibility
export const extractAddresses = extractStructuredData;
