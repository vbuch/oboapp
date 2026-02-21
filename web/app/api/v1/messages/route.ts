import { validateApiKey, apiKeyUnauthorizedResponse } from "@/lib/withApiKey";
import { GET as getMessages } from "@/app/api/messages/route";

export async function GET(request: Request) {
  if (!(await validateApiKey(request))) {
    return apiKeyUnauthorizedResponse();
  }
  return getMessages(request);
}
