import { loadState, setOnChange, state, saveState } from "./state.js";
import { initTabs } from "./tabs.js";
import { initLogin } from "./auth.js";
import { populateTaskLocationOptions, renderTaskList, initTaskForm } from "./tasks.js";
import { renderLocationsTab, initLocationForm } from "./locations.js";
import { renderCalendarHeader, renderCalendar, resetAllDone } from "./calendar.js";
import { renderUnfinishedTasks } from "./unfinished.js";
import { initTrackedTasksUI, renderTrackedTasks, refreshTrackedFormOptions } from "./tracked.js";

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

document.addEventListener("DOMContentLoaded", () => {
  loadState();
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
  initLogin({ clientId, onLoaded: rerenderAll });

  document.getElementById("printBtn")?.addEventListener("click", () => window.print());
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
