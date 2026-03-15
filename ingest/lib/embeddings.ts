import { GoogleGenAI } from "@google/genai";
import { delay } from "./delay";
import { logger } from "./logger";

const EMBEDDING_MODEL =
  process.env.GOOGLE_EMBEDDING_MODEL || "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const RATE_LIMIT_MS = 200;

let ai: GoogleGenAI | null = null;
let lastCallTime = 0;

function getClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || "" });
  }
  return ai;
}

/**
 * Generate a text embedding via Gemini gemini-embedding-001.
 * Rate-limited to 200ms between calls.
 * Returns null on failure (does not throw).
 */
export async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  if (!text.trim()) return null;

  if (!process.env.GOOGLE_AI_API_KEY) {
    return null;
  }

  // Rate limiting
  const elapsed = Date.now() - lastCallTime;
  if (elapsed < RATE_LIMIT_MS) {
    await delay(RATE_LIMIT_MS - elapsed);
  }

  try {
    const client = getClient();
    lastCallTime = Date.now();

    const response = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });

    const values = response.embeddings?.[0]?.values;
    if (!values?.length) {
      logger.warn("Embedding response missing values", {
        model: EMBEDDING_MODEL,
      });
      return null;
    }

    return values;
  } catch (error) {
    logger.error("Failed to generate embedding", { error });
    return null;
  }
}

/** Exported for testing */
export const _testInternals = {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  RATE_LIMIT_MS,
  resetClient: () => {
    ai = null;
    lastCallTime = 0;
  },
};
