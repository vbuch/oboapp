import { z } from "../zod-openapi";

export const IngestErrorTypeSchema = z.enum(["warning", "error", "exception"]);

export const IngestErrorSchema = z.object({
  text: z.string(),
  type: IngestErrorTypeSchema,
});

export type IngestErrorType = z.infer<typeof IngestErrorTypeSchema>;
export type IngestError = z.infer<typeof IngestErrorSchema>;
