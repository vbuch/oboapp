import { z } from "../zod-openapi";
import { SourceSnapshotSchema } from "./source-snapshot.schema";

export const SourceDailyCountSchema = SourceSnapshotSchema.extend({
  date: z.iso.date(),
});

export type SourceDailyCount = z.infer<typeof SourceDailyCountSchema>;
