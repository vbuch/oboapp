#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { verifyEnvSet } from "@/lib/verify-env";
import { logger } from "@/lib/logger";

const program = new Command();

program
  .name("notify")
  .description(
    "Match unprocessed messages with user interests and send notifications"
  )
  .addHelpText(
    "after",
    `
This command:
  - Fetches all unprocessed messages (where notificationsSent != true)
  - Matches them against all user interests using geospatial calculations
  - Creates notification matches in Firestore
  - Sends push notifications via Firebase Cloud Messaging
  - Marks messages as notified

Examples:
  $ npx tsx notify
`
  )
  .action(async () => {
    // Ensure environment variables are loaded and required keys are present
    dotenv.config({ path: resolve(process.cwd(), ".env.local") });
    verifyEnvSet([
      "FIREBASE_SERVICE_ACCOUNT_KEY",
      "FIREBASE_PROJECT_ID",
      "APP_URL",
    ]);

    try {
      // Dynamically import to avoid loading dependencies at parse time
      const { main } = await import("./notifications/match-and-notify");

      await main();

      process.exit(0);
    } catch (error) {
      logger.error(`Notification matching failed: ${error instanceof Error ? error.message : String(error)}`, {
        step: "notify",
      });
      process.exit(1);
    }
  });

program.parse();
