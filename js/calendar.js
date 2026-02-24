import { state, saveState } from "./state.js?v=20260224_05";
import { dayNames } from "./constants.js?v=20260224_05";
import { escapeHtml, formatFrequency, formatMinutesTo12hTime, formatMinutesToHHMM, getLocationColorById, getLocationNameByValue, getPlannerDateLabel } from "./utils.js?v=20260224_05";
import { populateTaskLocationOptions, renderTaskList } from "./tasks.js?v=20260224_05";
import { renderLocationsTab } from "./locations.js?v=20260224_05";

export function renderCalendarHeader() {
  const headerRow = document.getElementById("calendarDayHeader");
  if (!headerRow) return;
  headerRow.innerHTML = "";
}

function computeVisibleDayIndexes() {
  const visible = [];
  for (let d = 0; d <= 4; d++) visible.push(d);
  for (let d = 5; d <= 6; d++) {
    let used = false;
    for (let w = 0; w < 4 && !used; w++) {
      const entries = (state.assignments[w] && state.assignments[w][d]) || [];
      const settings = (state.dayCellSettings[w] && state.dayCellSettings[w][d]) || { startLocationId:null, startTime:null };
      if (entries.length > 0 || settings.startLocationId || settings.startTime) used = true;
    }
    if (used) visible.push(d);
  }
  return visible;
}

function getCurrentLocationForDay(weekIndex, dayIndex) {
  const settings = state.dayCellSettings[weekIndex][dayIndex] || { startLocationId:null, startTime:null };
  let currentLocId = settings.startLocationId || null;
  const dayEntries = state.assignments[weekIndex][dayIndex] || [];
  dayEntries.forEach(entry => {
    if (entry.type === "travel") currentLocId = entry.locationId || null;
  });
  return currentLocId;
}

function isTaskBlockedForLocation(task, weekIndex, dayIndex, targetLocationId) {
  const taskId = task.id;

  if (task.frequency === "daily") {
    const entries = state.assignments[weekIndex][dayIndex] || [];
    return entries.some(e => e.type === "task" && e.taskId === taskId && (e.locationId||null) === (targetLocationId||null));
  }

  if (task.frequency === "weekly") {
    for (let d = 0; d < 7; d++) {
      const entries = state.assignments[weekIndex][d] || [];
      if (entries.some(e => e.type === "task" && e.taskId === taskId && (e.locationId||null) === (targetLocationId||null))) return true;
    }
    return false;
  }

  if (["monthly","yearly","one-time"].includes(task.frequency)) {
    for (let w = 0; w < 4; w++) {
      for (let d = 0; d < 7; d++) {
        const entries = state.assignments[w][d] || [];
        if (entries.some(e => e.type === "task" && e.taskId === taskId && (e.locationId||null) === (targetLocationId||null))) return true;
      }
    }
    return false;
  }

  return false;
}

function addTaskToCell(weekIndex, dayIndex, taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  // If the task is assigned to a specific location, respect that.
  // Only fall back to the day's "current" location when the task is set to All locations.
  const currentLocId = getCurrentLocationForDay(weekIndex, dayIndex);
  const targetLocId = (task.location && task.location !== "all") ? task.location : (currentLocId || null);

  if (isTaskBlockedForLocation(task, weekIndex, dayIndex, targetLocId)) {
    alert("This task can't be added here based on its frequency rules for this location.");
    return;
  }

  state.assignments[weekIndex][dayIndex].push({ type:"task", taskId, locationId: targetLocId, done:false });
  saveState();
}

function addTravelToCell(weekIndex, dayIndex, locationId) {
  const loc = state.locations.find(l => l.id === locationId);
  if (!loc) return;
  state.assignments[weekIndex][dayIndex].push({ type:"travel", locationId });
  saveState();
}

function removeAssignment(weekIndex, dayIndex, entryIndex) {
  state.assignments[weekIndex][dayIndex].splice(entryIndex, 1);
  saveState();
}

