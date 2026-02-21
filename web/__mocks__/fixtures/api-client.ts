import type { ApiClient } from "@/lib/types";
import { MOCK_USER_ID } from "./interests";

export const MOCK_API_CLIENT: ApiClient = {
  id: "api-client-mock-1",
  userId: MOCK_USER_ID,
  apiKey: "obo_mockApiKey1234567890abcdef",
  websiteUrl: "https://github.com/example/my-sofia-app",
  createdAt: new Date("2026-02-01T12:00:00Z").toISOString(),
  updatedAt: new Date("2026-02-01T12:00:00Z").toISOString(),
};
