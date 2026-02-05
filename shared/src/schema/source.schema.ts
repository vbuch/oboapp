import { z } from "../zod-openapi";

export const SourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  logoUrl: z.string(),
});

export type Source = z.infer<typeof SourceSchema>;
