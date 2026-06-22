import type {
  EducationalFacilityGeocoder,
  EducationalFacilityResult,
  GeocodingContext,
} from "../interfaces";
import type { EducationalFacilityRef } from "@oboapp/shared";
import { gradeGoogle } from "../shared/quality";
import { geocodeAddresses } from "../google/service";

export class GoogleEducationalFacilityGeocoder
  implements EducationalFacilityGeocoder
{
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

  async done(_results: Map<string, EducationalFacilityResult>): Promise<void> {
    // No-op hook for future cache providers.
  }
}
