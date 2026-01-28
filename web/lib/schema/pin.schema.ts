import { z } from "@/lib/schema/zod-openapi";
import { TimespanSchema } from "@/lib/schema/timespan.schema";

export const PinSchema = z.object({
  address: z.string(),
  timespans: z.array(TimespanSchema),
});

export type Pin = z.infer<typeof PinSchema>;
