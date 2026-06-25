import type {
  BusStopGeocoder,
  BusStopResult,
  EducationalFacilityGeocoder,
  EducationalFacilityResult,
  GeocodingContext,
  PinGeocoder,
  PinResult,
  StreetGeocoder,
  StreetResult,
} from "../interfaces";
import type { Coordinates, EducationalFacilityRef } from "@oboapp/shared";
import { geocodeAddresses } from "./service";
import { gradeGoogle } from "../shared/quality";
import { isHouseNumberEndpoint } from "../shared/house-number";

export class GoogleGeocoder
  implements
    PinGeocoder,
    StreetGeocoder,
    BusStopGeocoder,
    EducationalFacilityGeocoder
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

  async geocodeStreet(args: {
    location: { street: string; from: string; to: string };
    context: GeocodingContext;
  }): Promise<StreetResult | null> {
    const { location } = args;

    const fromQuery = isHouseNumberEndpoint(location.from)
      ? `${location.street} ${location.from}`
      : `${location.street} и ${location.from}`;
    const toQuery = isHouseNumberEndpoint(location.to)
      ? `${location.street} ${location.to}`
      : `${location.street} и ${location.to}`;

    const [fromAddress, toAddress] = await Promise.all([
      geocodeAddresses([fromQuery]).then((res) => res[0] ?? null),
      geocodeAddresses([toQuery]).then((res) => res[0] ?? null),
    ]);

    if (!fromAddress || !toAddress) {
      return null;
    }

    return {
      fromCoordinates: fromAddress.coordinates,
      toCoordinates: toAddress.coordinates,
      qualitySignals: fromAddress.qualitySignals ?? gradeGoogle(),
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
