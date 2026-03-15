export function toISOString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function toMs(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function isAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const code = (error as { code?: unknown }).code;
  return (
    error.message.includes("ALREADY_EXISTS") ||
    error.message.includes("already exists") ||
    code === 6 ||
    code === "already-exists"
  );
}
