import { ADMIN_EMAILS, LOGIN_STORAGE_KEY, DRIVE_FILE_NAME, DRIVE_SCOPE } from "./constants.js?v=20260114_03";
import { state, applyLoadedState, getSerializableState, saveStateLocalOnly, setDriveSaveScheduler } from "./state.js?v=20260114_03";

export const loginState = { user: null, role: "guest" };

const loginEls = { signin: null, signOutBtn: null, sessionText: null, driveReconnectBtn: null };

const driveState = {
  tokenClient: null,
  accessToken: null,
  accessTokenExpiresAt: 0,
  needsReconnect: false,
  fileId: null,
  firstLoadAttempted: false,
  lastSaveTimeout: null
};


function setDriveReconnectVisible(visible) {
  if (!loginEls.driveReconnectBtn) return;
  if (visible) loginEls.driveReconnectBtn.classList.remove("hidden");
  else loginEls.driveReconnectBtn.classList.add("hidden");
}

function decodeJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(decodeURIComponent(Array.prototype.map.call(
      json, c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
    ).join("")));
  } catch {
    return null;
  }
}

function updateLoginUI() {
  if (!loginEls.sessionText || !loginEls.signOutBtn) return;
  if (loginState.user) {
    const u = loginState.user;
    loginEls.sessionText.textContent = `Signed in as ${u.name || u.email}`;
    loginEls.signOutBtn.classList.remove("hidden");
    // Drive reconnect button visibility depends on whether we can silently save.
    setDriveReconnectVisible(!!driveState.needsReconnect);
    if (loginEls.signin) loginEls.signin.innerHTML = "";
  } else {
    loginEls.sessionText.textContent = "Not signed in";
    loginEls.signOutBtn.classList.add("hidden");
    setDriveReconnectVisible(false);
    driveState.needsReconnect = false;
  }
}

function renderSignInButton(clientId) {
  if (!loginEls.signin) return;
  if (loginState.user) { loginEls.signin.innerHTML = ""; return; }

  loginEls.signin.innerHTML = "";

  if (!(window.google && google.accounts && google.accounts.id)) {
    const span = document.createElement("span");
    span.className = "muted";
    span.textContent = "Loading sign-in…";
    loginEls.signin.appendChild(span);
    setTimeout(() => renderSignInButton(clientId), 500);
    return;
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: (resp) => {
      const p = decodeJwt(resp.credential);
      if (!p) return;
      const email = String(p.email || "").toLowerCase();
      loginState.user = { email, name: p.name || "" };
      loginState.role = ADMIN_EMAILS.has(email) ? "admin" : "user";
      try { localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(loginState)); } catch {}
      updateLoginUI();
      loginEls.signin.innerHTML = "";
      loadFromDriveIfPossible(clientId);
    },
    auto_select: false,
    ux_mode: "popup"
  });

  const btnContainer = document.createElement("div");
  loginEls.signin.appendChild(btnContainer);
  google.accounts.id.renderButton(btnContainer, { theme: "filled_blue", size: "medium" });
}

function ensureDriveTokenAsync(clientId, { interactive = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!loginState.user) return reject(new Error("Not signed in; Drive sync disabled."));
    if (!(window.google && google.accounts && google.accounts.oauth2)) return reject(new Error("Google OAuth2 library not ready"));

    // If we already have a token and it isn't expired, use it.
    if (driveState.accessToken && Date.now() < (driveState.accessTokenExpiresAt || 0)) {
      return resolve(driveState.accessToken);
    }

    // If we can't interact (no user gesture), do NOT trigger a Google prompt.
    // Instead, mark that we need the user to click "Reconnect Drive".
    if (!interactive) {
      driveState.needsReconnect = true;
      updateLoginUI();
      return reject(new Error("DRIVE_NEEDS_USER_GESTURE"));
    }

    if (!driveState.tokenClient) {
      driveState.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: () => {}
      });
    }

    driveState.tokenClient.callback = (tokenResponse) => {
      if (tokenResponse.error) {
        driveState.needsReconnect = true;
        updateLoginUI();
        reject(tokenResponse);
      } else {
        driveState.accessToken = tokenResponse.access_token;
        const expiresIn = Number(tokenResponse.expires_in || 0);
        // Subtract a little buffer so we don't attempt to use it at the exact expiry.
        driveState.accessTokenExpiresAt = Date.now() + Math.max(0, expiresIn - 60) * 1000;
        driveState.needsReconnect = false;
        updateLoginUI();
        resolve(driveState.accessToken);
      }
    };

    // First time: may show an account/consent UI. After that, it should be silent.
    driveState.tokenClient.requestAccessToken({ prompt: "" });
  });
}

