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
 * Type guard function for validating parsed JSON values
 */
export type JsonValidator<T> = (value: unknown) => value is T;

/**
 * Built-in validators for common JSON types
 * Note: These perform runtime shape checking. The type predicates are
 * necessarily broad (unknown[] vs specific types) but provide runtime safety.
 */
export const jsonValidators = {
  /** Validates that value is an array */
  array: <T extends unknown[]>(value: unknown): value is T =>
    Array.isArray(value),

  /** Validates that value is a non-null object (excludes arrays) */
  object: <T extends Record<string, unknown>>(value: unknown): value is T =>
    typeof value === "object" && value !== null && !Array.isArray(value),

  /** Validates that value is a non-null object or array */
  objectOrArray: <T extends Record<string, unknown> | unknown[]>(
    value: unknown,
  ): value is T => typeof value === "object" && value !== null,
} as const;

/**
 * Safely parse JSON string with fallback to default value
 * Logs parse failures to help track data quality issues
 *
 * **For non-string inputs:**
 * If the input is already an object/array (e.g., from Firestore), the function treats it
 * as already-deserialized. If a validator is provided, the value is validated; otherwise,
 * it's returned as-is without warnings.
 *
 * **Type Safety:**
 * ⚠️ Without a validator, type T is not guaranteed at runtime. JSON.parse can return any value
 * (e.g., parsing "null" returns null, parsing '"string"' returns string, not T).
 * For type-safe results, always provide a validator from jsonValidators or implement a custom one.
 *
 * @param value - Value to parse (string, or already-deserialized object/array)
 * @param fallback - Value to return if parsing/validation fails (default: undefined)
 * @param context - Optional context for logging (e.g., field name)
 * @param validator - Optional type guard to validate parsed value (RECOMMENDED for type safety)
 * @returns Parsed/validated value or fallback
 */

// Overload 1: With concrete fallback value - returns T (inferred from fallback)
export function safeJsonParse<T>(
  value: unknown,
  fallback: T,
  context?: string,
  validator?: JsonValidator<T>,
): T;

// Overload 2: With undefined or no fallback - requires explicit generic, returns T | undefined
export function safeJsonParse<T>(
  value: unknown,
  fallback?: undefined,
  context?: string,
  validator?: JsonValidator<T>,
): T | undefined;

// Implementation (signature must be compatible with both overloads)
export function safeJsonParse<T>(
  value: unknown,
  fallback?: T,
  context?: string,
  validator?: JsonValidator<T>,
): T | undefined {
  // Handle non-string inputs (already deserialized, e.g., from Firestore)
  if (typeof value !== "string") {
    // If validator provided, validate the already-deserialized value
    if (validator) {
      if (!validator(value)) {
        const contextMsg = context ? ` (${context})` : "";
        console.warn(
          `Validation failed for non-string value${contextMsg}: value does not match expected type`,
        );
        return fallback;
      }
    }

    // No validator or validation passed - treat as already-parsed
    return value as T;
  }

  // String input - attempt to parse
  try {
    const parsed = JSON.parse(value);

    // Validate parsed value if validator provided
    if (validator && !validator(parsed)) {
      const contextMsg = context ? ` (${context})` : "";
      console.warn(
        `JSON validation failed${contextMsg}: parsed value does not match expected type`,
      );
      return fallback;
    }

    return parsed as T;
  } catch (error) {
    const contextMsg = context ? ` (${context})` : "";
    console.warn(`Failed to parse JSON${contextMsg}:`, error);
    return fallback;
  }
}
