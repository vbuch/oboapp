#!/usr/bin/env node

import { Command } from "commander";
import { resolve, join } from "node:path";
import dotenv from "dotenv";
import { verifyEnvSet } from "@/lib/verify-env";
import { readdirSync, statSync } from "node:fs";

const program = new Command();

// Define crawler groups
const EMERGENT_CRAWLERS = ["erm-zapad", "toplo-bg", "sofiyska-voda"];

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

async function runPipeline(crawlers: string[], pipelineName: string) {
  console.log(`🚀 Starting ${pipelineName} pipeline`);
  console.log(`Crawlers: ${crawlers.join(", ")}`);

  const results: Array<{ source: string; success: boolean }> = [];

  try {
    // Run all crawlers sequentially, track successes and failures
    for (const crawler of crawlers) {
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
        `\n⚠️  ${pipelineName} pipeline completed with ${failed.length} crawler failure(s)`
      );
      process.exit(1); // Exit with error to signal partial failure
    } else {
      console.log(`\n✅ ${pipelineName} pipeline completed successfully`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`\n❌ ${pipelineName} pipeline failed:`, error);
    process.exit(1);
  }
}

program
  .name("pipeline")
  .description("Run data ingestion pipeline with crawlers, ingest, and notify")
  .option("--emergent", "Run only emergent crawlers (ERM, Toplo, Sofiyska Voda)")
  .option("--all", "Run all crawlers")
  .addHelpText(
    "after",
    () => {
      const longFlowCrawlers = getAvailableSources().filter(
        (crawler) => !EMERGENT_CRAWLERS.includes(crawler)
      );
      return `
Crawler Groups:
  Emergent crawlers (short-lived messages, run every 30 minutes):
    ${EMERGENT_CRAWLERS.map((c) => `- ${c}`).join("\n    ")}
  
  Long-flow crawlers (WordPress-based, run 3x daily):
    ${longFlowCrawlers.map((c) => `- ${c}`).join("\n    ")}

Examples:
  $ npx tsx pipeline --emergent
  $ npx tsx pipeline --all
`;
    }
  )
  .action(async (options) => {
    // Ensure environment variables are loaded and required keys are present
    dotenv.config({ path: resolve(process.cwd(), ".env.local") });
    verifyEnvSet([
      "FIREBASE_SERVICE_ACCOUNT_KEY",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "GOOGLE_AI_API_KEY",
      "GOOGLE_AI_MODEL",
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    ]);

    // Validate that exactly one option is provided
    if (options.emergent && options.all) {
      console.error("❌ Error: Cannot use both --emergent and --all options");
      process.exit(1);
    }

    if (!options.emergent && !options.all) {
      console.error("❌ Error: Must specify either --emergent or --all");
      program.help();
    }

    if (options.emergent) {
      await runPipeline(EMERGENT_CRAWLERS, "EMERGENT");
    } else if (options.all) {
      const allCrawlers = getAvailableSources();
      await runPipeline(allCrawlers, "FULL");
    }
  });

program.parse();
