import { z } from "../zod-openapi";

export const ApiClientSchema = z.object({
  id: z.string(),
  userId: z.string(),
  apiKey: z.string(),
  websiteUrl: z.string().url(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ApiClientRequestSchema = z.object({
  websiteUrl: z.string().url(),
});

export type ApiClient = z.infer<typeof ApiClientSchema>;
export type ApiClientRequest = z.infer<typeof ApiClientRequestSchema>;
