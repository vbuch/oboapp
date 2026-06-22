import type {
  EducationalFacilityGeocoder,
  EducationalFacilityResult,
  GeocodingContext,
} from "../interfaces";
import type { EducationalFacilityRef } from "@oboapp/shared";
import { geocodeEducationalFacilities } from "./geocoding-service";
import { gradeEducational } from "../shared/quality";

export class EducationalFacilitiesGeocoder implements EducationalFacilityGeocoder {
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
}
