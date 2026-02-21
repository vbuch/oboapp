import { NextResponse } from "next/server";

let cachedEnvKeys: Set<string> | null = null;

function getEnvKeys(): Set<string> {
  if (cachedEnvKeys) return cachedEnvKeys;
  const apiKeys = process.env.PUBLIC_API_KEYS ?? "";
  cachedEnvKeys = new Set(
    apiKeys
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  );
  return cachedEnvKeys;
}

function extractKey(request: Request): string | null {
  const headerKey = request.headers.get("x-api-key");
  if (headerKey) return headerKey;
  const { searchParams } = new URL(request.url);
  return searchParams.get("apiKey");
}

/**
 * Validates the API key from the request.
 *
 * Checks the `X-Api-Key` header (or the `apiKey` query parameter as a fallback)
 * first against the `PUBLIC_API_KEYS` environment variable (comma-separated list,
 * fast path), then against the `apiClients` database collection.
 * Returns `true` when a valid key is found.
 */
export async function validateApiKey(request: Request): Promise<boolean> {
  const key = extractKey(request);
  if (!key) return false;

  // Fast path: check env-var keys (no DB round-trip)
  if (getEnvKeys().has(key)) return true;

  // DB path: look up the key in the apiClients collection
  try {
    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    const client = await db.apiClients.findByApiKey(key);
    return client !== null;
  } catch {
    return false;
  }
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
