import type {
  BusStopGeocoder,
  BusStopResult,
  GeocodingContext,
} from "../interfaces";
import { geocodeBusStops } from "./geocoding-service";
import { gradeGtfs } from "../shared/quality";

export class GtfsGeocoder implements BusStopGeocoder {
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
}
