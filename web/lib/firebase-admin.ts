import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID;
const useEmulators = process.env.USE_FIREBASE_EMULATORS === "true";

function createAdminApp(): App {
  if (useEmulators) {
    // Emulator mode - no credentials needed
    console.log("[Firebase Admin] Using emulators");
    return initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
    });
  }

  // Production mode - use service account key from environment
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found!",
    );
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required. " +
        "Please add your Firebase service account JSON to .env.local",
    );
  }

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

    return initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } catch (error) {
    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", error);
    throw new Error(
      "Failed to initialize Firebase Admin SDK: Invalid service account JSON",
    );
  }
}

// Initialize Firebase Admin SDK
const apps = getApps();
const hasExistingAdminApp = apps.length > 0;
const adminApp = hasExistingAdminApp ? apps[0] : createAdminApp();
const adminDb = databaseId
  ? getFirestore(adminApp, databaseId)
  : getFirestore(adminApp);
const adminAuth = getAuth(adminApp);

// In emulator mode, ensure we connect to the emulator.
if (useEmulators && !hasExistingAdminApp) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
  const [host, port] = emulatorHost.split(":");
  adminDb.settings({
    host: `${host}:${port}`,
    ssl: false,
  });
}

export { adminApp, adminDb, adminAuth };