async function createOrUpdateDriveFile(clientId) {
  if (!loginState.user) return;
  try {
    const token = await ensureDriveTokenAsync(clientId, { interactive: false });
    const payload = JSON.stringify(getSerializableState());

    if (!driveState.fileId) {
      const metaRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: "application/json" })
      });
      const meta = await metaRes.json();
      if (meta && meta.id) driveState.fileId = meta.id;
    }

    if (driveState.fileId) {
      await fetch("https://www.googleapis.com/upload/drive/v3/files/" + encodeURIComponent(driveState.fileId) + "?uploadType=media", {
        method: "PATCH",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: payload
      });
    }
  } catch (e) {
    console.warn("Drive save failed:", e);
  }
}

function scheduleSaveToDriveFactory(clientId) {
  return function scheduleSaveToDrive() {
    if (!loginState.user) return;
    if (driveState.lastSaveTimeout) clearTimeout(driveState.lastSaveTimeout);
    driveState.lastSaveTimeout = setTimeout(() => {
      driveState.lastSaveTimeout = null;
      createOrUpdateDriveFile(clientId);
    }, 2000);
  };
}

export async function loadFromDriveIfPossible(clientId, {onLoaded} = {}) {
  if (!loginState.user) return;
  driveState.firstLoadAttempted = true;

  try {
    const token = await ensureDriveTokenAsync(clientId, { interactive: false });

    const q = `name = '${DRIVE_FILE_NAME}' and trashed = false`;
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
      { headers: { "Authorization": "Bearer " + token } }
    );

    const listText = await listRes.text();
    let listJson;
    try { listJson = JSON.parse(listText); } catch (e) { console.warn("Failed to parse Drive list response:", e); return; }

    if (listJson.files && listJson.files.length > 0) {
      const file = listJson.files[0];
      driveState.fileId = file.id;

      const contentRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { "Authorization": "Bearer " + token } }
      );

      const text = await contentRes.text();
      if (!contentRes.ok) { console.warn("Drive content fetch not OK:", text); return; }

      let data;
      try { data = JSON.parse(text); } catch (e) { console.warn("Failed to parse planner-data.json:", e); return; }

      if (data && typeof data === "object") {
        // Avoid overwriting newer local changes with an older Drive file.
        const driveLM = typeof data.lastModified === "number" ? data.lastModified : 0;
        const localLM = typeof state.lastModified === "number" ? state.lastModified : 0;

        if (localLM && driveLM && localLM > driveLM) {
          // Local is newer: keep it and push local up to Drive.
          await createOrUpdateDriveFile(clientId);
          if (typeof onLoaded === "function") onLoaded();
          return;
        }

        applyLoadedState(data);
        // Update local cache but do NOT auto-trigger Drive save
        saveStateLocalOnly();
        if (typeof onLoaded === "function") onLoaded();
        return;
      }
    }

    // If no file found, create one from current local state
    await createOrUpdateDriveFile(clientId);
  } catch (e) {
    console.warn("Drive load failed:", e);
  }
}

export function initLogin({ clientId, onLoaded } = {}) {
  loginEls.signin = document.getElementById("signin");
  loginEls.signOutBtn = document.getElementById("signOutBtn");
  loginEls.sessionText = document.getElementById("sessionText");
  loginEls.driveReconnectBtn = document.getElementById("driveReconnectBtn");

  // Restore previous login (if any)
  try {
    const raw = localStorage.getItem(LOGIN_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.user) { loginState.user = saved.user; loginState.role = saved.role || "user"; }
    }
  } catch {}

  if (loginEls.signOutBtn) {
    loginEls.signOutBtn.addEventListener("click", () => {
      loginState.user = null;
      loginState.role = "guest";
      driveState.accessToken = null;
      driveState.accessTokenExpiresAt = 0;
      driveState.needsReconnect = false;
      driveState.fileId = null;
      try { localStorage.removeItem(LOGIN_STORAGE_KEY); } catch {}
      updateLoginUI();
      renderSignInButton(clientId);
    });
  if (loginEls.driveReconnectBtn) {
    loginEls.driveReconnectBtn.addEventListener("click", async () => {
      try {
        await ensureDriveTokenAsync(clientId, { interactive: true });
        // After reconnect, do an immediate save so Drive catches up.
        await createOrUpdateDriveFile(clientId);
      } catch (e) {
        console.warn("Drive reconnect failed:", e);
      }
    });
  }

  }

  updateLoginUI();
  renderSignInButton(clientId);

  // Register Drive-save hook for state.saveState()
  setDriveSaveScheduler(scheduleSaveToDriveFactory(clientId));

  // If already logged in from previous session, try Drive sync
  if (loginState.user) {
    ensureDriveTokenAsync(clientId, { interactive: true })
            .then(() => loadFromDriveIfPossible(clientId, { onLoaded }))
            .catch(() => loadFromDriveIfPossible(clientId, { onLoaded }));
  }
}
