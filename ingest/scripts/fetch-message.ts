#!/usr/bin/env tsx
/**
 * Fetches and prints a full message document by ID.
 *
 * Usage:
 *   pnpm fetch-message --id LQ8D9Bkp
 */

import { Command } from "commander";
import dotenv from "dotenv";
import { resolve } from "node:path";

async function main(messageId: string, compact: boolean) {
  const { getDb, closeDb } = await import("@/lib/db");
  const db = await getDb();

  try {
    const message = await db.messages.findById(messageId);

    if (!message) {
      console.error(`Message \"${messageId}\" not found`);
      process.exitCode = 1;
      return;
    }

    const spacing = compact ? 0 : 2;
    console.log(JSON.stringify(message, null, spacing));
  } finally {
    await closeDb();
  }
}

const program = new Command();

program
  .name("fetch-message")
  .description("Fetch and print a full message document by ID")
  .requiredOption("--id <messageId>", "The message ID to fetch")
  .option("--compact", "Print JSON without indentation")
  .addHelpText(
    "after",
    `
Examples:
  $ pnpm fetch-message --id LQ8D9Bkp
  $ pnpm fetch-message --id LQ8D9Bkp --compact
`,
  )
  .action(async (opts: { id: string; compact?: boolean }) => {
    dotenv.config({ path: resolve(process.cwd(), ".env.local") });
    await main(opts.id, Boolean(opts.compact));
  });

program.parseAsync().catch((error) => {
  console.error(error);
  process.exit(1);
});
