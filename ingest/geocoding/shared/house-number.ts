// Match only standalone house-number style endpoints and avoid ordinal street names (e.g. "6-ти").
export function isHouseNumberEndpoint(endpoint: string): boolean {
  const normalized = endpoint.trim();

  if (normalized.length === 0) {
    return false;
  }

  if (/^\d+\s*-\s*(?:ти|ви|ри|ми)$/i.test(normalized)) {
    return false;
  }

  return /^\d+[A-Za-zА-Яа-я]?(?:\s*[/-]\s*\d+[A-Za-zА-Яа-я]?)?$/.test(
    normalized,
  );
}
