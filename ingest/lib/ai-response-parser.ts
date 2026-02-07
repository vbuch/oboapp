import {
  FilterSplitResponseSchema,
  type FilterSplitResult,
} from "./filter-split.schema";
import {
  CategorizationResponseSchema,
  type CategorizationResult,
} from "./categorize.schema";
import {
  ExtractedLocationsSchema,
  type ExtractedLocations,
} from "./extract-locations.schema";
import {
  formatIngestErrorText,
  getIngestErrorRecorder,
  truncateIngestPayload,
  type IngestErrorRecorder,
} from "./ingest-errors";

const MAX_INGEST_ERROR_LENGTH = 1000;

/**
 * Extracts a JSON string from AI response text.
 * Handles both clean JSON and JSON wrapped in markdown code blocks.
 */
function extractJson(responseText: string): string | null {
  // Try matching a JSON array or object (greedy)
  const jsonMatch = responseText.match(/[\[{][\s\S]*[\]}]/);
  return jsonMatch ? jsonMatch[0] : null;
}

/**
 * Parses and validates filter & split response from AI (Step 1)
 */
export function parseFilterSplitResponse(
  responseText: string,
  ingestErrors?: IngestErrorRecorder,
): FilterSplitResult | null {
  const recorder = getIngestErrorRecorder(ingestErrors);

  const jsonStr = extractJson(responseText);
  if (!jsonStr) {
    recorder.error("No JSON found in filter & split AI response");
    return null;
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return FilterSplitResponseSchema.parse(parsed);
  } catch (parseError) {
    recorder.error(
      `Failed to parse filter & split response: ${formatIngestErrorText(parseError)}`,
    );
    const summary = truncateIngestPayload(responseText, MAX_INGEST_ERROR_LENGTH);
    recorder.error(
      `Full AI response (${summary.originalLength} chars): ${summary.summary}`,
    );
    return null;
  }
}

/**
 * Parses and validates categorization response from AI (Step 2)
 */
export function parseCategorizeResponse(
  responseText: string,
  ingestErrors?: IngestErrorRecorder,
): CategorizationResult | null {
  const recorder = getIngestErrorRecorder(ingestErrors);

  const jsonStr = extractJson(responseText);
  if (!jsonStr) {
    recorder.error("No JSON found in categorize AI response");
    return null;
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return CategorizationResponseSchema.parse(parsed);
  } catch (parseError) {
    recorder.error(
      `Failed to parse categorize response: ${formatIngestErrorText(parseError)}`,
    );
    const summary = truncateIngestPayload(responseText, MAX_INGEST_ERROR_LENGTH);
    recorder.error(
      `Full AI response (${summary.originalLength} chars): ${summary.summary}`,
    );
    return null;
  }
}

/**
 * Parses and validates extract locations response from AI (Step 3)
 */
export function parseExtractLocationsResponse(
  responseText: string,
  ingestErrors?: IngestErrorRecorder,
): ExtractedLocations | null {
  const recorder = getIngestErrorRecorder(ingestErrors);

  const jsonStr = extractJson(responseText);
  if (!jsonStr) {
    recorder.error("No JSON found in extract locations AI response");
    return null;
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return ExtractedLocationsSchema.parse(parsed);
  } catch (parseError) {
    recorder.error(
      `Failed to parse extract locations response: ${formatIngestErrorText(parseError)}`,
    );
    const summary = truncateIngestPayload(responseText, MAX_INGEST_ERROR_LENGTH);
    recorder.error(
      `Full AI response (${summary.originalLength} chars): ${summary.summary}`,
    );
    return null;
  }
}
