import {
  STORAGE_KEY_TASKS, STORAGE_KEY_ASSIGNMENTS, STORAGE_KEY_LOCATIONS,
  STORAGE_KEY_DAYCELLSETTINGS, STORAGE_KEY_WEEK_VISIBILITY,
  STORAGE_KEY_START_MONDAY, STORAGE_KEY_TRACKED_CATEGORIES, STORAGE_KEY_TRACKED_TASKS,
  STORAGE_KEY_LAST_MODIFIED
} from "./constants.js?v=20260224_02";


let STORAGE_NAMESPACE = "SIGNED_OUT"; // default: don't load anyone's data until login
let ALLOW_LEGACY_MIGRATION = false;

function nsKey(baseKey) {
  // When signed out, avoid reading/writing any persisted planner data.
  if (!STORAGE_NAMESPACE || STORAGE_NAMESPACE === "SIGNED_OUT") return null;
  return `${baseKey}__uid_${STORAGE_NAMESPACE}`;
}

export function setStorageNamespace(uid, { allowLegacyMigration = false } = {}) {
  STORAGE_NAMESPACE = uid ? String(uid) : "SIGNED_OUT";
  ALLOW_LEGACY_MIGRATION = !!allowLegacyMigration;
}

function lsGet(baseKey) {
  if (!window.localStorage) return null;
  const k = nsKey(baseKey);
  if (!k) return null;
  const v = localStorage.getItem(k);
  if (v !== null) return v;

  // Optional one-time legacy migration from global keys (pre-login era)
  if (ALLOW_LEGACY_MIGRATION) {
    const legacy = localStorage.getItem(baseKey);
    if (legacy !== null) return legacy;
  }
  return null;
}

function lsSet(baseKey, value) {
  if (!window.localStorage) return;
  const k = nsKey(baseKey);
  if (!k) return;
  localStorage.setItem(k, value);

  // If we just used legacy migration, leave legacy keys alone (safe but optional).
}

export function resetStateToEmpty() {
  state.tasks = [];
  initAssignments();
  state.locations = [];
  initDayCellSettings();
  state.weekVisibility = [true,true,true,true];
  state.startMondayISO = null;
  state.lastModified = 0;
  state.trackedCategories = [];
  state.trackedTasks = [];
  state.nextTrackedCategoryId = 1;
  state.nextTrackedTaskId = 1;
  state.nextTrackedFieldId = 1;
  state.nextTaskId = 1;
  state.nextLocationId = 1;
  state.editingTaskId = null;
  state.editingLocationId = null;
  state.draggedTaskIndex = null;
  state.calendarDragSource = null;
  state.dragMode = "insert";
}

export const state = {
  // Core data
  tasks: [],              // {id, name, description, lengthMinutes, frequency, location:'all'|number}
  assignments: [],        // assignments[week][day] = [{type:'task'|'travel', ...}]
  locations: [],          // {id, name, color}
  dayCellSettings: [],    // dayCellSettings[week][day] = { startLocationId, startTime }
  weekVisibility: [true,true,true,true],

  // Date basis (ISO yyyy-mm-dd) for Monday of Week 1
  startMondayISO: null,

  // Last modification time (ms since epoch). Used for cross-device conflict resolution.
  lastModified: 0,

  // Tracked Tasks (custom form-like tasks)
  trackedCategories: [], // {id, name}
  trackedTasks: [],      // {id, title, location:'all'|number, categoryId|null, fields:[{id,label,type,value}]}
  nextTrackedCategoryId: 1,
  nextTrackedTaskId: 1,
  nextTrackedFieldId: 1,

  nextTaskId: 1,
  nextLocationId: 1,

  // UI state
  editingTaskId: null,
  editingLocationId: null,
  draggedTaskIndex: null,
  calendarDragSource: null,
  dragMode: "insert",

  // hooks (set by other modules)
  onChange: null,          // () => void
  driveSaveScheduler: null // () => void
};

export function initAssignments() {
  state.assignments = [];
  for (let w = 0; w < 4; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) week.push([]);
    state.assignments.push(week);
  }
}

export function initDayCellSettings() {
  state.dayCellSettings = [];
  for (let w = 0; w < 4; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) row.push({ startLocationId: null, startTime: null });
    state.dayCellSettings.push(row);
  }
}

