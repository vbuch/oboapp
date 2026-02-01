import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  Firestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getAuth, Auth, connectAuthEmulator } from "firebase/auth";

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

const firebaseConfig = useEmulators
  ? {
      apiKey: "demo-api-key",
      authDomain: "demo-project.firebaseapp.com",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
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

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  auth = getAuth(app);

  // Connect to emulators if enabled
  if (useEmulators) {
    console.log("[Firebase Client] Connecting to emulators");
    connectFirestoreEmulator(db, "localhost", 8080);
    connectAuthEmulator(auth, "http://localhost:9099", {
      disableWarnings: true,
    });
  }
} else {
  app = getApps()[0];
  db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  auth = getAuth(app);
}

export { app, db, auth };
