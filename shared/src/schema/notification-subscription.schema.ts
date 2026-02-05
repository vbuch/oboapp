import { z } from "../zod-openapi";

export const NotificationSubscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  token: z.string(),
  endpoint: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deviceInfo: z
    .object({
      userAgent: z.string().optional(),
      platform: z.string().optional(),
    })
    .optional(),
});

export const NotificationSubscriptionRequestSchema = z.object({
  token: z.string(),
  endpoint: z.string(),
  deviceInfo: z
    .object({
      userAgent: z.string().optional(),
      platform: z.string().optional(),
    })
    .optional(),
});

export const NotificationSubscriptionStatusSchema = z.object({
  hasSubscription: z.boolean(),
});

export const DeleteSubscriptionResponseSchema = z.object({
  success: z.literal(true),
});

export type NotificationSubscription = z.infer<
  typeof NotificationSubscriptionSchema
>;
export type NotificationSubscriptionRequest = z.infer<
  typeof NotificationSubscriptionRequestSchema
>;
export type NotificationSubscriptionStatus = z.infer<
  typeof NotificationSubscriptionStatusSchema
>;
export type DeleteSubscriptionResponse = z.infer<
  typeof DeleteSubscriptionResponseSchema
>;
