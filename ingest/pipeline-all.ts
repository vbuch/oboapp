#!/usr/bin/env node

import { resolve } from "node:path";
import dotenv from "dotenv";
import { verifyEnvSet } from "@/lib/verify-env";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Ensure environment variables are loaded
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
verifyEnvSet([
  "FIREBASE_SERVICE_ACCOUNT_KEY",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "GOOGLE_AI_API_KEY",
  "GOOGLE_AI_MODEL",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
]);

/**
 * Get available crawler sources by reading the crawlers directory
 */
function getAvailableSources(): string[] {
  const crawlersDir = join(__dirname, "crawlers");
  const entries = readdirSync(crawlersDir);

  return entries.filter((entry) => {
    const fullPath = join(crawlersDir, entry);
    const isDirectory = statSync(fullPath).isDirectory();
    // Exclude 'shared' directory
    return isDirectory && entry !== "shared";
  });
}

async function runCrawler(source: string): Promise<boolean> {
  console.log(`\n🚀 Running crawler: ${source}`);
  try {
    const crawlerPath = `./crawlers/${source}/index.js`;
    const crawler = await import(crawlerPath);
    await crawler.crawl();
    console.log(`✅ Crawler ${source} completed`);
    return true;
  } catch (error) {
    console.error(`❌ Error running crawler ${source}:`, error);
    return false;
  }
}

async function runIngest(): Promise<void> {
  console.log("\n📥 Running ingest pipeline");
  try {
    const { ingest } = await import("./messageIngest/from-sources");
    await ingest({});
    console.log("✅ Ingest completed");
  } catch (error) {
    console.error("❌ Error running ingest:", error);
    throw error;
  }
}

async function runNotify(): Promise<void> {
  console.log("\n📧 Running notification matching");
  try {
    const { main } = await import("./notifications/match-and-notify");
    await main();
    console.log("✅ Notify completed");
  } catch (error) {
    console.error("❌ Error running notify:", error);
    throw error;
  }
}

async function main() {
  console.log("🌟 Starting FULL pipeline (all crawlers)");
  
  const allCrawlers = getAvailableSources();
  console.log(`All crawlers: ${allCrawlers.join(", ")}`);
  
  const results: Array<{ source: string; success: boolean }> = [];
  
  try {
    // Run all crawlers sequentially, track successes and failures
    for (const crawler of allCrawlers) {
      const success = await runCrawler(crawler);
      results.push({ source: crawler, success });
    }
    
    // Report crawler results
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    
    console.log(
      `\n📊 Crawler results: ${successful.length} succeeded, ${failed.length} failed`
    );
    if (failed.length > 0) {
      console.log(`Failed crawlers: ${failed.map((r) => r.source).join(", ")}`);
    }
    
    // Continue with ingest and notify even if some crawlers failed
    // This ensures that successfully crawled data is processed
    await runIngest();
    await runNotify();
    
    if (failed.length > 0) {
      console.log(
        `\n⚠️  FULL pipeline completed with ${failed.length} crawler failure(s)`
      );
      process.exit(1); // Exit with error to signal partial failure
    } else {
      console.log("\n✅ FULL pipeline completed successfully");
      process.exit(0);
    }
  } catch (error) {
    console.error("\n❌ FULL pipeline failed:", error);
    process.exit(1);
  }
}

main();
