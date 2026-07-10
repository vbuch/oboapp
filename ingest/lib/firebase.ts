import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const app = getApps().length ? getApps()[0] : initializeApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
