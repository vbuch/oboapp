import { Address } from "./types";

// Constants for API rate limiting
const MAPBOX_BATCH_DELAY_MS = 200;

interface MapboxFeature {
  place_name: string;
  geometry: {
    coordinates: [number, number]; // [lng, lat]
  };
  place_type: string[];
  context?: Array<{
    id: string;
    text: string;
  }>;
}

interface MapboxGeocodingResponse {
  features: MapboxFeature[];
}

/**
 * Geocode an intersection using Mapbox Geocoding API
 * Query format: "<street A> и <street B>, София"
 */
export async function mapboxGeocodeIntersection(
  query: string
): Promise<Address | null> {
  try {
    const apiKey = process.env.MAPBOX_ACCESS_TOKEN;
    if (!apiKey) {
      console.error("MAPBOX_ACCESS_TOKEN environment variable not set");
      return null;
    }

    // Ensure the query includes Sofia context
    const fullQuery =
      query.includes("София") || query.includes("Sofia")
        ? query
        : `${query}, София`;

    // Try with multiple type configurations for better results
    // First try: poi,address (intersections often tagged as POI)
    // Second try: address only
    const typeConfigs = ["poi,address", "address"];

    for (const types of typeConfigs) {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        fullQuery
      )}.json?access_token=${apiKey}&types=${types}&proximity=23.3219,42.6977&country=bg&limit=5`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Mapbox API error (${response.status}):`, errorText);
        if (response.status === 403) {
          console.error("⚠️  Mapbox token forbidden. This is likely because:");
          console.error(
            "   1. Token has URL restrictions (works in browser but not server-side)"
          );
          console.error("   2. Token needs Geocoding API scope enabled");
          console.error(
            "   → Create a SECRET token (sk.*) for server-side use at https://account.mapbox.com/access-tokens/"
          );
        }
        continue; // Try next type configuration
      }

      const data: MapboxGeocodingResponse = await response.json();

      if (data.features?.length) {
        const feature = data.features[0];
        const [lng, lat] = feature.geometry.coordinates;

        console.log(
          `✅ Mapbox found result (types=${types}): ${feature.place_name}`
        );

        return {
          originalText: query,
          formattedAddress: feature.place_name,
          coordinates: { lat, lng },
          geoJson: {
            type: "Point",
            coordinates: [lng, lat],
          },
        };
      }
    }

    console.warn(`No Mapbox results for intersection: ${query}`);
    return null;
  } catch (error) {
    console.error("Error geocoding intersection with Mapbox:", error);
    return null;
  }
}

/**
 * Geocode any address/location using Mapbox Geocoding API
 * Handles addresses, intersections, and street names
 */
export async function mapboxGeocodeAddress(
  address: string
): Promise<Address | null> {
  try {
    const apiKey = process.env.MAPBOX_ACCESS_TOKEN;
    if (!apiKey) {
      console.error("MAPBOX_ACCESS_TOKEN environment variable not set");
      return null;
    }

    // Ensure the address includes Sofia context
    const fullAddress =
      address.includes("София") || address.includes("Sofia")
        ? address
        : `${address}, София`;

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      fullAddress
    )}.json?access_token=${apiKey}&types=address,poi&proximity=23.3219,42.6977&country=bg&limit=5`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Mapbox API error (${response.status}):`, errorText);
      if (response.status === 403) {
        console.error(
          "⚠️  Token has URL restrictions. Use a SECRET token (sk.*) for server-side geocoding."
        );
      }
      return null;
    }

    const data: MapboxGeocodingResponse = await response.json();

    if (!data.features?.length) {
      console.warn(`No Mapbox results for: ${address}`);
      return null;
    }

    const feature = data.features[0];
    const [lng, lat] = feature.geometry.coordinates;

    return {
      originalText: address,
      formattedAddress: feature.place_name,
      coordinates: { lat, lng },
      geoJson: {
        type: "Point",
        coordinates: [lng, lat],
      },
    };
  } catch (error) {
    console.error("Error geocoding with Mapbox:", error);
    return null;
  }
}

/**
 * Geocode multiple addresses using Mapbox
 * Uses the general geocoding endpoint which handles all address types
 */
export async function mapboxGeocodeAddresses(
  addresses: string[]
): Promise<Address[]> {
  const geocodedAddresses: Address[] = [];

  for (const address of addresses) {
    const geocoded = await mapboxGeocodeAddress(address);

    if (geocoded) {
      geocodedAddresses.push(geocoded);
      console.log(
        `✅ Mapbox geocoded: ${address} → ${geocoded.formattedAddress}`,
        `@ ${geocoded.coordinates.lat}, ${geocoded.coordinates.lng}`
      );
    } else {
      console.warn(`❌ Failed to geocode with Mapbox: ${address}`);
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, MAPBOX_BATCH_DELAY_MS));
  }

  return geocodedAddresses;
}

/**
 * Geocode intersections for street sections
 * Extracts unique intersections and geocodes them
 */
export async function mapboxGeocodeIntersections(
  intersectionPairs: [string, string][]
): Promise<Map<string, { lat: number; lng: number }>> {
  const geocodedMap = new Map<string, { lat: number; lng: number }>();

  for (const [street, crossStreet] of intersectionPairs) {
    // Create intersection query
    const query = `${street} и ${crossStreet}`;
    const key = crossStreet; // Use cross street as key for compatibility

    const geocoded = await mapboxGeocodeIntersection(query);

    if (geocoded) {
      geocodedMap.set(key, geocoded.coordinates);
      console.log(
        `✅ Intersection geocoded: ${query} @ ${geocoded.coordinates.lat}, ${geocoded.coordinates.lng}`
      );
    } else {
      console.warn(`❌ Failed to geocode intersection: ${query}`);
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, MAPBOX_BATCH_DELAY_MS));
  }

  return geocodedMap;
}
