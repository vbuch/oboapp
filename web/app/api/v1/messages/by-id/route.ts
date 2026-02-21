import { validateApiKey, apiKeyUnauthorizedResponse } from "@/lib/withApiKey";
import { GET as getMessageById } from "@/app/api/messages/by-id/route";

export async function GET(request: Request) {
  if (!validateApiKey(request)) {
    return apiKeyUnauthorizedResponse();
  }
  return getMessageById(request);
}
