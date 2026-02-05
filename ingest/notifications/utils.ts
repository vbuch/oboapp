/**
 * Convert Firestore timestamp to ISO string
 */
export function convertTimestamp(timestamp: unknown): string {
  if (timestamp && typeof timestamp === "object") {
    const t = timestamp as { _seconds?: unknown; toDate?: unknown };

    // Check for Firestore internal format (_seconds)
    if ("_seconds" in t && typeof t._seconds === "number") {
      return new Date(t._seconds * 1000).toISOString();
    }

    // Check for Firestore Timestamp object (toDate method)
    if ("toDate" in t && typeof t.toDate === "function") {
      return (t.toDate as () => Date)().toISOString();
    }
  }

  if (typeof timestamp === "string") {
    return timestamp;
  }

  return new Date().toISOString();
}
