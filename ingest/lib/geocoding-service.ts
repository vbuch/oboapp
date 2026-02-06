import { Address } from "./types";
import {
  isWithinSofia,
  isSofiaCenterFallback,
  isGenericCityAddress,
} from "./geocoding-utils";
import { delay } from "./delay";
import { logger } from "@/lib/logger";
import { GoogleGeocodingMockService } from "../__mocks__/services/google-geocoding-mock-service";

// Check if mocking is enabled
const USE_MOCK = process.env.MOCK_GOOGLE_GEOCODING === "true";
const mockService = USE_MOCK ? new GoogleGeocodingMockService() : null;

// Constants for API rate limiting
const GEOCODING_BATCH_DELAY_MS = 200;

export async function geocodeAddress(address: string): Promise<Address | null> {
  // Use mock if enabled
  if (USE_MOCK && mockService) {
    logger.info("Using Google Geocoding mock", { address });
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
          logger.warn("Result is Sofia city center generic fallback, rejecting", { address, lat: lat.toFixed(6), lng: lng.toFixed(6) });
          continue;
        }

        // Reject generic city-level addresses (e.g., "Sofia, Bulgaria")
        if (isGenericCityAddress(formattedAddress)) {
          logger.warn("Rejecting generic address", { address, formattedAddress });
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
        logger.warn("Result is outside Sofia", { address, lat: lat.toFixed(6), lng: lng.toFixed(6) });
      }

      // All results were outside Sofia
      logger.warn("No results found within Sofia boundaries", { address });
      return null;
    }

    return null;
  } catch (error) {
    logger.error("Error geocoding address", { error: error instanceof Error ? error.message : String(error) });
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
      logger.warn("Failed to geocode address", { address });
    }
    // Add a small delay to avoid hitting rate limits
    await delay(GEOCODING_BATCH_DELAY_MS);
  }

  return geocodedAddresses;
}
