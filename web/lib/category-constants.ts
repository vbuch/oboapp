// Re-export everything from shared to maintain backward compatibility
// This file can be deprecated in favor of importing directly from shared
export {
  type Category,
  CategoryEnum,
  CATEGORIES,
  UNCATEGORIZED,
  CATEGORY_LABELS,
  UNCATEGORIZED_LABEL,
  CATEGORY_DISPLAY_ORDER,
} from "@shared/schema/category.schema";
