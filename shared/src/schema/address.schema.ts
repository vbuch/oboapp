import { z } from "../zod-openapi";
import { CoordinatesSchema } from "./coordinates.schema";
import { GeoJsonPointSchema } from "./geojson.schema";

export const AddressSchema = z.object({
  originalText: z.string(),
  formattedAddress: z.string(),
  coordinates: CoordinatesSchema,
  geoJson: GeoJsonPointSchema.optional(),
});

export type Address = z.infer<typeof AddressSchema>;
