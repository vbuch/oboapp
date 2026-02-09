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
 * Runtime shape validator: returns true if the value passes the check.
 * The return type of safeJsonParse is determined by its generic parameter T,
 * not by the validator — the validator is a runtime guard only.
 */
export type JsonValidator = (value: unknown) => boolean;

/**
 * Built-in validators for common JSON shapes.
 * These perform shallow runtime checks only — they verify the outer container
 * type (array vs object) but do NOT validate element/property types.
 *
 * For element-level validation, use `arrayOf()` or write a custom validator.
 */
export const jsonValidators = {
  /** Validates that value is an array (does NOT validate element types) */
  array: (value: unknown): value is unknown[] => Array.isArray(value),

  /** Validates that value is a non-null object, excludes arrays (does NOT validate properties) */
  object: (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value),

  /** Validates that value is a non-null object or array */
  objectOrArray: (
    value: unknown,
  ): value is Record<string, unknown> | unknown[] =>
    typeof value === "object" && value !== null,
} as const;

/**
 * Creates a validator that checks each element of an array against an item validator.
 * Use when you need runtime validation of array element shapes.
 *
 * @example
 * ```typescript
 * const isAddress = (v: unknown): v is Address =>
 *   typeof v === "object" && v !== null && "street" in v;
 *
 * safeJsonParse<Address[]>(data, [], "addresses", arrayOf(isAddress));
 * ```
 */
export function arrayOf(itemValidator: JsonValidator): JsonValidator {
  return (value: unknown): boolean =>
    Array.isArray(value) && value.every(itemValidator);
}

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
 * Built-in jsonValidators perform shallow shape checks only (array vs object).
 * For element-level validation, use `arrayOf()` or write a custom validator.
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
  validator?: JsonValidator,
): T;

// Overload 2: With undefined or no fallback - requires explicit generic, returns T | undefined
export function safeJsonParse<T>(
  value: unknown,
  fallback?: undefined,
  context?: string,
  validator?: JsonValidator,
): T | undefined;

// Implementation (signature must be compatible with both overloads)
export function safeJsonParse<T>(
  value: unknown,
  fallback?: T,
  context?: string,
  validator?: JsonValidator,
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
