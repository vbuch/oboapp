import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

let adminApp: App;
let adminDb: Firestore;
let adminAuth: Auth;

const databaseId = process.env.FIREBASE_DATABASE_ID;
const useEmulators = process.env.USE_FIREBASE_EMULATORS === "true";

// Initialize Firebase Admin SDK
if (!getApps().length) {
  if (useEmulators) {
    // Emulator mode - no credentials needed
    console.log("[Firebase Admin] Using emulators");
    adminApp = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
    });
  } else {
    // Production mode - use service account key from environment
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(
          process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
        );

        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      } catch (error) {
        console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", error);
        throw new Error(
          "Failed to initialize Firebase Admin SDK: Invalid service account JSON",
        );
      }
    } else {
      console.error(
        "FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found!",
      );
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required. " +
          "Please add your Firebase service account JSON to .env.local",
      );
    }
  }

  adminDb = databaseId
    ? getFirestore(adminApp, databaseId)
    : getFirestore(adminApp);
  adminAuth = getAuth(adminApp);

  // In emulator mode, ensure we connect to the emulator
  if (useEmulators) {
    const emulatorHost =
      process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
    const [host, port] = emulatorHost.split(":");
    adminDb.settings({
      host: `${host}:${port}`,
      ssl: false,
    });
  }
} else {
  adminApp = getApps()[0];
  adminDb = databaseId
    ? getFirestore(adminApp, databaseId)
    : getFirestore(adminApp);
  adminAuth = getAuth(adminApp);
}

export { adminApp, adminDb, adminAuth };
