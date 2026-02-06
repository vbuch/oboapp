#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { verifyEnvSet } from "@/lib/verify-env";
import { logger } from "@/lib/logger";

const program = new Command();

program
  .name("sources:clean")
  .description(
    "Delete all unprocessed source documents except for a specified source type",
  )
  .requiredOption(
    "-r, --retain <sourceType>",
    "Source type to retain (all others will be deleted if unprocessed)",
  )
  .option("--dry-run", "Preview deletion without actually deleting")
  .addHelpText(
    "after",
    `
Examples:
  $ npm run sources:clean -- --retain lozenets-sofia-bg
  $ npm run sources:clean -- --retain rayon-oborishte-bg --dry-run

IMPORTANT: Only deletes sources that have NOT been ingested into messages.
Sources that have corresponding messages in the messages collection will be preserved.
`,
  )
  .action(async (options) => {
    // Ensure environment variables are loaded and required keys are present
    dotenv.config({ path: resolve(process.cwd(), ".env.local") });
    verifyEnvSet(["FIREBASE_SERVICE_ACCOUNT_KEY"]);

    try {
      const { cleanSources } = await import("./lib/sources-clean");
      await cleanSources(options.retain, options.dryRun ?? false);
    } catch (error) {
      logger.error("Fatal error in sources:clean", { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  });

program.parse();
