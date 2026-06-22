import type {
  BusStopGeocoder,
  BusStopResult,
  EducationalFacilityGeocoder,
  EducationalFacilityResult,
  GeocodingContext,
  PinGeocoder,
  PinResult,
} from "../interfaces";
import type { Coordinates, EducationalFacilityRef } from "@oboapp/shared";
import { geocodeAddresses } from "./service";
import { gradeGoogle } from "../shared/quality";

export class GoogleGeocoder
  implements PinGeocoder, BusStopGeocoder, EducationalFacilityGeocoder
{
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

  async geocodeEducationalFacility(args: {
    location: EducationalFacilityRef;
    context: GeocodingContext;
  }): Promise<EducationalFacilityResult | null> {
    const { location } = args;
    const query = `${location.type} ${location.number}`;
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
}
