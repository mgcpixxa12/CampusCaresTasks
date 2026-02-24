import { state, saveState } from "./state.js?v=20260224_01";
import { escapeHtml, formatFrequency } from "./utils.js?v=20260224_01";
import { showTab } from "./tabs.js?v=20260224_01";

export function initLocationForm() {
  const submitBtn = document.getElementById("locationFormSubmitBtn");
  const cancelBtn = document.getElementById("locationFormCancelBtn");
  submitBtn?.addEventListener("click", handleLocationFormSubmit);
  cancelBtn?.addEventListener("click", cancelEditLocation);
}

export function handleLocationFormSubmit() {
  const nameInput = document.getElementById("locationName");
  const colorInput = document.getElementById("locationColor");

  const name = nameInput.value.trim();
  const color = colorInput.value || "#ffffaa";

  if (!name) { alert("Please enter a location name."); return; }

  if (state.editingLocationId === null) {
    const newLoc = { id: state.nextLocationId++, name, color };
    state.locations.push(newLoc);
  } else {
    const loc = state.locations.find(l => l.id === state.editingLocationId);
    if (loc) { loc.name = name; loc.color = color; }
  }

  state.editingLocationId = null;
  document.getElementById("locationFormSubmitBtn").textContent = "Add Location";
  document.getElementById("locationFormCancelBtn").style.display = "none";
  nameInput.value = "";
  colorInput.value = "#ffffaa";

  saveState(); // triggers re-render via main onChange
}

export function startEditLocation(locId) {
  const loc = state.locations.find(l => l.id === locId);
  if (!loc) return;

  state.editingLocationId = locId;
  document.getElementById("locationName").value = loc.name;
  document.getElementById("locationColor").value = loc.color || "#ffffaa";
  document.getElementById("locationFormSubmitBtn").textContent = "Save Location";
  document.getElementById("locationFormCancelBtn").style.display = "inline-block";
  showTab("locations");
}

export function cancelEditLocation() {
  state.editingLocationId = null;
  document.getElementById("locationName").value = "";
  document.getElementById("locationColor").value = "#ffffaa";
  document.getElementById("locationFormSubmitBtn").textContent = "Add Location";
  document.getElementById("locationFormCancelBtn").style.display = "none";
}

function computeLocationTaskStats(locationId) {
  const stats = new Map(); // taskId -> {occurrences, weeks:Set}

  for (let w = 0; w < 4; w++) {
    for (let d = 0; d < 7; d++) {
      const settings = state.dayCellSettings[w][d] || { startLocationId:null, startTime:null };
      let currentLocId = settings.startLocationId || null;

      const dayEntries = state.assignments[w][d];
      dayEntries.forEach(entry => {
        if (entry.type === "travel") {
          currentLocId = entry.locationId || null;
        } else if (entry.type === "task") {
          const taskLocId = ("locationId" in entry) ? entry.locationId : currentLocId;
          if (taskLocId === locationId) {
            const taskId = entry.taskId;
            let rec = stats.get(taskId);
            if (!rec) { rec = { occurrences: 0, weeks: new Set() }; stats.set(taskId, rec); }
            rec.occurrences++;
            rec.weeks.add(w);
          }
        }
      });
    }
  }

  return stats;
}

export function renderLocationsTab() {
  const wrapper = document.getElementById("locationsListWrapper");
  if (!wrapper) return;

  if (state.locations.length === 0) {
    wrapper.innerHTML = '<p class="no-locations">No locations yet. Add some above.</p>';
    return;
  }

  let html = "";

  state.locations.forEach(loc => {
    const stats = computeLocationTaskStats(loc.id);
    const relevantTasks = state.tasks.filter(t => t.location === "all" || t.location === loc.id);

    html += `<div class="location-block">
      <div class="location-header">
        <div class="location-color-swatch" style="background-color:${loc.color || "#ffffff"};"></div>
        <strong>${escapeHtml(loc.name)}</strong>
        <button type="button" data-edit-loc="${loc.id}">Edit</button>
      </div>`;

    if (relevantTasks.length === 0) {
      html += `<p class="no-tasks">No tasks assigned to this location yet.</p>`;
    } else {
      html += `<ul class="location-task-list">`;
      relevantTasks.forEach(task => {
        const stat = stats.get(task.id);
        let extra = "";
        let done = false;

        if (task.frequency === "weekly") {
          const doneWeeks = stat ? stat.weeks.size : 0;
          extra = ` – ${doneWeeks}/4`;
          done = doneWeeks >= 4;
        } else if (task.frequency === "daily") {
          const occ = stat ? stat.occurrences : 0;
          extra = ` – ${occ}/8`;
          done = occ >= 8;
        } else {
          const occ = stat ? stat.occurrences : 0;
          done = occ > 0;
        }

        html += `<li class="${done ? "done" : ""}">
          <span>${escapeHtml(task.name)} (${task.lengthMinutes}m, ${formatFrequency(task.frequency)})${extra}</span>
        </li>`;
      });
      html += `</ul>`;
    }

    html += `</div>`;
  });

  wrapper.innerHTML = html;

  wrapper.querySelectorAll("[data-edit-loc]").forEach(btn => {
    btn.addEventListener("click", () => startEditLocation(parseInt(btn.dataset.editLoc,10)));
  });
}
