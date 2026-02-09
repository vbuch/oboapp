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
 * @param value - Value to parse (must be a string)
 * @param fallback - Value to return if parsing fails (default: undefined)
 * @param context - Optional context for logging (e.g., field name)
 * @returns Parsed JSON or fallback value
 */

// Overload 1: With concrete fallback value - returns T (inferred from fallback)
export function safeJsonParse<T>(
  value: unknown,
  fallback: T,
  context?: string,
): T;

// Overload 2: With undefined or no fallback - requires explicit generic, returns T | undefined
export function safeJsonParse<T>(
  value: unknown,
  fallback?: undefined,
  context?: string,
): T | undefined;

// Implementation (signature must be compatible with both overloads)
export function safeJsonParse<T>(
  value: unknown,
  fallback?: T,
  context?: string,
): T | undefined {
  // Type guard: ensure value is a string
  if (typeof value !== "string") {
    const contextMsg = context ? ` (${context})` : "";
    console.warn(
      `Expected string for JSON parsing${contextMsg}, got ${typeof value}`,
    );
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    const contextMsg = context ? ` (${context})` : "";
    console.warn(`Failed to parse JSON${contextMsg}:`, error);
    return fallback;
  }
}
