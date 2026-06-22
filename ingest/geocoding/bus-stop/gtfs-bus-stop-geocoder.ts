import type {
  BusStopGeocoder,
  BusStopResult,
  GeocodingContext,
} from "../interfaces";
import { gradeGtfs } from "../shared/quality";
import { geocodeBusStops } from "../gtfs/geocoding-service";

export class GtfsBusStopGeocoder implements BusStopGeocoder {
  async geocodeBusStop(args: {
    location: string;
    context: GeocodingContext;
  }): Promise<BusStopResult | null> {
    const { location } = args;
    const addresses = await geocodeBusStops([location]);
    const first = addresses[0];

    if (!first) {
      return null;
    }

    return {
      coordinates: first.coordinates,
      qualitySignals: first.qualitySignals ?? gradeGtfs(),
    };
  }

  async done(_results: Map<string, BusStopResult>): Promise<void> {
    // No-op hook for future cache providers.
  }
}
