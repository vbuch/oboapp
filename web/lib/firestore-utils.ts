/**
 * Shared Firestore utility functions
 */

export type FirestoreValue =
  | {
      _seconds: number;
      _nanoseconds: number;
      toDate(): Date;
    }
  | Date
  | string;

export function convertTimestamp(timestamp: unknown): string {
  if (!timestamp) {
    return new Date().toISOString();
  }

  // Handle Firestore Timestamp with _seconds property
  if (
    typeof timestamp === "object" &&
    timestamp !== null &&
    "_seconds" in timestamp
  ) {
    const ts = timestamp as { _seconds: number };
    return new Date(ts._seconds * 1000).toISOString();
  }

  // Handle objects with toDate method
  if (
    typeof timestamp === "object" &&
    timestamp !== null &&
    "toDate" in timestamp
  ) {
    const ts = timestamp as { toDate(): Date };
    return ts.toDate().toISOString();
  }

  // Handle Date objects
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  // Handle string timestamps
  if (typeof timestamp === "string") {
    return timestamp;
  }

  // Fallback
  return new Date().toISOString();
}

/**
 * Safely parse JSON string with fallback to default value
 * Logs parse failures to help track data quality issues
 *
 * For non-string inputs (e.g., from Firestore), returns the value as-is.
 *
 * ⚠️ Type T is not guaranteed at runtime - developer must ensure correctness.
 *
 * @param value - Value to parse (string, or already-deserialized value)
 * @param fallback - Value to return if parsing fails (default: undefined)
 * @param context - Optional context for logging (e.g., field name)
 * @returns Parsed value or fallback
 */
export function safeJsonParse<T>(
  value: unknown,
  fallback?: T,
  context?: string,
): T | undefined {
  // Non-string inputs are returned as-is (e.g., Firestore already-deserialized data)
  if (typeof value !== "string") {
    return value as T;
  }

  // Attempt to parse string
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    const contextMsg = context ? ` (${context})` : "";
    console.warn(`Failed to parse JSON${contextMsg}:`, error);
    return fallback;
  }
}
