/**
 * verifyEnvSet(keys)
 * Synchronously verifies that each environment variable in `keys` exists on process.env.
 * Throws an Error listing missing keys if any are absent.
 */
export function verifyEnvSet(keys: string[]): void {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length === 0) return;

  const message = `Missing required environment variables: ${missing.join(
    ", ",
  )}. These must be set in environment to run this command.`;
  throw new Error(message);
}

/**
 * Verify at least one database backend is configured.
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY and/or MONGODB_URI.
 */
export function verifyDbEnv(): void {
  const hasFirestore =
    !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.USE_FIREBASE_EMULATORS === "true" ||
    !!process.env.FIRESTORE_EMULATOR_HOST;
  const hasMongo = !!process.env.MONGODB_URI;

  if (!hasFirestore && !hasMongo) {
    throw new Error(
      "No database configured. Set FIREBASE_SERVICE_ACCOUNT_KEY and/or MONGODB_URI in .env.local.",
    );
  }
}

export default verifyEnvSet;
