import { z } from "zod";

export const TimespanSchema = z.object({
  start: z.string(),
  end: z.string(),
});

export type Timespan = z.infer<typeof TimespanSchema>;
