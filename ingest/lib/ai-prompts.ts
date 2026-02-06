import { readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "@/lib/logger";

/**
 * Loads a prompt template from the prompts directory
 */
export function loadPrompt(filename: string): string {
  try {
    return readFileSync(join(process.cwd(), "prompts", filename), "utf-8");
  } catch (error) {
    logger.error("Failed to load prompt template", { filename, error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Prompt template file not found: ${filename}`);
  }
}

/**
 * Cached prompt templates
 */
let categorizePromptCache: string | null = null;
let extractionPromptCache: string | null = null;

/**
 * Gets the categorization prompt template (cached)
 */
export function getCategorizePrompt(): string {
  if (!categorizePromptCache) {
    categorizePromptCache = loadPrompt("categorize.md");
  }
  return categorizePromptCache;
}

/**
 * Gets the data extraction prompt template (cached)
 * Uses Overpass-optimized prompt for hybrid geocoding (Google for pins, Overpass for streets)
 */
export function getExtractionPrompt(): string {
  if (!extractionPromptCache) {
    extractionPromptCache = loadPrompt("data-extraction-overpass.md");
  }
  return extractionPromptCache;
}
