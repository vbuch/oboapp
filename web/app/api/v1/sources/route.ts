import { validateApiKey, apiKeyUnauthorizedResponse } from "@/lib/withApiKey";
import { GET as getSources } from "@/app/api/sources/route";

export async function GET(request: Request) {
  if (!(await validateApiKey(request))) {
    return apiKeyUnauthorizedResponse();
  }
  return getSources();
}
