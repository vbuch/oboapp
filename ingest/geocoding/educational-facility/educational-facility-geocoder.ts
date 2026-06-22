import type {
  EducationalFacilityGeocoder,
  EducationalFacilityResult,
  GeocodingContext,
} from "../interfaces";
import type { EducationalFacilityRef } from "@oboapp/shared";
import { gradeEducational } from "../shared/quality";
import { geocodeEducationalFacilities } from "../educational-facilities/geocoding-service";

export class EducationalFacilityLocalGeocoder
  implements EducationalFacilityGeocoder
{
  async geocodeEducationalFacility(args: {
    location: EducationalFacilityRef;
    context: GeocodingContext;
  }): Promise<EducationalFacilityResult | null> {
    const { location } = args;
    const addresses = await geocodeEducationalFacilities([location]);
    const first = addresses[0];

    if (!first) {
      return null;
    }

    return {
      coordinates: first.coordinates,
      qualitySignals: first.qualitySignals ?? gradeEducational(),
    };
  }

  async done(_results: Map<string, EducationalFacilityResult>): Promise<void> {
    // No-op hook for future cache providers.
  }
}
