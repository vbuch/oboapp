#!/usr/bin/env node

import { resolve } from "node:path";
import dotenv from "dotenv";
import { verifyEnvSet } from "@/lib/verify-env";
import { execSync } from "node:child_process";

// Ensure environment variables are loaded
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
verifyEnvSet([
  "FIREBASE_SERVICE_ACCOUNT_KEY",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "GOOGLE_AI_API_KEY",
  "GOOGLE_AI_MODEL",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
]);

const EMERGENT_CRAWLERS = ["erm-zapad", "toplo-bg", "sofiyska-voda"];

async function runCrawler(source: string): Promise<void> {
  console.log(`\n🚀 Running crawler: ${source}`);
  try {
    const crawlerPath = `./crawlers/${source}/index.js`;
    const crawler = await import(crawlerPath);
    await crawler.crawl();
    console.log(`✅ Crawler ${source} completed`);
  } catch (error) {
    console.error(`❌ Error running crawler ${source}:`, error);
    throw error;
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
  console.log("🔥 Starting EMERGENT pipeline");
  console.log(`Emergent crawlers: ${EMERGENT_CRAWLERS.join(", ")}`);
  
  try {
    // Run all emergent crawlers sequentially
    for (const crawler of EMERGENT_CRAWLERS) {
      await runCrawler(crawler);
    }
    
    // Run ingest
    await runIngest();
    
    // Run notify
    await runNotify();
    
    console.log("\n✅ EMERGENT pipeline completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ EMERGENT pipeline failed:", error);
    process.exit(1);
  }
}

main();
