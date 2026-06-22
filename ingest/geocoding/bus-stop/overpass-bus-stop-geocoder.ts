import type {
  BusStopGeocoder,
  BusStopResult,
  GeocodingContext,
} from "../interfaces";
import { gradeOverpass } from "../shared/quality";
import { overpassGeocodeAddresses } from "../overpass/service";

export class OverpassBusStopGeocoder implements BusStopGeocoder {
  async geocodeBusStop(args: {
    location: string;
    context: GeocodingContext;
  }): Promise<BusStopResult | null> {
    const { location } = args;
    const query = `Спирка ${location}`;
    const addresses = await overpassGeocodeAddresses([query]);
    const first = addresses[0];

    if (!first) {
      return null;
    }

    return {
      coordinates: first.coordinates,
      qualitySignals: first.qualitySignals ?? gradeOverpass(),
    };
  }

  async done(_results: Map<string, BusStopResult>): Promise<void> {
    // No-op hook for future cache providers.
  }
}
