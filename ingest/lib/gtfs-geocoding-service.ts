import { adminDb } from "./firebase-admin";
import type { Address } from "./types";
import { logger } from "@/lib/logger";

export interface BusStopGeometry {
  stopCode: string;
  stopName: string;
  lat: number;
  lng: number;
}

/**
 * Geocode a single bus stop by stop_code
 */
async function geocodeBusStop(
  stopCode: string,
): Promise<BusStopGeometry | null> {
  try {
    const db = adminDb;
    const doc = await db.collection("gtfsStops").doc(stopCode).get();

    if (!doc.exists) {
      logger.warn("Bus stop not found in GTFS data", { stopCode });
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    return {
      stopCode: data.stopCode,
      stopName: data.stopName,
      lat: data.coordinates.latitude,
      lng: data.coordinates.longitude,
    };
  } catch (error) {
    logger.error("Failed to geocode bus stop", { stopCode, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Geocode multiple bus stops and return as Address array
 * No rate limiting needed - local Firestore data
 */
export async function geocodeBusStops(stopCodes: string[]): Promise<Address[]> {
  const addresses: Address[] = [];

  for (const stopCode of stopCodes) {
    const geometry = await geocodeBusStop(stopCode);
    if (geometry) {
      addresses.push({
        originalText: `Спирка ${stopCode}`,
        formattedAddress: `${geometry.stopName} (${stopCode})`,
        coordinates: {
          lat: geometry.lat,
          lng: geometry.lng,
        },
        geoJson: {
          type: "Point",
          coordinates: [geometry.lng, geometry.lat],
        },
      });
      logger.info("Geocoded bus stop", { stopCode, stopName: geometry.stopName });
    }
  }

  return addresses;
}
