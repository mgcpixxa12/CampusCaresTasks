import { state, saveState } from "./state.js?v=20260114_03";
import { escapeHtml, getPlannerDateISO, getPlannerDateLabel } from "./utils.js?v=20260114_03";
import { dayNames } from "./constants.js?v=20260114_03";
import { showTab } from "./tabs.js?v=20260114_03";

// Compute unfinished task entries for past dates (relative to user's local time)
function getUnfinishedEntries() {
  if (!state.startMondayISO) return [];

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const out = [];
  for (let w = 0; w < 4; w++) {
    for (let d = 0; d < 7; d++) {
      const iso = getPlannerDateISO(state.startMondayISO, w, d);
      if (!iso) continue;
      const dateObj = new Date(iso + "T00:00:00");
      if (dateObj >= todayMidnight) continue; // not in the past

      const entries = state.assignments?.[w]?.[d] || [];
      entries.forEach((entry, entryIndex) => {
        if (entry?.type !== "task") return;
        if (entry.done) return;

        const task = state.tasks.find(t => t.id === entry.taskId);
        if (!task) return;

        out.push({
          weekIndex: w,
          dayIndex: d,
          entryIndex,
          iso,
          dateLabel: getPlannerDateLabel(state.startMondayISO, w, d, dayNames[d]),
          taskId: task.id,
          taskName: task.name,
          minutes: task.lengthMinutes,
          locationId: entry.locationId ?? null
        });
      });
    }
  }

  // Sort oldest -> newest
  out.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
  return out;
}

export function renderUnfinishedTasks() {
  const wrapper = document.getElementById("unfinishedTasksWrapper");
  if (!wrapper) return;

  if (!state.startMondayISO) {
    wrapper.innerHTML = '<p class="no-tasks">Set a Week 1 Monday date on the Calendar tab to enable this list.</p>';
    return;
  }

  const items = getUnfinishedEntries();
  if (items.length === 0) {
    wrapper.innerHTML = '<p class="no-tasks">No unfinished tasks from past days 🎉</p>';
    return;
  }

  let html = '<table><thead><tr><th>Date</th><th>Task</th><th>Minutes</th><th>Actions</th></tr></thead><tbody>';
  items.forEach((it, idx) => {
    html += `<tr>
      <td>${escapeHtml(it.dateLabel)}</td>
      <td>${escapeHtml(it.taskName)}</td>
      <td>${escapeHtml(String(it.minutes))}</td>
      <td>
        <button data-action="done" data-i="${idx}">Mark done</button>
        <button data-action="jump" data-i="${idx}">Jump to day</button>
      </td>
    </tr>`;
  });
  html += "</tbody></table>";
  wrapper.innerHTML = html;

  wrapper.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const i = parseInt(btn.dataset.i, 10);
      const it = items[i];
      if (!it) return;

      if (action === "done") {
        const entry = state.assignments?.[it.weekIndex]?.[it.dayIndex]?.[it.entryIndex];
        if (entry && entry.type === "task") {
          entry.done = true;
          saveState();
        }
      } else if (action === "jump") {
        // Switch to Calendar tab (keeps UX simple; we can add scroll-to later)
        showTab("calendar");
      }
    });
  });
}
