import { state, saveState } from "./state.js?v=20260224_06";
import { escapeHtml, getPlannerDateISO, getPlannerDateLabel } from "./utils.js?v=20260224_06";
import { dayNames } from "./constants.js?v=20260224_06";
import { showTab } from "./tabs.js?v=20260224_06";

function getTodayMidnight() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function getCurrentWeekMonday(todayMidnight) {
  const monday = new Date(todayMidnight);
  const jsDay = monday.getDay();
  const offsetFromMonday = (jsDay + 6) % 7; // Monday=0, Sunday=6
  monday.setDate(monday.getDate() - offsetFromMonday);
  return monday;
}

function resolveTaskLocationId(task, entry) {
  if (entry && entry.locationId) return entry.locationId;
  if (task && task.location && task.location !== "all") return task.location;
  return null;
}

function getLocationGroupMeta(locationId) {
  if (!locationId) {
    return { key: "unassigned", name: "Unassigned / All locations" };
  }
  const loc = state.locations.find(l => l.id === locationId);
  return {
    key: `loc-${locationId}`,
    name: loc?.name || "Unknown location"
  };
}

// Compute unfinished task entries for past dates (relative to user's local time)
function getUnfinishedEntries() {
  if (!state.startMondayISO) return [];

  const todayMidnight = getTodayMidnight();
  const currentWeekMonday = getCurrentWeekMonday(todayMidnight);

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
        if (!["weekly", "monthly"].includes(task.frequency)) return;

        if (task.frequency === "weekly" && dateObj < currentWeekMonday) return;

        const locationId = resolveTaskLocationId(task, entry);
        const group = getLocationGroupMeta(locationId);

        out.push({
          weekIndex: w,
          dayIndex: d,
          entryIndex,
          iso,
          dateLabel: getPlannerDateLabel(state.startMondayISO, w, d, dayNames[d]),
          taskId: task.id,
          taskName: task.name,
          minutes: task.lengthMinutes,
          frequency: task.frequency,
          locationId,
          locationGroupKey: group.key,
          locationGroupName: group.name
        });
      });
    }
  }

  // Sort oldest -> newest, then by location name
  out.sort((a, b) => {
    if (a.iso !== b.iso) return a.iso < b.iso ? -1 : 1;
    return a.locationGroupName.localeCompare(b.locationGroupName);
  });
  return out;
}

function groupEntriesByLocation(items) {
  const groups = new Map();
  items.forEach(item => {
    if (!groups.has(item.locationGroupKey)) {
      groups.set(item.locationGroupKey, {
        key: item.locationGroupKey,
        name: item.locationGroupName,
        items: []
      });
    }
    groups.get(item.locationGroupKey).items.push(item);
  });

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
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
    wrapper.innerHTML = '<p class="no-tasks">No unfinished weekly or monthly tasks from past days 🎉</p>';
    return;
  }

  const groups = groupEntriesByLocation(items);
  let html = '<div class="unfinished-groups">';

  groups.forEach(group => {
    html += `
      <section class="unfinished-location-card">
        <h3>${escapeHtml(group.name)}</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Task</th>
              <th>Frequency</th>
              <th>Minutes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
    `;

    group.items.forEach((it, idx) => {
      html += `<tr>
        <td>${escapeHtml(it.dateLabel)}</td>
        <td>${escapeHtml(it.taskName)}</td>
        <td>${escapeHtml(it.frequency === "weekly" ? "Weekly" : "Monthly")}</td>
        <td>${escapeHtml(String(it.minutes))}</td>
        <td>
          <button data-action="done" data-key="${escapeHtml(group.key)}" data-i="${idx}">Mark done</button>
          <button data-action="jump" data-key="${escapeHtml(group.key)}" data-i="${idx}">Jump to day</button>
        </td>
      </tr>`;
    });

    html += '</tbody></table></section>';
  });

  html += '</div>';
  wrapper.innerHTML = html;

  const groupsByKey = new Map(groups.map(group => [group.key, group.items]));

  wrapper.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const key = btn.dataset.key || "";
      const i = parseInt(btn.dataset.i, 10);
      const groupItems = groupsByKey.get(key) || [];
      const it = groupItems[i];
      if (!it) return;

      if (action === "done") {
        const entry = state.assignments?.[it.weekIndex]?.[it.dayIndex]?.[it.entryIndex];
        if (entry && entry.type === "task") {
          entry.done = true;
          saveState();
        }
      } else if (action === "jump") {
        showTab("calendar");
      }
    });
  });
}
