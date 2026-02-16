/**
 * Database initialization for the ingest pipeline.
 *
 * Lazily creates and caches an OboDb instance.
 * Uses dynamic import of firebase-admin (dotenv must load first).
 */

import type { OboDb } from "@oboapp/db";
import type { Firestore } from "firebase-admin/firestore";

let _db: OboDb | null = null;

/**
 * Get the shared database instance.
 * Creates it on first call, returns cached instance after.
 */
export async function getDb(): Promise<OboDb> {
  if (_db) return _db;

  const { createDb } = await import("@oboapp/db");

  // Only load Firestore if configured
  const hasFirestore =
    !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.USE_FIREBASE_EMULATORS === "true" ||
    !!process.env.FIRESTORE_EMULATOR_HOST;
  let firestoreDb: Firestore | undefined;

  if (hasFirestore) {
    const { adminDb } = await import("@/lib/firebase-admin");
    firestoreDb = adminDb;
  }

  _db = await createDb({ firestoreDb });
  return _db;
}

/**
 * Close the database connection (for graceful shutdown).
 */
export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.close();
    _db = null;
  }
}
