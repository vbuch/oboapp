import { z } from "../zod-openapi";
import { TimespanSchema } from "./timespan.schema";

export const StreetSectionSchema = z.object({
  street: z.string(),
  from: z.string(),
  to: z.string(),
  timespans: z.array(TimespanSchema),
});

export type StreetSection = z.infer<typeof StreetSectionSchema>;
