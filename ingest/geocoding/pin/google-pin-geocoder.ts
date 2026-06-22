import type { GeocodingContext, PinGeocoder, PinResult } from "../interfaces";
import type { Coordinates } from "@oboapp/shared";
import { geocodeAddresses } from "../google/service";

export class GooglePinGeocoder implements PinGeocoder {
  async geocodePin(args: {
    location: { address: string; coordinates?: Coordinates };
    context: GeocodingContext;
  }): Promise<PinResult | null> {
    const { location } = args;
    const addresses = await geocodeAddresses([location.address]);
    const first = addresses[0];

    if (!first) {
      return null;
    }

    return { address: first };
  }

  async done(_results: Map<string, PinResult>): Promise<void> {
    // No-op hook for future cache providers.
  }
}
