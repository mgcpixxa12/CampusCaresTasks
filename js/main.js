import { loadState, setOnChange, state, saveState, setStorageNamespace, resetStateToEmpty } from "./state.js?v=20260224_06";
import { initTabs } from "./tabs.js?v=20260224_06";
import { initLogin } from "./auth.js?v=20260224_06";
import { populateTaskLocationOptions, renderTaskList, initTaskForm } from "./tasks.js?v=20260224_06";
import { renderLocationsTab, initLocationForm } from "./locations.js?v=20260224_06";
import { renderCalendarHeader, renderCalendar, resetAllDone } from "./calendar.js?v=20260224_06";
import { renderUnfinishedTasks } from "./unfinished.js?v=20260224_06";
import { initTrackedTasksUI, renderTrackedTasks, refreshTrackedFormOptions } from "./tracked.js?v=20260224_06";

function rerenderAll() {
  // Keep the small, cheap render order consistent
  populateTaskLocationOptions();
  renderTaskList();
  renderLocationsTab();
  renderCalendarHeader();
  renderCalendar();
  renderUnfinishedTasks();
  // Keep Week-1 Monday date input synced with state (important after Drive load)
  const startDateInput = document.getElementById("startMondayDate");
  const startHint = document.getElementById("startMondayHint");
  if (startDateInput) {
    const nextVal = state.startMondayISO || "";
    if (startDateInput.value !== nextVal) startDateInput.value = nextVal;
  }
  if (startHint) {
    startHint.textContent = state.startMondayISO ? "" : "(required for Unfinished Tasks)";
  }
  refreshTrackedFormOptions();
  renderTrackedTasks();
}


function setAppHidden(hidden) {
  const tabs = document.querySelector(".tab-buttons");
  const main = document.querySelector("main");
  if (tabs) tabs.classList.toggle("hidden", hidden);
  if (main) main.classList.toggle("hidden", hidden);
  const headerBtns = document.getElementById("printBtn");
  const resetBtn = document.getElementById("resetDoneBtn");
  if (headerBtns) headerBtns.classList.toggle("hidden", hidden);
  if (resetBtn) resetBtn.classList.toggle("hidden", hidden);
}

document.addEventListener("DOMContentLoaded", () => {
  // Hide everything until a user signs in
  setStorageNamespace(null);
  resetStateToEmpty();
  setAppHidden(true);

  initTabs();
  initTaskForm();
  initLocationForm();
  initTrackedTasksUI();

  // Re-render whenever saveState() is called
  setOnChange(rerenderAll);

  
  // Week 1 Monday date picker
  const startDateInput = document.getElementById("startMondayDate");
  const startHint = document.getElementById("startMondayHint");
  if (startDateInput) {
    startDateInput.value = state.startMondayISO || "";
    const updateHint = () => {
      if (!startHint) return;
      startHint.textContent = state.startMondayISO ? "" : "(required for Unfinished Tasks)";
    };
    updateHint();

    startDateInput.addEventListener("change", () => {
      const v = startDateInput.value || "";
      state.startMondayISO = v ? v : null;
      updateHint();
      saveState();
    });
  }

// Initial render
  rerenderAll();

  // Login (Drive sync). After Drive load, re-render.
  const clientId = document.querySelector('meta[name="google-signin-client_id"]')?.content || "";

  // React to auth changes (enforces per-user state + hides tool when signed out)
  window.addEventListener("cc-auth-changed", (ev) => {
    const detail = ev?.detail || {};
    const user = detail.user || null;

    if (user && user.uid) {
      // Namespace localStorage per-user ONLY.
      // IMPORTANT: Do NOT auto-migrate legacy (pre-login) localStorage keys.
      // Auto-migration can leak data on shared devices or for brand-new accounts.
      setStorageNamespace(user.uid, { allowLegacyMigration: false });

      // Load per-user cached state (UID-namespaced) as a fast local fallback.
      // Firestore will still load and override if it has newer data.
      loadState();
      rerenderAll();
      setAppHidden(false);
    } else {
      // Signed out: clear in-memory state and hide UI (prevents others on this device from seeing prior data)
      setStorageNamespace(null);
      resetStateToEmpty();
      rerenderAll();
      setAppHidden(true);
    }
  });

  initLogin({ onLoaded: rerenderAll });

  document.getElementById("printBtn")?.addEventListener("click", () => {
  // Ensure calendar + unfinished tasks are freshly rendered before printing
  rerenderAll();
  // Print after the DOM has had a moment to apply changes (Drive sync, latest edits)
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
});
document.getElementById("resetDoneBtn")?.addEventListener("click", resetAllDone);

  // Drag mode radios
  document.querySelectorAll('input[name="dragMode"]').forEach(input => {
    input.addEventListener("change", () => {
      state.dragMode = input.value === "swap" ? "swap" : "insert";
    });
  });

  // Week visibility toggles
  document.querySelectorAll(".week-toggle").forEach(cb => {
    const w = parseInt(cb.dataset.week, 10);
    if (!isNaN(w) && w >= 0 && w < 4) {
      cb.checked = state.weekVisibility[w];
      cb.addEventListener("change", () => {
        state.weekVisibility[w] = cb.checked;
        saveState();
      });
    }
  });
});
