import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  Firestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  getAuth,
  Auth,
  connectAuthEmulator,
  onAuthStateChanged,
} from "firebase/auth";

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
const useMSW = process.env.NEXT_PUBLIC_USE_MSW === "true";

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

/**
 * MSW Mode: Override auth state with mock user
 * This provides a pre-authenticated user for front-end development without Firebase.
 * Double-gated: requires both NEXT_PUBLIC_USE_MSW=true AND a non-production environment
 * so mock auth can never activate in a production build/runtime.
 */
if (
  useMSW &&
  process.env.NODE_ENV === "development" &&
  typeof globalThis.window !== "undefined"
) {
  // Import mock user dynamically to avoid server-side issues
  const { MOCK_USER } = await import("@/__mocks__/firebase-auth");

  // Override the global onAuthStateChanged export
  Object.defineProperty(auth, "onAuthStateChanged", {
    value: (
      nextOrObserver: Parameters<typeof onAuthStateChanged>[1],
      error?: Parameters<typeof onAuthStateChanged>[2],
      completed?: Parameters<typeof onAuthStateChanged>[3],
    ) => {
      // If it's a callback function, call it with mock user
      if (typeof nextOrObserver === "function") {
        nextOrObserver(MOCK_USER);
      } else if (nextOrObserver && "next" in nextOrObserver) {
        // If it's an observer object with next method
        nextOrObserver.next(MOCK_USER);
      }
      // Return unsubscribe function
      return () => {};
    },
    writable: true,
    configurable: true,
  });

  console.log(
    "[Firebase Client] MSW mode enabled - auth is handled in AuthProvider",
  );
}
