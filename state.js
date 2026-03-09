import { FIREBASE_CONFIG } from "./constants.js?v=20260224_06";

// Firebase modular SDK (CDN ESM)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function assertConfig() {
  const required = ["apiKey","authDomain","projectId","appId"];
  const missing = required.filter(k => !FIREBASE_CONFIG?.[k]);
  if (missing.length) {
    console.warn("Firebase not configured. Please fill FIREBASE_CONFIG in constants.js. Missing:", missing.join(", "));
    return false;
  }
  return true;
}

export const firebaseReady = assertConfig();

export const firebaseApp = firebaseReady ? initializeApp(FIREBASE_CONFIG) : null;
export const auth = firebaseReady ? getAuth(firebaseApp) : null;
export const db = firebaseReady ? getFirestore(firebaseApp) : null;
