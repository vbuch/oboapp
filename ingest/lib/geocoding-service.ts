import { Address } from "./types";
import {
  isWithinSofia,
  isSofiaCenterFallback,
  isGenericCityAddress,
} from "./geocoding-utils";
import { delay } from "./delay";
import { GoogleGeocodingMockService } from "../__mocks__/services/google-geocoding-mock-service";

// Check if mocking is enabled
const USE_MOCK = process.env.MOCK_GOOGLE_GEOCODING === "true";
const mockService = USE_MOCK ? new GoogleGeocodingMockService() : null;

// Constants for API rate limiting
const GEOCODING_BATCH_DELAY_MS = 200;

export async function geocodeAddress(address: string): Promise<Address | null> {
  // Use mock if enabled
  if (USE_MOCK && mockService) {
    console.log(`[MOCK] Using Google Geocoding mock for: ${address}`);
    return mockService.geocodeAddress(address);
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const encodedAddress = encodeURIComponent(`${address}, Sofia, Bulgaria`);
    // Use components parameter to restrict to Sofia (locality)
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&components=locality:Sofia|country:BG&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      // Try to find a result within Sofia's boundaries
      for (const result of data.results) {
        const lat = result.geometry.location.lat;
        const lng = result.geometry.location.lng;
        const formattedAddress = result.formatted_address;

        // Reject results that match Sofia center exactly (Google's fallback)
        if (isSofiaCenterFallback(lat, lng)) {
          console.warn(
            `⚠️  Result for "${address}" is Sofia city center: [${lat.toFixed(
              6,
            )}, ${lng.toFixed(6)}] - generic fallback, rejecting`,
          );
          continue;
        }

        // Reject generic city-level addresses (e.g., "Sofia, Bulgaria")
        if (isGenericCityAddress(formattedAddress)) {
          console.warn(
            `⚠️  Rejecting generic address for "${address}": ${formattedAddress}`,
          );
          continue;
        }

        // Validate that the result is actually within Sofia
        if (isWithinSofia(lat, lng)) {
          return {
            originalText: address,
            formattedAddress: result.formatted_address,
            coordinates: { lat, lng },
            geoJson: {
              type: "Point",
              coordinates: [lng, lat],
            },
          };
        }
        console.warn(
          `⚠️  Result for "${address}" is outside Sofia: [${lat.toFixed(
            6,
          )}, ${lng.toFixed(6)}]`,
        );
      }

      // All results were outside Sofia
      console.warn(
        `❌ No results for "${address}" found within Sofia boundaries`,
      );
      return null;
    }

    return null;
  } catch (error) {
    console.error("Error geocoding address:", error);
    return null;
  }
}

export async function geocodeAddresses(
  addresses: string[],
): Promise<Address[]> {
  const geocodedAddresses: Address[] = [];

  for (const address of addresses) {
    const geocoded = await geocodeAddress(address);

    if (geocoded) {
      geocodedAddresses.push(geocoded);
    } else {
      console.warn(`Failed to geocode address: ${address}`);
    }
    // Add a small delay to avoid hitting rate limits
    await delay(GEOCODING_BATCH_DELAY_MS);
  }

  return geocodedAddresses;
}
