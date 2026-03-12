import { z } from "../zod-openapi";
import { CoordinatesSchema } from "./coordinates.schema";
import { TimespanSchema } from "./timespan.schema";

// zod-to-openapi cannot introspect ZodCatch, so we provide explicit OpenAPI
// metadata that mirrors CoordinatesSchema's shape.
const optionalCoordinatesWithFallback = CoordinatesSchema.optional()
  .catch(undefined)
  .openapi({ type: "object", properties: { lat: { type: "number" }, lng: { type: "number" } }, required: ["lat", "lng"] });

export const StreetSectionSchema = z.object({
  street: z.string(),
  from: z.string(),
  fromCoordinates: optionalCoordinatesWithFallback,
  to: z.string(),
  toCoordinates: optionalCoordinatesWithFallback,
  timespans: z.array(TimespanSchema),
});

export type StreetSection = z.infer<typeof StreetSectionSchema>;
