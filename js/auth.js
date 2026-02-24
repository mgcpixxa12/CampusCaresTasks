import { ADMIN_EMAILS, LOGIN_STORAGE_KEY, APP_VERSION } from "./constants.js?v=20260224_06";
import { applyLoadedState, getSerializableState, saveStateLocalOnly, setDriveSaveScheduler, state, resetStateToEmpty } from "./state.js?v=20260224_06";
import { auth, db, firebaseReady } from "./firebase.js?v=20260224_06";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const loginState = { user: null, role: "guest" };

const els = { signin: null, signOutBtn: null, sessionText: null };

let saveTimer = null;


function encodeStateForFirestore(obj) {
  // Firestore does not support nested arrays. We store the state as a JSON string payload.
  // This is reliable and keeps schema stable across future UI changes.
  return {
    payload: JSON.stringify(obj ?? {}),
    lastModified: typeof obj?.lastModified === "number" ? obj.lastModified : Date.now()
  };
}

function decodeStateFromFirestore(docData) {
  if (!docData) return null;
  // New format
  if (typeof docData.payload === "string") {
    try { return JSON.parse(docData.payload); } catch { return null; }
  }
  // Legacy format (pre-payload)
  return docData;
}
function setVersionLabel() {
  const v = document.getElementById("versionLabel");
  if (!v) return;
  v.textContent = APP_VERSION || "";
}

function updateLoginUI() {
  if (!els.sessionText || !els.signOutBtn) return;

  if (!firebaseReady) {
    els.sessionText.textContent = "Firebase not configured";
    els.signOutBtn.classList.add("hidden");
    if (els.signin) {
      els.signin.innerHTML = "";
      const b = document.createElement("button");
      b.className = "btn secondary";
      b.textContent = "Configure Firebase";
      b.onclick = () => alert("Fill FIREBASE_CONFIG in js/constants.js (apiKey, authDomain, projectId, appId, etc). Then redeploy.");
      els.signin.appendChild(b);
    }
    return;
  }

  if (loginState.user) {
    const u = loginState.user;
    els.sessionText.textContent = `Signed in as ${u.name || u.email}`;
    els.signOutBtn.classList.remove("hidden");
    if (els.signin) els.signin.innerHTML = "";
  } else {
    els.sessionText.textContent = "Not signed in";
    els.signOutBtn.classList.add("hidden");
    renderSignInButton();
  }
}

function renderSignInButton() {
  if (!els.signin) return;
  if (loginState.user) { els.signin.innerHTML = ""; return; }

  // Email/password auth UI
  els.signin.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "auth-box";

  const email = document.createElement("input");
  email.type = "email";
  email.placeholder = "Email";
  email.autocomplete = "email";
  email.className = "auth-input";

  const pass = document.createElement("input");
  pass.type = "password";
  pass.placeholder = "Password";
  pass.autocomplete = "current-password";
  pass.className = "auth-input";

  const row = document.createElement("div");
  row.className = "auth-row";

  const btnIn = document.createElement("button");
  btnIn.className = "btn primary";
  btnIn.textContent = "Sign in";

  const btnUp = document.createElement("button");
  btnUp.className = "btn secondary";
  btnUp.textContent = "Create account";

  const link = document.createElement("button");
  link.type = "button";
  link.className = "link-btn";
  link.textContent = "Forgot password?";

  const getCreds = () => ({
    email: String(email.value || "").trim(),
    pass: String(pass.value || "")
  });

  const ensure = () => {
    const c = getCreds();
    if (!c.email || !c.pass) {
      alert("Enter email and password.");
      return null;
    }
    return c;
  };

  btnIn.addEventListener("click", async () => {
    const c = ensure(); if (!c) return;
    try {
      await signInWithEmailAndPassword(auth, c.email, c.pass);
    } catch (e) {
      console.error("Email sign-in failed:", e);
      const msg = (e && (e.code || e.message)) ? String(e.code || e.message) : "Sign-in failed";
      alert("Sign-in failed: " + msg);
    }
  });

  btnUp.addEventListener("click", async () => {
    const c = ensure(); if (!c) return;
    try {
      await createUserWithEmailAndPassword(auth, c.email, c.pass);
    } catch (e) {
      console.error("Create account failed:", e);
      const msg = (e && (e.code || e.message)) ? String(e.code || e.message) : "Create account failed";
      alert("Create account failed: " + msg);
    }
  });

  link.addEventListener("click", async () => {
    const em = String(email.value || "").trim();
    if (!em) { alert("Enter your email first, then click Forgot password."); return; }
    try {
      await sendPasswordResetEmail(auth, em);
      alert("Password reset email sent (check inbox/spam).");
    } catch (e) {
      console.error("Password reset failed:", e);
      const msg = (e && (e.code || e.message)) ? String(e.code || e.message) : "Password reset failed";
      alert("Password reset failed: " + msg);
    }
  });

  // Enter key = sign in
  pass.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") btnIn.click();
  });

  row.appendChild(btnIn);
  row.appendChild(btnUp);

  wrap.appendChild(email);
  wrap.appendChild(pass);
  wrap.appendChild(row);
  wrap.appendChild(link);

  els.signin.appendChild(wrap);
}


