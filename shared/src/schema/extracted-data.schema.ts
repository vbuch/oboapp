import { z } from "../zod-openapi";
import { PinSchema } from "./pin.schema";
import { StreetSectionSchema } from "./street-section.schema";

export const CadastralPropertySchema = z.object({
  identifier: z.string(),
  timespans: z.array(
    z.object({
      start: z.string(),
      end: z.string(),
    }),
  ),
});

export const ExtractedDataSchema = z.object({
  responsible_entity: z.string(),
  pins: z.array(PinSchema),
  streets: z.array(StreetSectionSchema),
  cadastralProperties: z.array(CadastralPropertySchema).optional(),
  markdown_text: z.string().optional(),
});

export type CadastralProperty = z.infer<typeof CadastralPropertySchema>;
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;
