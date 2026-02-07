import { z } from "../zod-openapi";
import { CoordinatesSchema } from "./coordinates.schema";
import { TimespanSchema } from "./timespan.schema";

export const PinSchema = z.object({
  address: z.string(),
  coordinates: CoordinatesSchema.optional(),
  timespans: z.array(TimespanSchema),
});

export type Pin = z.infer<typeof PinSchema>;