function scheduleFirestoreSave() {
  if (!loginState.user || !firebaseReady) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const uid = loginState.user.uid;
      const data = getSerializableState();
      const encoded = encodeStateForFirestore(data);
      await setDoc(doc(db, "plannerStates", uid), {
        ...encoded,
        updatedAt: serverTimestamp()
      });
} catch (e) {
      console.warn("Firestore save failed:", e);
    }
  }, 600);
}

async function loadFromFirestoreIfPossible() {
  if (!loginState.user || !firebaseReady) return false;
  try {
    const uid = loginState.user.uid;
    const ref = doc(db, "plannerStates", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // First login for this UID.
      // SECURITY: Do NOT seed a brand-new account from whatever might be in this browser's localStorage.
      // That can leak old data on shared devices. Start blank and create the Firestore doc.
      resetStateToEmpty();
      saveStateLocalOnly();
      await setDoc(ref, { ...encodeStateForFirestore(getSerializableState()), updatedAt: serverTimestamp() });
      return true;
    }

    const rawRemote = snap.data() || {};
    const remote = decodeStateFromFirestore(rawRemote) || {};
    const remoteLast = typeof remote.lastModified === "number" ? remote.lastModified : 0;
    const localLast = typeof state.lastModified === "number" ? state.lastModified : 0;

    // If remote is newer, adopt it. Otherwise keep local and push local up.
    if (remoteLast > localLast) {
      applyLoadedState(remote);
      saveStateLocalOnly();
      return true;
    } else if (localLast > remoteLast) {
      await setDoc(ref, { ...encodeStateForFirestore(getSerializableState()), updatedAt: serverTimestamp() });
      return false;
    }
  } catch (e) {
    console.warn("Firestore load failed:", e);
  }
  return false;
}

export function initLogin({ onLoaded } = {}) {
  els.signin = document.getElementById("signin");
  els.signOutBtn = document.getElementById("signOutBtn");
  els.sessionText = document.getElementById("sessionText");

  setVersionLabel();

  els.signOutBtn?.addEventListener("click", async () => {
    try { await signOut(auth); } catch (e) { console.warn(e); }
  });

  // Keep the existing plumbing: saveState() will call this scheduler.
  setDriveSaveScheduler(scheduleFirestoreSave);

  // Restore cached login info (purely for UI while Firebase initializes)
  try {
    const raw = localStorage.getItem(LOGIN_STORAGE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached?.user?.email) {
        loginState.user = cached.user;
        loginState.role = cached.role || "user";
      }
    }
  } catch {}

  updateLoginUI();

  if (!firebaseReady) return;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const email = String(user.email || "").toLowerCase();
      loginState.user = { uid: user.uid, email, name: user.displayName || "" };
      loginState.role = ADMIN_EMAILS.has(email) ? "admin" : "user";
      try { localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(loginState)); } catch {}
      updateLoginUI();

      try { window.dispatchEvent(new CustomEvent("cc-auth-changed", { detail: { user: loginState.user, role: loginState.role } })); } catch {}

      const loaded = await loadFromFirestoreIfPossible();
      if (loaded && typeof onLoaded === "function") onLoaded();
    } else {
      loginState.user = null;
      loginState.role = "guest";
      try { localStorage.removeItem(LOGIN_STORAGE_KEY); } catch {}
      updateLoginUI();
      try { window.dispatchEvent(new CustomEvent("cc-auth-changed", { detail: { user: null, role: "guest" } })); } catch {}
      if (typeof onLoaded === "function") onLoaded();
    }
  });
}
