export function toISOString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function toMs(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}