export function resetAllDone() {
  for (let w = 0; w < 4; w++) {
    for (let d = 0; d < 7; d++) {
      (state.assignments[w][d] || []).forEach(entry => {
        if (entry && entry.type === "task") entry.done = false;
      });
    }
  }
  saveState();
}

function copyWeek(sourceWeek, targetWeek) {
  if (sourceWeek<0 || sourceWeek>3 || targetWeek<0 || targetWeek>3 || sourceWeek===targetWeek) return;

  state.assignments[targetWeek] = state.assignments[sourceWeek].map(day => day.map(e => ({...e})));
  state.dayCellSettings[targetWeek] = state.dayCellSettings[sourceWeek].map(s => ({ startLocationId: s.startLocationId || null, startTime: s.startTime || null }));

  saveState();
}

export function renderCalendar() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;
  calendarEl.innerHTML = "";

  const visibleDayIndexes = computeVisibleDayIndexes();
  const colCount = visibleDayIndexes.length || 5;

  for (let w = 0; w < 4; w++) {
    if (!state.weekVisibility[w]) continue;

    const weekRow = document.createElement("div");
    weekRow.className = "week-row";

    const weekHeader = document.createElement("div");
    weekHeader.className = "week-header";

    const weekTitleSpan = document.createElement("span");
    weekTitleSpan.textContent = `Week ${w+1} – Total: 00:00`;

    const weekActions = document.createElement("div");
    weekActions.className = "week-actions";

    const copyLabel = document.createElement("span");
    copyLabel.textContent = "Copy to:";

    const copySelect = document.createElement("select");
    const copyDefault = document.createElement("option");
    copyDefault.value = "";
    copyDefault.textContent = "--";
    copySelect.appendChild(copyDefault);
    for (let tw = 0; tw < 4; tw++) {
      if (tw === w) continue;
      const opt = document.createElement("option");
      opt.value = String(tw);
      opt.textContent = `Week ${tw+1}`;
      copySelect.appendChild(opt);
    }
    copySelect.addEventListener("change", () => {
      const v = copySelect.value;
      if (!v) return;
      const targetWeek = parseInt(v, 10);
      if (isNaN(targetWeek)) return;
      const ok = confirm(`Copy Week ${w+1} (tasks & day settings) to Week ${targetWeek+1}, overwriting it?`);
      if (ok) copyWeek(w, targetWeek);
      copySelect.value = "";
    });

    weekActions.appendChild(copyLabel);
    weekActions.appendChild(copySelect);

    weekHeader.appendChild(weekTitleSpan);
    weekHeader.appendChild(weekActions);
    weekRow.appendChild(weekHeader);

    const daysRow = document.createElement("div");
    daysRow.className = "days-row";
    daysRow.style.gridTemplateColumns = `repeat(${colCount}, minmax(0, 1fr))`;

    let weekTotalMinutes = 0;

    for (const d of visibleDayIndexes) {
      const dayCell = document.createElement("div");
      dayCell.className = "day-cell";

      // Defensive: older/partial states (or early render before state normalization)
      // can have missing dayCellSettings shape.
      if (!Array.isArray(state.dayCellSettings)) state.dayCellSettings = [];
      if (!Array.isArray(state.dayCellSettings[w])) state.dayCellSettings[w] = [];
      if (!state.dayCellSettings[w][d]) state.dayCellSettings[w][d] = { startLocationId:null, startTime:null };
      const settings = state.dayCellSettings[w][d];

      const locTimeDiv = document.createElement("div");
      locTimeDiv.className = "day-loc-time";

      const locSelect = document.createElement("select");
      const locDefault = document.createElement("option");
      locDefault.value = "";
      locDefault.textContent = "Location";
      locSelect.appendChild(locDefault);
      state.locations.forEach(loc => {
        const opt = document.createElement("option");
        opt.value = String(loc.id);
        opt.textContent = loc.name;
        locSelect.appendChild(opt);
      });
      if (settings.startLocationId) locSelect.value = String(settings.startLocationId);
      locSelect.addEventListener("change", () => {
        const val = locSelect.value;
        settings.startLocationId = val ? parseInt(val, 10) : null;
        saveState();
      });

      const timeInput = document.createElement("input");
      timeInput.type = "time";
      timeInput.value = settings.startTime || "";
      timeInput.addEventListener("change", () => {
        settings.startTime = timeInput.value || null;
        saveState();
      });

      locTimeDiv.appendChild(locSelect);
      locTimeDiv.appendChild(timeInput);

      const dayHeader = document.createElement("div");
      dayHeader.className = "day-header";

      const dayNameSpan = document.createElement("span");
      dayNameSpan.textContent = getPlannerDateLabel(state.startMondayISO, w, d, dayNames[d]);

      const dayTotalSpan = document.createElement("span");
      dayTotalSpan.className = "day-total";
      dayTotalSpan.textContent = "00:00";

      dayHeader.appendChild(dayNameSpan);
      dayHeader.appendChild(dayTotalSpan);

      const dayControls = document.createElement("div");
      dayControls.className = "day-controls";

      const select = document.createElement("select");
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = state.tasks.length===0 && state.locations.length===0 ? "No items yet" : "Add...";
      select.appendChild(defaultOption);

      const currentLocIdForAdd = getCurrentLocationForDay(w, d);

      state.tasks.forEach(task => {
        if (!isTaskBlockedForLocation(task, w, d, currentLocIdForAdd)) {
          const opt = document.createElement("option");
          opt.value = `task:${task.id}`;
          opt.textContent = `${task.name} (${task.lengthMinutes}m, ${formatFrequency(task.frequency)})`;
          select.appendChild(opt);
        }
      });

      if (state.locations.length > 0) {
        const optGroup = document.createElement("optgroup");
        optGroup.label = "Travel";
        state.locations.forEach(loc => {
          const opt = document.createElement("option");
          opt.value = `travel:${loc.id}`;
          opt.textContent = `Travel to ${loc.name}`;
          optGroup.appendChild(opt);
        });
        select.appendChild(optGroup);
      }

      select.addEventListener("change", () => {
        const val = select.value;
        if (!val) return;
        if (val.startsWith("task:")) addTaskToCell(w, d, parseInt(val.split(":")[1],10));
        else if (val.startsWith("travel:")) addTravelToCell(w, d, parseInt(val.split(":")[1],10));
        select.value = "";
      });

      dayControls.appendChild(select);

      const taskList = document.createElement("ul");
      taskList.className = "task-list";

      const dayEntries = state.assignments[w][d];
      const startStr = settings.startTime || "08:00";
      let startMinutes = 8*60;
      if (/^\d{2}:\d{2}$/.test(startStr)) {
        const [hh, mm] = startStr.split(":").map(x => parseInt(x,10));
        if (!isNaN(hh) && !isNaN(mm)) startMinutes = hh*60 + mm;
      }

      let currentTimeMinutes = startMinutes;
      let dayTotalMinutes = 0;
      let currentLocId = settings.startLocationId || null;

      dayEntries.forEach((entry, entryIndex) => {
        const li = document.createElement("li");
        li.dataset.weekIndex = String(w);
        li.dataset.dayIndex = String(d);
        li.dataset.entryIndex = String(entryIndex);
        li.draggable = true;

        if (entry.done) li.classList.add("done");

        let entryLocId = currentLocId;
        const infoSpan = document.createElement("span");
        const timeSpan = document.createElement("span");
        timeSpan.className = "task-time-box";

        if (entry.type === "task") {
          const task = state.tasks.find(t => t.id === entry.taskId);
          if (!task) return;

          const len = Math.abs(task.lengthMinutes || 0);
          timeSpan.textContent = formatMinutesTo12hTime(currentTimeMinutes);

          if (task.lengthMinutes >= 0) dayTotalMinutes += len;
          currentTimeMinutes += len;

          entryLocId = ("locationId" in entry) ? entry.locationId : currentLocId;

          infoSpan.innerHTML = `<span class="task-name">${escapeHtml(task.name)}</span> (${task.lengthMinutes}m)`;
        } else if (entry.type === "travel") {
          const locName = getLocationNameByValue(state.locations, entry.locationId);
          timeSpan.textContent = formatMinutesTo12hTime(currentTimeMinutes);

          const travelDuration = 40;
          dayTotalMinutes += travelDuration;
          currentTimeMinutes += travelDuration;
          currentLocId = entry.locationId || null;
          entryLocId = currentLocId;

          infoSpan.innerHTML = `<span class="task-name">Travel</span> → ${escapeHtml(locName)} (40m)`;
        }

        const color = getLocationColorById(state.locations, entryLocId);
        if (color) li.style.backgroundColor = color;

        const removeBtn = document.createElement("button");
        removeBtn.className = "task-remove-btn";
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeAssignment(w, d, entryIndex);
        });

        li.addEventListener("click", (e) => {
          if (e.target.closest(".task-remove-btn")) return;
          entry.done = !entry.done;
          saveState();
        });

        li.appendChild(timeSpan);
        li.appendChild(infoSpan);
        li.appendChild(removeBtn);
        taskList.appendChild(li);

        // Drag inside/between days
        li.addEventListener("dragstart", () => { state.calendarDragSource = { weekIndex:w, dayIndex:d, entryIndex }; li.classList.add("dragging"); });
        li.addEventListener("dragend", () => { li.classList.remove("dragging"); state.calendarDragSource = null; });
        li.addEventListener("dragover", e => e.preventDefault());
        li.addEventListener("drop", e => {
          e.preventDefault();
          if (!state.calendarDragSource) return;
          const source = state.calendarDragSource;
          const targetWeek = w, targetDay = d, targetIndex = entryIndex;

          const sourceEntries = state.assignments[source.weekIndex][source.dayIndex];
          const targetEntries = state.assignments[targetWeek][targetDay];
          if (!sourceEntries || !targetEntries) { state.calendarDragSource = null; return; }

          if (state.dragMode === "swap") {
            if (source.weekIndex===targetWeek && source.dayIndex===targetDay && source.entryIndex===targetIndex) { state.calendarDragSource=null; return; }
            const sourceEntry = sourceEntries[source.entryIndex];
            const destEntry = targetEntries[targetIndex];
            if (!sourceEntry || !destEntry) { state.calendarDragSource=null; return; }
            sourceEntries[source.entryIndex] = destEntry;
            targetEntries[targetIndex] = sourceEntry;
          } else {
            const entryObj = sourceEntries.splice(source.entryIndex, 1)[0];
            if (!entryObj) { state.calendarDragSource=null; return; }
            let insertIndex = targetIndex;
            if (source.weekIndex===targetWeek && source.dayIndex===targetDay && insertIndex > source.entryIndex) insertIndex--;
            targetEntries.splice(insertIndex, 0, entryObj);
          }

          state.calendarDragSource = null;
          saveState();
        });
      });

      // Drop into empty / bottom of list (always insert behavior)
      taskList.addEventListener("dragover", e => e.preventDefault());
      taskList.addEventListener("drop", e => {
        e.preventDefault();
        if (!state.calendarDragSource) return;
        const source = state.calendarDragSource;
        const sourceEntries = state.assignments[source.weekIndex][source.dayIndex];
        const entryObj = sourceEntries.splice(source.entryIndex, 1)[0];
        state.assignments[w][d].push(entryObj);
        state.calendarDragSource = null;
        saveState();
      });

      dayTotalSpan.textContent = formatMinutesToHHMM(dayTotalMinutes);
      weekTotalMinutes += dayTotalMinutes;

      dayCell.appendChild(locTimeDiv);
      dayCell.appendChild(dayHeader);
      dayCell.appendChild(dayControls);
      dayCell.appendChild(taskList);
      daysRow.appendChild(dayCell);
    }

    weekTitleSpan.textContent = `Week ${w+1} – Total: ${formatMinutesToHHMM(weekTotalMinutes)}`;
    weekRow.appendChild(daysRow);
    calendarEl.appendChild(weekRow);
  }
}
