interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Builds the API URL for fetching messages with optional viewport bounds
 * @param bounds - Optional viewport bounds to filter messages
 * @returns API URL with query parameters if bounds are provided
 */
export function buildMessagesUrl(bounds?: ViewportBounds | null): string {
  let url = "/api/messages";
  if (bounds) {
    const params = new URLSearchParams({
      north: bounds.north.toString(),
      south: bounds.south.toString(),
      east: bounds.east.toString(),
      west: bounds.west.toString(),
    });
    url += `?${params.toString()}`;
  }
  return url;
}
