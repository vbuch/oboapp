import type {
  CadastralGeocoder,
  CadastralResult,
  GeocodingContext,
} from "../interfaces";
import type { CadastralProperty } from "@/lib/types";
import { geocodeCadastralProperties } from "../cadastre/service";

export class CadastreGeocoder implements CadastralGeocoder {
  async geocodeCadastral(args: {
    location: CadastralProperty;
    context: GeocodingContext;
  }): Promise<CadastralResult | null> {
    const { location } = args;
    const results = await geocodeCadastralProperties([location.identifier]);
    const geometry = results.get(location.identifier);

    if (!geometry) {
      return null;
    }

    return { geometry };
  }

  async done(_results: Map<string, CadastralResult>): Promise<void> {
    // No-op hook for future cache providers.
  }
}
