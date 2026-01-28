import { z } from "@/lib/schema/zod-openapi";
import { CoordinatesSchema } from "@/lib/schema/coordinates.schema";
import { GeoJsonPointSchema } from "@/lib/schema/geojson.schema";

export const AddressSchema = z.object({
  originalText: z.string(),
  formattedAddress: z.string(),
  coordinates: CoordinatesSchema,
  geoJson: GeoJsonPointSchema.optional(),
});

export type Address = z.infer<typeof AddressSchema>;