export function normalizeCurrentState() {
  // Ensure task.location exists
  state.tasks.forEach(t => { if (!("location" in t)) t.location = "all"; });

  // Normalize assignments
  if (!Array.isArray(state.assignments) || state.assignments.length !== 4) {
    initAssignments();
  } else {
    for (let w = 0; w < 4; w++) {
      if (!Array.isArray(state.assignments[w])) state.assignments[w] = [];
      for (let d = 0; d < 7; d++) {
        if (!Array.isArray(state.assignments[w][d])) state.assignments[w][d] = [];
        state.assignments[w][d] = state.assignments[w][d].map(entry => {
          if (typeof entry === "number") return { type:"task", taskId: entry, done:false };
          if (entry && typeof entry === "object") {
            if (!entry.type) {
              return {
                type: "task",
                taskId: entry.taskId || entry.id || 0,
                locationId: entry.locationId || null,
                done: !!entry.done
              };
            }
            return entry;
          }
          return { type:"task", taskId: 0, done:false };
        });
      }
    }
  }

  // Normalize day cell settings
  if (!Array.isArray(state.dayCellSettings) || state.dayCellSettings.length !== 4) {
    initDayCellSettings();
  } else {
    for (let w = 0; w < 4; w++) {
      if (!Array.isArray(state.dayCellSettings[w])) state.dayCellSettings[w] = [];
      for (let d = 0; d < 7; d++) {
        if (!state.dayCellSettings[w][d]) {
          state.dayCellSettings[w][d] = { startLocationId:null, startTime:null };
        } else {
          if (!("startLocationId" in state.dayCellSettings[w][d])) state.dayCellSettings[w][d].startLocationId = null;
          if (!("startTime" in state.dayCellSettings[w][d])) state.dayCellSettings[w][d].startTime = null;
        }
      }
    }
  }

  // Fill locationId & done on existing entries based on travel timeline
  for (let w = 0; w < 4; w++) {
    for (let d = 0; d < 7; d++) {
      const settings = state.dayCellSettings[w][d] || { startLocationId:null, startTime:null };
      let currentLocId = settings.startLocationId || null;
      const dayEntries = state.assignments[w][d] || [];
      dayEntries.forEach(entry => {
        if (!("done" in entry)) entry.done = false;
        if (entry.type === "travel") {
          currentLocId = entry.locationId || null;
        } else if (entry.type === "task") {
          if (!("locationId" in entry)) entry.locationId = currentLocId;
        }
      });
    }
  }

  
  // Normalize tracked tasks/categories
  if (!Array.isArray(state.trackedCategories)) state.trackedCategories = [];
  if (!Array.isArray(state.trackedTasks)) state.trackedTasks = [];

  state.trackedTasks.forEach(t => {
    if (!("location" in t)) t.location = "all";
    if (!("categoryId" in t)) t.categoryId = null;
    if (!Array.isArray(t.fields)) t.fields = [];
    t.fields = t.fields.map(f => ({
      id: typeof f?.id === "number" ? f.id : 0,
      label: String(f?.label || ""),
      type: String(f?.type || "text"),
      value: f?.value ?? (String(f?.type) === "checkbox" ? false : ""),
      // Optional date-field behaviors
      highlightEnabled: !!f?.highlightEnabled,
      expiryDays: typeof f?.expiryDays === "number" ? f.expiryDays : (parseInt(f?.expiryDays || "", 10) || null)
    }));
  });

  // Next tracked IDs
  let maxCatId = 0;
  state.trackedCategories.forEach(c => { if (typeof c.id === "number" && c.id > maxCatId) maxCatId = c.id; });
  state.nextTrackedCategoryId = maxCatId + 1;

  let maxTrackedTaskId = 0;
  let maxFieldId = 0;
  state.trackedTasks.forEach(t => {
    if (typeof t.id === "number" && t.id > maxTrackedTaskId) maxTrackedTaskId = t.id;
    t.fields?.forEach(f => { if (typeof f.id === "number" && f.id > maxFieldId) maxFieldId = f.id; });
  });
  state.nextTrackedTaskId = maxTrackedTaskId + 1;
  state.nextTrackedFieldId = maxFieldId + 1;

// Next IDs
  let maxTaskId = 0;
  state.tasks.forEach(t => { if (typeof t.id === "number" && t.id > maxTaskId) maxTaskId = t.id; });
  state.nextTaskId = maxTaskId + 1;

  let maxLocId = 0;
  state.locations.forEach(l => { if (typeof l.id === "number" && l.id > maxLocId) maxLocId = l.id; });
  state.nextLocationId = maxLocId + 1;
}

