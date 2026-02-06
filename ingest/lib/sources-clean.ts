import type { Firestore } from "firebase-admin/firestore";
import { logger } from "@/lib/logger";

interface SourceDocument {
  sourceType: string;
  url: string;
  title: string;
}

/**
 * Get all source document IDs that have been ingested into messages
 */
async function getIngestedSourceIds(adminDb: Firestore): Promise<Set<string>> {
  logger.info("Checking which sources have been ingested");

  const messagesSnapshot = await adminDb
    .collection("messages")
    .select("sourceDocumentId")
    .get();

  const ingestedIds = new Set<string>();
  messagesSnapshot.forEach((doc) => {
    const sourceDocId = doc.data().sourceDocumentId;
    if (sourceDocId) {
      ingestedIds.add(sourceDocId);
    }
  });

  logger.info("Found ingested sources", { count: ingestedIds.size });
  return ingestedIds;
}

/**
 * Delete all unprocessed sources except for the specified source type
 */
export async function cleanSources(
  retainSourceType: string,
  dryRun: boolean,
): Promise<void> {
  logger.info("Cleaning sources", { mode: dryRun ? "dry-run" : "production" });
  logger.info("Retaining source type", { retainSourceType });

  // Dynamically import firebase-admin after env is loaded
  const { adminDb } = await import("@/lib/firebase-admin");

  // Get all sources
  const sourcesSnapshot = await adminDb.collection("sources").get();
  logger.info("Total sources in database", { count: sourcesSnapshot.size });

  if (sourcesSnapshot.empty) {
    logger.info("No sources found in database");
    return;
  }

  // Get set of ingested source IDs
  const ingestedSourceIds = await getIngestedSourceIds(adminDb);

  // Categorize sources
  const retained: SourceDocument[] = [];
  const toDelete: { id: string; doc: SourceDocument }[] = [];
  const ingested: SourceDocument[] = [];

  sourcesSnapshot.forEach((doc) => {
    const data = doc.data() as SourceDocument;
    const sourceType = data.sourceType;

    // Keep sources of the retain type
    if (sourceType === retainSourceType) {
      retained.push(data);
      return;
    }

    // Keep sources that have been ingested
    if (ingestedSourceIds.has(doc.id)) {
      ingested.push(data);
      return;
    }

    // Mark for deletion
    toDelete.push({ id: doc.id, doc: data });
  });

  // Display summary
  logger.info("Source cleanup summary", {
    retainedByType: retained.length,
    retainSourceType,
    retainedByIngestion: ingested.length,
    toDelete: toDelete.length,
  });

  if (toDelete.length === 0) {
    logger.info("No sources to delete");
    return;
  }

  // Show samples of what will be deleted
  logger.info("Sources to delete (first 10)", {
    samples: toDelete.slice(0, 10).map(({ doc }) => `[${doc.sourceType}] ${doc.title.substring(0, 60)}`),
    remaining: toDelete.length > 10 ? toDelete.length - 10 : 0,
  });

  if (dryRun) {
    logger.info("Dry-run complete. No sources were deleted.");
    return;
  }

  // Delete sources in batches
  logger.info("Deleting sources");
  const BATCH_SIZE = 500;
  let deleted = 0;

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = adminDb.batch();
    const batchItems = toDelete.slice(i, i + BATCH_SIZE);

    batchItems.forEach(({ id }) => {
      batch.delete(adminDb.collection("sources").doc(id));
    });

    await batch.commit();
    deleted += batchItems.length;
    logger.info("Deleted sources progress", { deleted, total: toDelete.length });
  }

  logger.info("Successfully deleted unprocessed sources", { deleted });
  logger.info("Retained sources", { count: retained.length + ingested.length });
}
