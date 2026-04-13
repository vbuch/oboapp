import { z } from "../zod-openapi";

export const TimespanSchema = z.object({
  start: z.string().nullable(),
  end: z.string().nullable(),
});

export type Timespan = z.infer<typeof TimespanSchema>;
