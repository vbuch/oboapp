import type { Firestore } from "firebase-admin/firestore";

interface SourceDocument {
  sourceType: string;
  url: string;
  title: string;
}

/**
 * Get all source document IDs that have been ingested into messages
 */
async function getIngestedSourceIds(adminDb: Firestore): Promise<Set<string>> {
  console.log("📊 Checking which sources have been ingested...");

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

  console.log(`   Found ${ingestedIds.size} ingested source(s)`);
  return ingestedIds;
}

/**
 * Delete all unprocessed sources except for the specified source type
 */
export async function cleanSources(
  retainSourceType: string,
  dryRun: boolean,
): Promise<void> {
  console.log(`🧹 Cleaning sources (${dryRun ? "dry-run" : "production"})\n`);
  console.log(`📌 Retaining source type: ${retainSourceType}\n`);

  // Dynamically import firebase-admin after env is loaded
  const { adminDb } = await import("@/lib/firebase-admin");

  // Get all sources
  const sourcesSnapshot = await adminDb.collection("sources").get();
  console.log(`📦 Total sources in database: ${sourcesSnapshot.size}\n`);

  if (sourcesSnapshot.empty) {
    console.log("✨ No sources found in database");
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
  console.log("\n" + "=".repeat(80));
  console.log("📊 Summary");
  console.log("=".repeat(80));
  console.log(`✅ Retained (${retainSourceType}): ${retained.length}`);
  console.log(`🔗 Retained (ingested): ${ingested.length}`);
  console.log(`❌ To delete (unprocessed): ${toDelete.length}`);
  console.log("=".repeat(80) + "\n");

  if (toDelete.length === 0) {
    console.log("✨ No sources to delete");
    return;
  }

  // Show samples of what will be deleted
  console.log("📋 Sources to delete (first 10):");
  toDelete.slice(0, 10).forEach(({ doc }) => {
    console.log(`   - [${doc.sourceType}] ${doc.title.substring(0, 60)}...`);
  });
  if (toDelete.length > 10) {
    console.log(`   ... and ${toDelete.length - 10} more\n`);
  }

  if (dryRun) {
    console.log("\n🔍 Dry-run complete. No sources were deleted.");
    return;
  }

  // Delete sources in batches
  console.log("\n🗑️  Deleting sources...");
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
    console.log(`   Deleted ${deleted}/${toDelete.length} sources...`);
  }

  console.log(`\n✅ Successfully deleted ${deleted} unprocessed source(s)`);
  console.log(`✅ Retained ${retained.length + ingested.length} source(s)`);
}
