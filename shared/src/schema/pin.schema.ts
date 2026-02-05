import { z } from "../zod-openapi";
import { TimespanSchema } from "./timespan.schema";

export const PinSchema = z.object({
  address: z.string(),
  timespans: z.array(TimespanSchema),
});

export type Pin = z.infer<typeof PinSchema>;
