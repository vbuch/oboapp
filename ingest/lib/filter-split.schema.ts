import { z } from "zod";

const FilteredMessageSchema = z.object({
  originalText: z.string().default(""),
  normalizedText: z.string(),
  isRelevant: z.boolean(),
  responsibleEntity: z.string().default(""),
  markdownText: z.string().default(""),
});

export const FilterSplitResponseSchema = z.array(FilteredMessageSchema);

export type FilteredMessage = z.infer<typeof FilteredMessageSchema>;
export type FilterSplitResult = z.infer<typeof FilterSplitResponseSchema>;
