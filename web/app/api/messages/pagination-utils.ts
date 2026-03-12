export function toTimestamp(value: unknown): number | null {
  const timestamp = new Date(value as string | Date).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}
