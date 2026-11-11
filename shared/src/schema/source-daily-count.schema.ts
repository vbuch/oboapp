import { z } from "../zod-openapi";
import { SourceCountSnapshotSchema } from "./source-snapshot.schema";

export const SourceDailyCountSchema = SourceCountSnapshotSchema.extend({
  date: z.iso.date(),
});

export type SourceDailyCount = z.infer<typeof SourceDailyCountSchema>;