export function loadState() {
  let storedTasks=null, storedAssignments=null, storedLocations=null, storedSettings=null, storedWeekVisibility=null, storedStartMonday=null, storedTrackedCategories=null, storedTrackedTasks=null, storedLastModified=null;
  if (window.localStorage) {
    try {
      storedTasks = lsGet(STORAGE_KEY_TASKS);
      storedAssignments = lsGet(STORAGE_KEY_ASSIGNMENTS);
      storedLocations = lsGet(STORAGE_KEY_LOCATIONS);
      storedSettings = lsGet(STORAGE_KEY_DAYCELLSETTINGS);
      storedWeekVisibility = lsGet(STORAGE_KEY_WEEK_VISIBILITY);
      storedStartMonday = lsGet(STORAGE_KEY_START_MONDAY);
      storedLastModified = lsGet(STORAGE_KEY_LAST_MODIFIED);
      storedTrackedCategories = lsGet(STORAGE_KEY_TRACKED_CATEGORIES);
      storedTrackedTasks = lsGet(STORAGE_KEY_TRACKED_TASKS);
    } catch (e) {
      console.warn("Unable to load state:", e);
    }
  }

  state.tasks = storedTasks ? (JSON.parse(storedTasks) || []) : [];
  state.assignments = storedAssignments ? (JSON.parse(storedAssignments) || []) : [];
  state.locations = storedLocations ? (JSON.parse(storedLocations) || []) : [];
  state.dayCellSettings = storedSettings ? (JSON.parse(storedSettings) || []) : [];

  // Start date + tracked tasks
  state.startMondayISO = storedStartMonday ? (JSON.parse(storedStartMonday) || null) : null;
  state.lastModified = storedLastModified ? (JSON.parse(storedLastModified) || 0) : 0;
  state.trackedCategories = storedTrackedCategories ? (JSON.parse(storedTrackedCategories) || []) : [];
  state.trackedTasks = storedTrackedTasks ? (JSON.parse(storedTrackedTasks) || []) : [];

  if (storedWeekVisibility) {
    try {
      const arr = JSON.parse(storedWeekVisibility);
      if (Array.isArray(arr) && arr.length === 4) state.weekVisibility = arr.map(v => !!v);
    } catch (e) {
      console.warn("Unable to parse week visibility:", e);
    }
  }

  normalizeCurrentState();
}

export function applyLoadedState(data) {
  state.tasks = Array.isArray(data.tasks) ? data.tasks : [];
  state.assignments = Array.isArray(data.assignments) ? data.assignments : [];
  state.locations = Array.isArray(data.locations) ? data.locations : [];
  state.dayCellSettings = Array.isArray(data.dayCellSettings) ? data.dayCellSettings : [];
  if (Array.isArray(data.weekVisibility) && data.weekVisibility.length === 4) {
    state.weekVisibility = data.weekVisibility.map(v => !!v);
  } else {
    state.weekVisibility = [true,true,true,true];
  }

  // Cross-device sync: include Week-1 Monday date and Tracked Tasks
  state.startMondayISO = data.startMondayISO ? String(data.startMondayISO) : null;
  state.lastModified = typeof data.lastModified === "number" ? data.lastModified : 0;
  state.trackedCategories = Array.isArray(data.trackedCategories) ? data.trackedCategories : [];
  state.trackedTasks = Array.isArray(data.trackedTasks) ? data.trackedTasks : [];

  normalizeCurrentState();
}

export function getSerializableState() {
  return {
    version: 1,
    tasks: state.tasks,
    assignments: state.assignments,
    locations: state.locations,
    dayCellSettings: state.dayCellSettings,
    weekVisibility: state.weekVisibility,
    startMondayISO: state.startMondayISO,
    lastModified: state.lastModified,
    trackedCategories: state.trackedCategories,
    trackedTasks: state.trackedTasks
  };
}

export function saveStateLocalOnly() {
  if (!window.localStorage) return;
  try {
    // Update last-modified timestamp whenever we save.
    state.lastModified = Date.now();
    lsSet(STORAGE_KEY_TASKS, JSON.stringify(state.tasks));
    lsSet(STORAGE_KEY_ASSIGNMENTS, JSON.stringify(state.assignments));
    lsSet(STORAGE_KEY_LOCATIONS, JSON.stringify(state.locations));
    lsSet(STORAGE_KEY_DAYCELLSETTINGS, JSON.stringify(state.dayCellSettings));
    lsSet(STORAGE_KEY_WEEK_VISIBILITY, JSON.stringify(state.weekVisibility));
    lsSet(STORAGE_KEY_LAST_MODIFIED, JSON.stringify(state.lastModified));
    lsSet(STORAGE_KEY_START_MONDAY, JSON.stringify(state.startMondayISO));
    lsSet(STORAGE_KEY_TRACKED_CATEGORIES, JSON.stringify(state.trackedCategories));
    lsSet(STORAGE_KEY_TRACKED_TASKS, JSON.stringify(state.trackedTasks));
  } catch (e) {
    console.warn("Unable to save state:", e);
  }
}

export function saveState() {
  saveStateLocalOnly();
  if (typeof state.driveSaveScheduler === "function") state.driveSaveScheduler();
  if (typeof state.onChange === "function") state.onChange();
}

export function setDriveSaveScheduler(fn) { state.driveSaveScheduler = fn; }
export function setOnChange(fn) { state.onChange = fn; }
