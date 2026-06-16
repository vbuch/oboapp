import type { Context, Next } from "hono";
import { createHash } from "node:crypto";
import { getDb } from "../lib/db";

let cachedEnvKeys: Set<string> | null = null;

// Negative cache: fingerprint → timestamp of first rejection (ms)
const negativeCacheMs = new Map<string, number>();

function getNegativeCacheTtlMs(): number {
  const raw = process.env.PUBLIC_API_NEGATIVE_CACHE_TTL_S;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return (Number.isFinite(parsed) && parsed > 0 ? parsed : 300) * 1000;
}

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

export interface ApiPrincipal {
  id: string;
  type: "api-client" | "env";
  source: "db" | "env";
}

function fingerprintApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

function getPrincipalFromClientRecord(
  client: Record<string, unknown>,
  normalizedKey: string,
): ApiPrincipal {
  const userId = typeof client.userId === "string" ? client.userId : null;
  if (userId) {
    return {
      id: userId,
      type: "api-client",
      source: "db",
    };
  }

  return {
    id: `api-key:${fingerprintApiKey(normalizedKey)}`,
    type: "api-client",
    source: "db",
  };
}

async function validateApiKey(key: string): Promise<ApiPrincipal | null> {
  const normalizedKey = key.trim();
  if (!normalizedKey) return null;

  // Fast path: check env-var keys (no DB round-trip)
  if (getEnvKeys().has(normalizedKey)) {
    return {
      id: `env-key:${fingerprintApiKey(normalizedKey)}`,
      type: "env",
      source: "env",
    };
  }

  // Negative cache: skip Firestore for recently-rejected keys
  const fingerprint = fingerprintApiKey(normalizedKey);
  const rejectedAt = negativeCacheMs.get(fingerprint);
  if (
    rejectedAt !== undefined &&
    Date.now() - rejectedAt < getNegativeCacheTtlMs()
  ) {
    return null;
  }

  // DB path: look up the key in the apiClients collection
  const db = await getDb();
  const client = await db.apiClients.findByApiKey(normalizedKey);
  if (!client) {
    negativeCacheMs.set(fingerprint, Date.now());
    return null;
  }

  return getPrincipalFromClientRecord(client, normalizedKey);
}

export function getApiPrincipal(c: Context): ApiPrincipal | null {
  const principal = c.get("apiPrincipal");
  if (!principal || typeof principal !== "object") {
    return null;
  }

  const candidate = principal as Partial<ApiPrincipal>;
  if (
    typeof candidate.id !== "string" ||
    (candidate.type !== "api-client" && candidate.type !== "env") ||
    (candidate.source !== "db" && candidate.source !== "env")
  ) {
    return null;
  }

  return {
    id: candidate.id,
    type: candidate.type,
    source: candidate.source,
  };
}

export async function apiKeyAuth(c: Context, next: Next) {
  const key = c.req.header("x-api-key");
  if (!key) {
    return c.json(
      {
        error:
          "Invalid or missing API key. Provide a valid X-Api-Key request header.",
      },
      401,
    );
  }

  try {
    const principal = await validateApiKey(key);
    if (principal) {
      c.set("apiPrincipal", principal);
      await next();
      return;
    }
  } catch (error) {
    console.error(
      "apiKeyAuth: failed to validate API key due to an internal error",
      error,
    );
    return c.json({ error: "Internal server error" }, 500);
  }

  return c.json(
    {
      error:
        "Invalid or missing API key. Provide a valid X-Api-Key request header.",
    },
    401,
  );
}
