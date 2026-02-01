import { FieldValue } from "firebase-admin/firestore";
import { normalizeCategoriesInput } from "@/lib/category-utils";

/**
 * Process fields for Firestore storage
 * - Converts Date objects to Firestore server timestamps (except timespanStart/timespanEnd)
 * - Preserves timespanStart/timespanEnd as Date for server-side filtering
 * - Stringifies complex objects (extractedData, geoJson, categorize)
 * - Keeps categories and relations as native arrays for Firestore indexes
 *   (array-contains queries require native arrays, not stringified JSON)
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
    } else if (key === "relations") {
      // Keep relations as native arrays for Firestore array indexes
      processedFields[key] = value;
    } else if (key === "ingestErrors") {
      // Keep ingestErrors as native arrays for error debugging
      processedFields[key] = value;
    } else if (typeof value === "object" && value !== null) {
      // Stringify objects (extractedData, geoJson, categorize)
      processedFields[key] = JSON.stringify(value);
    } else {
      processedFields[key] = value;
    }
  }
  return processedFields;
}
