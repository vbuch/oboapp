#!/usr/bin/env node
/**
 * Deletes messages (and related event links / orphaned events / notification
 * matches) for a given source URL, WITHOUT deleting the source document.
 *
 * This lets the next ingestion run re-process the source from scratch.
 *
 * Usage:
 *   pnpm tsx ingest/scripts/delete-message-by-source-url.ts <url>            # dry-run
 *   pnpm tsx ingest/scripts/delete-message-by-source-url.ts <url> --execute  # apply
 */

import { Command } from "commander";
import dotenv from "dotenv";
import { resolve } from "node:path";
import {
  deleteMessagesWithRelations,
  logCleanupStats,
} from "./message-cleanup";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main(sourceUrl: string, dryRun: boolean) {
  const { getDb, closeDb } = await import("@/lib/db");
  const { encodeDocumentId } = await import(
    "@/crawlers/shared/firestore"
  );

  const db = await getDb();

  try {
    const sourceDocumentId = encodeDocumentId(sourceUrl);

    console.log(`\nLooking up messages for source URL: ${sourceUrl}`);
    console.log(`  sourceDocumentId: ${sourceDocumentId}`);

    const messages = await db.messages.findBySourceDocumentIds(
      [sourceDocumentId],
      ["_id", "sourceDocumentId"],
    );

    if (messages.length === 0) {
      console.log("\nNo messages found for this URL.");
      return;
    }

    console.log(`\nFound ${messages.length} message(s):`);
    for (const msg of messages) {
      const snippet = ((msg.text ?? msg.plainText ?? "") as string).slice(0, 80);
      console.log(`  • ${msg._id as string}  "${snippet}"`);
    }

    if (dryRun) {
      console.log(
        `\n⚠️  DRY RUN — no changes made. Re-run with --execute to apply.`,
      );
      return;
    }

    const stats = await deleteMessagesWithRelations(db, messages);
    console.log("\n✅ Deleted:");
    logCleanupStats(stats, "  ");
    console.log(
      "\nSource document kept — next ingestion run will re-create the message.",
    );
  } finally {
    await closeDb();
  }
}

const program = new Command();
program
  .name("delete-message-by-source-url")
  .argument("<url>", "Source URL of the message to delete")
  .option("--execute", "Actually delete (default is dry-run)")
  .action(async (url: string, opts: { execute?: boolean }) => {
    const dryRun = !opts.execute;
    try {
      await main(url, dryRun);
    } catch (err) {
      console.error(
        "❌ Fatal:",
        err instanceof Error ? err.message : String(err),
      );
      process.exit(1);
    }
  });

program.parse(process.argv);
