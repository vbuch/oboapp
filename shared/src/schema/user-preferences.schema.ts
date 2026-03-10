import { z } from "../zod-openapi";
import { CategoryEnum } from "./category.schema";

/**
 * Allowed values for notification category filters.
 * Includes all real categories plus "uncategorized" for messages without categories.
 */
const NotificationCategoryEnum = z.enum([
  ...CategoryEnum.options,
  "uncategorized",
]);

export const UserPreferencesSchema = z.object({
  id: z.string(),
  userId: z.string(),
  /** Categories to include in notifications (empty = allow all) */
  notificationCategories: z.array(NotificationCategoryEnum).default([]),
  /** Sources to include in notifications (empty = allow all) */
  notificationSources: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Schema for PUT request body (only the filter fields) */
export const UserPreferencesRequestSchema = z.object({
  notificationCategories: z.array(NotificationCategoryEnum).default([]),
  notificationSources: z.array(z.string()).default([]),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UserPreferencesRequest = z.infer<
  typeof UserPreferencesRequestSchema
>;
