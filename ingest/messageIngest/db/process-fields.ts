import { FieldValue } from "firebase-admin/firestore";
import { normalizeCategoriesInput } from "@/lib/category-utils";

/**
 * Fields that should be stored as native Firestore types (not stringified)
 * These enable array-contains queries and maintain structure for frontend use
 */
const NATIVE_ARRAY_FIELDS = [
  "ingestErrors",
  "pins",
  "streets",
  "cadastralProperties",
  "busStops",
];

/**
 * Process fields for Firestore storage
 * - Converts Date objects to Firestore server timestamps (except timespanStart/timespanEnd)
 * - Preserves timespanStart/timespanEnd as Date for server-side filtering
 * - Stringifies complex objects (extractedData, geoJson, categorize)
 * - Keeps categories as native arrays for Firestore indexes
 *   (array-contains queries require native arrays, not stringified JSON)
 * - Keeps denormalized fields (pins, streets, cadastralProperties, busStops, responsibleEntity) as native types
 * - Passes through primitives unchanged
 */
export function processFieldsForFirestore(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const processedFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof Date) {
      // Preserve Date objects for timespanStart/timespanEnd (needed for server-side filtering)
      if (key === "timespanStart" || key === "timespanEnd") {
        processedFields[key] = value;
      } else {
        // Convert other Date fields to server timestamp
        processedFields[key] = FieldValue.serverTimestamp();
      }
    } else if (key === "categories") {
      processedFields[key] = normalizeCategoriesInput(value);
    } else if (NATIVE_ARRAY_FIELDS.includes(key)) {
      // Keep these as native arrays/objects for Firestore (not stringified)
      processedFields[key] = value;
    } else if (key === "responsibleEntity") {
      // Keep responsibleEntity as native string (not stringified)
      processedFields[key] = value;
    } else if (typeof value === "object" && value !== null) {
      // Stringify objects (extractedData, geoJson, categorize, addresses)
      processedFields[key] = JSON.stringify(value);
    } else {
      processedFields[key] = value;
    }
  }
  return processedFields;
}
