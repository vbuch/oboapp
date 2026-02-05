import { z } from "zod";
import { normalizeCategoriesInput } from "./category-utils";
import { CategoryEnum } from "@oboapp/shared";

// Coordinate format validation: "latitude, longitude"
const CoordinateString = z
  .string()
  .regex(
    /^-?\d+\.\d+,\s*-?\d+\.\d+$/,
    "Invalid coordinate format. Expected 'latitude, longitude'",
  );

// Schema for a single categorized message object
const CategorizedMessageSchema = z.object({
  categories: z.preprocess(normalizeCategoriesInput, z.array(CategoryEnum)),
  relations: z.array(z.string()).optional(),
  withSpecificAddress: z.boolean(),
  specificAddresses: z.array(z.string()).default([]),
  coordinates: z.array(CoordinateString).default([]),
  busStops: z.array(z.string()).default([]),
  cadastralProperties: z.array(z.string()).default([]),
  cityWide: z.boolean(),
  isRelevant: z.boolean(),
  normalizedText: z.string(),
});

// Schema for the complete categorization response (array of categorized messages)
export const CategorizationResponseSchema = z.array(CategorizedMessageSchema);

// Exported types for use in other files
export type Category = z.infer<typeof CategoryEnum>;
export type CategorizedMessage = z.infer<typeof CategorizedMessageSchema>;
export type CategorizationResult = z.infer<typeof CategorizationResponseSchema>;
