/**
 * Parses map center coordinates from URL parameters
 * @param lat - Latitude parameter from URL
 * @param lng - Longitude parameter from URL
 * @returns Parsed coordinates object or null if invalid
 */
export function parseMapCenterFromParams(
  lat: string | null,
  lng: string | null
): { lat: number; lng: number } | null {
  if (!lat || !lng) {
    return null;
  }

  const latitude = Number.parseFloat(lat);
  const longitude = Number.parseFloat(lng);

  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return { lat: latitude, lng: longitude };
}
