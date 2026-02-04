import type { ExtractedData } from "./types";
import {
  CategorizationResponseSchema,
  type CategorizationResult,
} from "./categorize.schema";
import {
  formatIngestErrorText,
  getIngestErrorRecorder,
  truncateIngestPayload,
  type IngestErrorRecorder,
} from "./ingest-errors";

const MAX_INGEST_ERROR_LENGTH = 1000;

interface Timespan {
  start: string;
  end: string;
}

interface Pin {
  address: string;
  timespans: Timespan[];
}

interface Street {
  street: string;
  from: string;
  to: string;
  timespans: Timespan[];
}

interface CadastralProperty {
  identifier: string;
  timespans: Timespan[];
}

/**
 * Validates and filters pin objects from AI response
 */
export function validatePins(pins: unknown): Pin[] {
  if (!Array.isArray(pins)) {
    return [];
  }

  return pins
    .filter(
      (pin: unknown): pin is Record<string, unknown> =>
        pin !== null &&
        typeof pin === "object" &&
        "address" in pin &&
        typeof (pin as Record<string, unknown>)["address"] === "string" &&
        ((pin as Record<string, unknown>)["address"] as string).trim().length >
          0 &&
        "timespans" in pin &&
        Array.isArray((pin as Record<string, unknown>)["timespans"]),
    )
    .map((pin: Record<string, unknown>) => ({
      address: pin["address"] as string,
      timespans: validateTimespans(pin["timespans"] as unknown[]),
    }));
}

/**
 * Validates and filters street objects from AI response
 */
export function validateStreets(streets: unknown): Street[] {
  if (!Array.isArray(streets)) {
    return [];
  }

  return streets
    .filter(
      (street: unknown): street is Record<string, unknown> =>
        street !== null &&
        typeof street === "object" &&
        "street" in street &&
        typeof (street as Record<string, unknown>)["street"] === "string" &&
        "from" in street &&
        typeof (street as Record<string, unknown>)["from"] === "string" &&
        "to" in street &&
        typeof (street as Record<string, unknown>)["to"] === "string" &&
        "timespans" in street &&
        Array.isArray((street as Record<string, unknown>)["timespans"]),
    )
    .map((street: Record<string, unknown>) => ({
      street: street["street"] as string,
      from: street["from"] as string,
      to: street["to"] as string,
      timespans: validateTimespans(street["timespans"] as unknown[]),
    }));
}

/**
 * Validates and filters cadastral property objects from AI response
 */
export function validateCadastralProperties(
  properties: unknown,
): CadastralProperty[] {
  if (!Array.isArray(properties)) {
    return [];
  }

  return properties
    .filter(
      (prop: unknown): prop is Record<string, unknown> =>
        prop !== null &&
        typeof prop === "object" &&
        "identifier" in prop &&
        typeof (prop as Record<string, unknown>)["identifier"] === "string" &&
        ((prop as Record<string, unknown>)["identifier"] as string).trim()
          .length > 0 &&
        "timespans" in prop &&
        Array.isArray((prop as Record<string, unknown>)["timespans"]),
    )
    .map((prop: Record<string, unknown>) => ({
      identifier: prop["identifier"] as string,
      timespans: validateTimespans(prop["timespans"] as unknown[]),
    }));
}

/**
 * Validates and filters timespan objects
 */
function validateTimespans(timespans: unknown[]): Timespan[] {
  return timespans.filter(
    (time: unknown): time is Timespan =>
      time !== null &&
      typeof time === "object" &&
      "start" in time &&
      typeof (time as Record<string, unknown>)["start"] === "string" &&
      "end" in time &&
      typeof (time as Record<string, unknown>)["end"] === "string",
  ) as Timespan[];
}

/**
 * Parses and validates categorization response from AI
 */
export function parseCategorizationResponse(
  responseText: string,
  ingestErrors?: IngestErrorRecorder,
): CategorizationResult | null {
  const recorder = getIngestErrorRecorder(ingestErrors);

  try {
    const parsedResponse = JSON.parse(responseText);
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
}

/**
 * Parses and validates extraction response from AI
 */
export function parseExtractionResponse(
  responseText: string,
  ingestErrors?: IngestErrorRecorder,
): ExtractedData | null {
  const recorder = getIngestErrorRecorder(ingestErrors);

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    const parsedResponse = JSON.parse(jsonMatch[0]);

    const extractedData: ExtractedData = {
      responsible_entity: parsedResponse.responsible_entity || "",
      pins: validatePins(parsedResponse.pins),
      streets: validateStreets(parsedResponse.streets),
      cadastralProperties: validateCadastralProperties(
        parsedResponse.cadastralProperties,
      ),
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
