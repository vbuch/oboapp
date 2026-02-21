import { NextResponse } from "next/server";

let cachedKeys: Set<string> | null = null;

function getValidKeys(): Set<string> {
  if (cachedKeys) return cachedKeys;
  const apiKeys = process.env.PUBLIC_API_KEYS ?? "";
  cachedKeys = new Set(
    apiKeys
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  );
  return cachedKeys;
}

/**
 * Validates the API key from the request.
 *
 * Checks the `X-Api-Key` header (or the `apiKey` query parameter as a fallback)
 * against the `PUBLIC_API_KEYS` environment variable (comma-separated list of
 * valid keys). Returns `true` when a valid key is present.
 */
export function validateApiKey(request: Request): boolean {
  const validKeys = getValidKeys();
  if (validKeys.size === 0) return false;

  const headerKey = request.headers.get("x-api-key");
  if (headerKey && validKeys.has(headerKey)) return true;

  const { searchParams } = new URL(request.url);
  const queryKey = searchParams.get("apiKey");
  if (queryKey && validKeys.has(queryKey)) return true;

  return false;
}

export function apiKeyUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Invalid or missing API key. Provide a valid X-Api-Key request header or apiKey query parameter.",
    },
    { status: 401 },
  );
}
