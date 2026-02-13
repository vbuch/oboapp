/**
 * Database initialization for the web application.
 *
 * Lazily creates and caches an OboDb instance.
 * Used by API routes to access the database.
 */

import type { OboDb } from "@oboapp/db";

let _db: OboDb | null = null;

/**
 * Get the shared database instance.
 * Creates it on first call, returns cached instance after.
 */
export async function getDb(): Promise<OboDb> {
  if (_db) return _db;

  const { adminDb } = await import("@/lib/firebase-admin");
  const { createDb } = await import("@oboapp/db");

  _db = await createDb({ firestoreDb: adminDb });
  return _db;
}
