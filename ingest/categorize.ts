#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import dotenv from "dotenv";
import { verifyEnvSet } from "@/lib/verify-env";
import { logger } from "@/lib/logger";

// Load environment variables before Firebase Admin initialization
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const program = new Command();

program
  .name("categorize")
  .description("Test AI categorization pipeline on message files")
  .requiredOption("-p, --path <path>", "Path to message file to categorize")
  .option("--dry-run", "Preview categorization without processing")
  .addHelpText(
    "after",
    `
Examples:
  $ npm run categorize -- --path tmp/messages/sofia-bg_2025-12-30_5K0SpKEeQtAPWFJzIYP8.md
  $ npm run categorize -- --path /absolute/path/to/message.md --dry-run
`
  )
  .action(async (options) => {
    // Ensure environment variables are loaded and required keys are present
    dotenv.config({ path: resolve(process.cwd(), ".env.local") });
    verifyEnvSet(["GOOGLE_AI_API_KEY", "GOOGLE_AI_MODEL"]);

    try {
      const filePath = resolve(process.cwd(), options.path);

      // Check if file exists
      if (!existsSync(filePath)) {
        logger.error("File not found", { filePath });
        process.exit(1);
      }

      logger.info("Processing file", { path: options.path });

      // Read message content
      let messageText: string;
      try {
        messageText = readFileSync(filePath, "utf-8");
      } catch (error) {
        logger.error("Could not read file", { filePath, error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      }

      logger.info("Message content preview", {
        chars: messageText.length,
        preview: messageText.substring(0, 300) + (messageText.length > 300 ? "..." : ""),
      });

      if (options.dryRun) {
        logger.info("DRY RUN - Would categorize this message with AI service");
        process.exit(0);
      }

      // Import AI service (dynamic import after dotenv.config)
      const { categorize } = await import("@/lib/ai-service");

      // Categorize the message
      logger.info("Categorizing message with AI service");
      const categories = await categorize(messageText);

      if (!categories) {
        logger.error("Categorization failed - no result returned");
        process.exit(1);
      }

      logger.info("Categorization result", { result: categories });
      logger.info("Categorization completed successfully");
      process.exit(0);
    } catch (error) {
      logger.error("Fatal error in categorize", { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  });

program.parse();
