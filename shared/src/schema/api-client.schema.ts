import { z } from "../zod-openapi";

const httpUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const protocol = new URL(url).protocol;
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "websiteUrl must be an http or https URL" },
  );

export const ApiClientSchema = z.object({
  id: z.string(),
  userId: z.string(),
  apiKey: z.string(),
  websiteUrl: httpUrlSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ApiClientRequestSchema = z.object({
  websiteUrl: httpUrlSchema,
});

export type ApiClient = z.infer<typeof ApiClientSchema>;
export type ApiClientRequest = z.infer<typeof ApiClientRequestSchema>;
