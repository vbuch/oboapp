import { z } from "zod";
import { PinSchema } from "./pin.schema";
import { StreetSectionSchema } from "./street-section.schema";

export const ExtractedDataSchema = z.object({
  responsible_entity: z.string(),
  pins: z.array(PinSchema),
  streets: z.array(StreetSectionSchema),
  markdown_text: z.string().optional(),
});

export type ExtractedData = z.infer<typeof ExtractedDataSchema>;
