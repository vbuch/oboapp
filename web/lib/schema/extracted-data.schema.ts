import { z } from "@/lib/schema/zod-openapi";
import { PinSchema } from "@/lib/schema/pin.schema";
import { StreetSectionSchema } from "@/lib/schema/street-section.schema";

export const ExtractedDataSchema = z.object({
  responsible_entity: z.string(),
  pins: z.array(PinSchema),
  streets: z.array(StreetSectionSchema),
  markdown_text: z.string().optional(),
});

export type ExtractedData = z.infer<typeof ExtractedDataSchema>;
