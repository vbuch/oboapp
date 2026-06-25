// Match the previous router's house-number semantics as closely as possible.
// This keeps Bulgarian house-number forms routed the same way they were before the refactor.
export function buildHouseNumberQuery(streetName: string, endpoint: string): string {
  const trimmedStreet = streetName.trim();
  const trimmedEndpoint = endpoint.trim();

  if (trimmedEndpoint.toLowerCase().includes(trimmedStreet.toLowerCase())) {
    return trimmedEndpoint;
  }

  return `${trimmedStreet} ${trimmedEndpoint}`;
}

export function isHouseNumberEndpoint(endpoint: string): boolean {
  const normalized = endpoint.trim();

  if (normalized.length === 0) {
    return false;
  }

  if (/^\d+\s*-\s*(?:ти|ви|ри|ми)$/i.test(normalized)) {
    return false;
  }

  if (/^\d+[A-Za-zА-Яа-я]?$/.test(normalized)) {
    return true;
  }

  return /№\s*\d+|бл\.\s*\d+|номер\s+\d+/i.test(normalized);
}
