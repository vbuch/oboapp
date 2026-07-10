import { initializeApp, getApps } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
const useMsw = process.env.NEXT_PUBLIC_USE_MSW === "true";

const firebaseConfig =
  useEmulators || useMsw
    ? {
        apiKey: "demo-api-key",
        authDomain: "demo-project.firebaseapp.com",
        projectId:
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
        storageBucket: "demo-project.appspot.com",
        messagingSenderId: "123456789",
        appId: "demo-app-id",
      }
    : {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };

const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID;
const apps = getApps();
const hasExistingApp = apps.length > 0;
const app = hasExistingApp ? apps[0] : initializeApp(firebaseConfig);
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
const auth = getAuth(app);

// Connect to emulators only when this module initializes a fresh app.
if (useEmulators && !hasExistingApp) {
  connectFirestoreEmulator(db, "localhost", 8080);
  connectAuthEmulator(auth, "http://localhost:9099", {
    disableWarnings: true,
  });
}

export { app, db, auth };
