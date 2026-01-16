import { z } from "zod";

// Predefined category enum from categorize.md
export const CategoryEnum = z.enum([
  "air-quality",
  "art",
  "bicycles",
  "construction-and-repairs",
  "culture",
  "electricity",
  "health",
  "heating",
  "parking",
  "public-transport",
  "road-block",
  "sports",
  "traffic",
  "vehicles",
  "waste",
  "water",
  "weather",
]);

// Coordinate format validation: "latitude, longitude"
const CoordinateString = z
  .string()
  .regex(
    /^-?\d+\.\d+,\s*-?\d+\.\d+$/,
    "Invalid coordinate format. Expected 'latitude, longitude'"
  );

// Schema for a single categorized message object
const CategorizedMessageSchema = z.object({
  categories: z.array(CategoryEnum),
  relations: z.array(z.string()).optional(),
  withSpecificAddress: z.boolean(),
  specificAddresses: z.array(z.string()),
  coordinates: z.array(CoordinateString),
  busStops: z.array(z.string()),
  cadastralProperties: z.array(z.string()),
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
