import type {
  BusStopGeocoder,
  BusStopResult,
  GeocodingContext,
} from "../interfaces";
import { gradeGoogle } from "../shared/quality";
import { geocodeAddresses } from "../google/service";

export class GoogleBusStopGeocoder implements BusStopGeocoder {
  async geocodeBusStop(args: {
    location: string;
    context: GeocodingContext;
  }): Promise<BusStopResult | null> {
    const { location } = args;
    const query = `Спирка ${location}`;
    const addresses = await geocodeAddresses([query]);
    const first = addresses[0];

    if (!first) {
      return null;
    }

    return {
      coordinates: first.coordinates,
      qualitySignals: first.qualitySignals ?? gradeGoogle(),
    };
  }

  async done(_results: Map<string, BusStopResult>): Promise<void> {
    // No-op hook for future cache providers.
  }
}
