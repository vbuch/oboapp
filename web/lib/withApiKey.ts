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

/**
 * Validates the API key from the `X-Api-Key` request header.
 *
 * Checks first against the `PUBLIC_API_KEYS` environment variable
 * (comma-separated list, fast path), then against the `apiClients`
 * database collection. Returns `true` when a valid key is found.
 */
export async function validateApiKey(request: Request): Promise<boolean> {
  const key = request.headers.get("x-api-key");
  if (!key) return false;
  const normalizedKey = key.trim();
  if (!normalizedKey) return false;

  // Fast path: check env-var keys (no DB round-trip)
  if (getEnvKeys().has(normalizedKey)) return true;

  // DB path: look up the key in the apiClients collection
  try {
    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    const client = await db.apiClients.findByApiKey(normalizedKey);
    return client !== null;
  } catch (error) {
    console.error(
      "validateApiKey: failed to validate API key due to an internal error",
      error,
    );
    return false;
  }
}

export function apiKeyUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Invalid or missing API key. Provide a valid X-Api-Key request header.",
    },
    { status: 401 },
  );
}
