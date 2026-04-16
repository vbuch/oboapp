import type { Message } from "../schema/contract";
import {
  toOptionalISOString,
  toRequiredISOString,
} from "./date-serialization";
import {
  getAddresses,
  getBusStops,
  getCadastralProperties,
  getCategories,
  getFeatureCollection,
  getPins,
  getStreets,
} from "./typed-arrays";

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function tryToOptionalISOString(
  value: unknown,
  fieldName: string,
): string | undefined {
  try {
    return toOptionalISOString(value, fieldName);
  } catch {
    return undefined;
  }
}

function resolveTimespan(
  record: Record<string, unknown>,
  createdAtIso: string,
): { timespanStart: string; timespanEnd: string } {
  const timespanStart = tryToOptionalISOString(record.timespanStart, "timespanStart");
  const timespanEnd = tryToOptionalISOString(record.timespanEnd, "timespanEnd");
  const fallbackIso =
    tryToOptionalISOString(record.finalizedAt, "finalizedAt") ??
    tryToOptionalISOString(record.crawledAt, "crawledAt") ??
    createdAtIso;

  return {
    timespanStart: timespanStart ?? timespanEnd ?? fallbackIso,
    timespanEnd: timespanEnd ?? timespanStart ?? fallbackIso,
  };
}

/**
 * Convert a database record to a public Message object.
 * The @oboapp/db adapter handles JSON parsing and Timestamp→Date conversion,
 * so this function only needs to map fields and convert Dates to ISO strings.
 */
export function recordToMessage(record: Record<string, unknown>): Message {
  const createdAt = toRequiredISOString(record.createdAt, "createdAt");
  const resolvedTimespan = resolveTimespan(record, createdAt);

  return {
    id: typeof record._id === "string" ? record._id : undefined,
    text: typeof record.text === "string" ? record.text : "",
    locality: typeof record.locality === "string" ? record.locality : "",
    plainText: optionalString(record.plainText),
    addresses: getAddresses(record.addresses),
    geoJson: getFeatureCollection(record.geoJson),
    crawledAt: toOptionalISOString(record.crawledAt, "crawledAt"),
    createdAt,
    finalizedAt: toOptionalISOString(record.finalizedAt, "finalizedAt"),
    source: optionalString(record.source),
    sourceUrl: optionalString(record.sourceUrl),
    markdownText: optionalString(record.markdownText),
    categories: getCategories(record.categories),
    timespanStart: resolvedTimespan.timespanStart,
    timespanEnd: resolvedTimespan.timespanEnd,
    cityWide: record.cityWide === true,
    responsibleEntity: optionalString(record.responsibleEntity),
    pins: getPins(record.pins),
    streets: getStreets(record.streets),
    cadastralProperties: getCadastralProperties(record.cadastralProperties),
    busStops: getBusStops(record.busStops),
  };
}
