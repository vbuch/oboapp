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
