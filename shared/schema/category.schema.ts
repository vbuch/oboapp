import { z } from "zod";

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

export type Category = z.infer<typeof CategoryEnum>;

// Re-export shared constants for backward compatibility
export {
  CATEGORIES,
  UNCATEGORIZED,
  CATEGORY_LABELS,
  UNCATEGORIZED_LABEL,
  CATEGORY_DISPLAY_ORDER,
} from "./category-constants";
