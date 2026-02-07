import { z } from "../zod-openapi";
import { CoordinatesSchema } from "./coordinates.schema";
import { TimespanSchema } from "./timespan.schema";

export const StreetSectionSchema = z.object({
  street: z.string(),
  from: z.string(),
  fromCoordinates: CoordinatesSchema.optional(),
  to: z.string(),
  toCoordinates: CoordinatesSchema.optional(),
  timespans: z.array(TimespanSchema),
});

export type StreetSection = z.infer<typeof StreetSectionSchema>;
