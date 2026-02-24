import { state, saveState } from "./state.js?v=20260224_01";
import { escapeHtml, getLocationNameByValue } from "./utils.js?v=20260224_01";

// Local (in-memory) field builder for the create form
let draftFields = [];
let expandedCategoryId = null; // accordion: only one category open at a time
let expandedLocationByCategory = new Map(); // catId -> locationId (only one open per category)
let editingTrackedTaskId = null;
let portalMenuEl = null;
let portalCleanupFns = [];




function ensureCategorySelect() {
  const sel = document.getElementById("trackedTaskCategory");
  if (!sel) return;

  sel.innerHTML = "";
  const optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "(No category)";
  sel.appendChild(optNone);

  state.trackedCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = String(cat.id);
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
}

function ensureLocationSelect() {
  const sel = document.getElementById("trackedTaskLocation");
  if (!sel) return;

  sel.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All locations";
  sel.appendChild(optAll);

  state.locations.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = String(loc.id);
    opt.textContent = loc.name;
    sel.appendChild(opt);
  });

  sel.value = "all";
}

function ensureBulkLocationSelect() {
  const sel = document.getElementById("bulkTrackedLocation");
  if (!sel) return;

  sel.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All locations";
  sel.appendChild(optAll);

  state.locations.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = String(loc.id);
    opt.textContent = loc.name;
    sel.appendChild(opt);
  });
}

function ensureBulkCategorySelect() {
  const sel = document.getElementById("bulkTrackedCategory");
  if (!sel) return;

  sel.innerHTML = "";
  const optAny = document.createElement("option");
  optAny.value = "";
  optAny.textContent = "(Any category)";
  sel.appendChild(optAny);

  // Explicit Uncategorized option
  const optUn = document.createElement("option");
  optUn.value = "0";
  optUn.textContent = "Uncategorized";
  sel.appendChild(optUn);

  state.trackedCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = String(cat.id);
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
}

function renderFieldPreview() {
  const wrapper = document.getElementById("trackedFieldsPreview");
  if (!wrapper) return;

  if (!draftFields || draftFields.length === 0) {
    wrapper.innerHTML = '<p class="no-tasks">No fields added yet.</p>';
    return;
  }

  let html = '<table><thead><tr><th>Label</th><th>Type</th><th>Highlight</th><th>Expires (days)</th><th>Remove</th></tr></thead><tbody>';

  draftFields.forEach((f, idx) => {
    const isDate = f.type === "date";
    const checked = isDate && f.highlightEnabled ? "checked" : "";
    const expVal = isDate ? (parseInt(f.expiryDays || 28, 10) || 28) : "";
    const expDisabled = (isDate && f.highlightEnabled) ? "" : "disabled";

    html += `<tr>
      <td>${escapeHtml(f.label)}</td>
      <td>${escapeHtml(f.type)}</td>
      <td>
        ${isDate ? `<input type="checkbox" data-hl="${idx}" ${checked} />` : ""}
      </td>
      <td>
        ${isDate ? `<input type="number" min="1" class="task-inline-input" style="width:80px;" data-exp="${idx}" value="${escapeHtml(String(expVal))}" ${expDisabled} />` : ""}
      </td>
      <td><button data-remove="${idx}">✕</button></td>
    </tr>`;
  });

  html += "</tbody></table>";
  wrapper.innerHTML = html;

  // remove
  wrapper.querySelectorAll("button[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.remove, 10);
      if (isNaN(idx)) return;
      draftFields.splice(idx, 1);
      renderFieldPreview();
    });
  });

  // highlight toggles
  wrapper.querySelectorAll("input[type=checkbox][data-hl]").forEach(cb => {
    cb.addEventListener("change", () => {
      const idx = parseInt(cb.dataset.hl, 10);
      if (isNaN(idx) || !draftFields[idx]) return;
      draftFields[idx].highlightEnabled = !!cb.checked;

      // enable/disable expiry input
      const exp = wrapper.querySelector(`input[data-exp="${idx}"]`);
      if (exp) {
        exp.disabled = !cb.checked;
      }
    });
  });

  // expiry edits
  wrapper.querySelectorAll("input[type=number][data-exp]").forEach(inp => {
    inp.addEventListener("change", () => {
      const idx = parseInt(inp.dataset.exp, 10);
      if (isNaN(idx) || !draftFields[idx]) return;
      let v = parseInt(inp.value || "28", 10);
      if (isNaN(v) || v <= 0) v = 28;
      draftFields[idx].expiryDays = v;
      inp.value = String(v);
    });
  });
}


function loadTaskIntoForm(task) {
  const titleEl = document.getElementById("trackedTaskTitle");
  const locEl = document.getElementById("trackedTaskLocation");
  const catEl = document.getElementById("trackedTaskCategory");
  const newCatEl = document.getElementById("newTrackedCategory");

  if (titleEl) titleEl.value = task.title || "";
  // If task is location-specific, keep it; you can switch to All if you want
  if (locEl) locEl.value = (task.location === "all" ? "all" : String(task.location || "all"));
  if (catEl) catEl.value = task.categoryId ? String(task.categoryId) : "";
  if (newCatEl) newCatEl.value = "";

  // Copy fields into draft (labels/types only; ids will be regenerated on create)
  draftFields = (task.fields || []).map(f => ({
    id: f.id,
    label: f.label,
    type: f.type,
    highlightEnabled: !!f.highlightEnabled,
    expiryDays: f.expiryDays || 28
  }));
  renderFieldPreview();
}

function clearTrackedForm() {
  const title = document.getElementById("trackedTaskTitle");
  const newCat = document.getElementById("newTrackedCategory");
  const catSel = document.getElementById("trackedTaskCategory");
  const locSel = document.getElementById("trackedTaskLocation");
  if (title) title.value = "";
  if (newCat) newCat.value = "";
  if (catSel) catSel.value = "";
  if (locSel) locSel.value = "all";
  draftFields = [];
  renderFieldPreview();
}

export function initTrackedTasksUI() {
  // Toggle highlight controls based on field type
  const typeEl = document.getElementById("trackedFieldType");
  const hlWrap = document.getElementById("trackedFieldHighlight")?.parentElement;
  const expWrap = document.getElementById("trackedFieldExpiryDays")?.parentElement;
  const toggleDateOptions = () => {
    const isDate = (typeEl?.value || "") === "date";
    if (hlWrap) hlWrap.style.display = isDate ? "flex" : "none";
    if (expWrap) expWrap.style.display = isDate ? "flex" : "none";
  };
  typeEl?.addEventListener("change", toggleDateOptions);
  toggleDateOptions();


  ensureLocationSelect();
  ensureCategorySelect();
  ensureBulkLocationSelect();
  ensureBulkCategorySelect();
  renderFieldPreview();

  // Bulk field controls: show/hide highlight settings for date type
  const bulkTypeEl = document.getElementById("bulkFieldType");
  const bulkHlWrap = document.getElementById("bulkFieldHighlight")?.parentElement;
  const bulkExpWrap = document.getElementById("bulkFieldExpiryDays")?.parentElement;
  const toggleBulkDateOptions = () => {
    const isDate = (bulkTypeEl?.value || "") === "date";
    if (bulkHlWrap) bulkHlWrap.style.display = isDate ? "flex" : "none";
    if (bulkExpWrap) bulkExpWrap.style.display = isDate ? "flex" : "none";
  };
  bulkTypeEl?.addEventListener("change", toggleBulkDateOptions);
  toggleBulkDateOptions();

  document.getElementById("bulkAddFieldBtn")?.addEventListener("click", (e) => {
    e.preventDefault();

    const locSel = document.getElementById("bulkTrackedLocation");
    const catSel = document.getElementById("bulkTrackedCategory");
    const searchEl = document.getElementById("bulkTrackedSearch");

    const labelEl = document.getElementById("bulkFieldLabel");
    const typeEl = document.getElementById("bulkFieldType");
    const hlEl = document.getElementById("bulkFieldHighlight");
    const expEl = document.getElementById("bulkFieldExpiryDays");
    const statusEl = document.getElementById("bulkAddFieldStatus");

    const fieldLabel = (labelEl?.value || "").trim();
    const fieldType = (typeEl?.value || "text").trim();
    if (!fieldLabel) {
      alert("Please enter a field label to add.");
      return;
    }

    const rawLoc = (locSel?.value || "all").trim();
    const locFilter = rawLoc === "all" ? "all" : parseInt(rawLoc, 10);
    const rawCat = (catSel?.value || "").trim();
    const catFilter = rawCat === "" ? null : parseInt(rawCat, 10);
    const needle = (searchEl?.value || "").trim().toLowerCase();

    const highlightEnabled = fieldType === "date" ? !!hlEl?.checked : false;
    let expiryDays = 28;
    if (fieldType === "date") {
      expiryDays = parseInt(expEl?.value || "28", 10);
      if (isNaN(expiryDays) || expiryDays <= 0) expiryDays = 28;
    }

    const labelKey = fieldLabel.toLowerCase();
    const matches = (state.trackedTasks || []).filter(t => {
      // location filter
      if (locFilter !== "all") {
        if (t.location !== locFilter) return false;
      }
      // category filter
      if (catFilter !== null) {
        const tCat = (t.categoryId || 0);
        if (tCat !== catFilter) return false;
      }
      // title substring
      if (needle) {
        const ttl = String(t.title || "").toLowerCase();
        if (!ttl.includes(needle)) return false;
      }
      return true;
    });

    if (matches.length === 0) {
      if (statusEl) statusEl.textContent = "No tracked tasks matched your filters.";
      return;
    }

    let tasksChanged = 0;
    let fieldsAdded = 0;
    matches.forEach(t => {
      if (!Array.isArray(t.fields)) t.fields = [];
      const already = t.fields.some(f => String(f?.label || "").trim().toLowerCase() === labelKey);
      if (already) return; // don't duplicate

      const newField = {
        id: state.nextTrackedFieldId++,
        label: fieldLabel,
        type: fieldType,
        value: (fieldType === "checkbox") ? false : ""
      };
      if (fieldType === "date") {
        newField.highlightEnabled = highlightEnabled;
        newField.expiryDays = expiryDays;
      }

      t.fields.push(newField);
      tasksChanged += 1;
      fieldsAdded += 1;
    });

    if (tasksChanged === 0) {
      if (statusEl) statusEl.textContent = "All matching tasks already have a field with that label.";
      return;
    }

    saveState();
    if (statusEl) statusEl.textContent = `Added '${fieldLabel}' to ${tasksChanged} tracked task(s).`;
    if (labelEl) labelEl.value = "";
  });

  document.getElementById("addTrackedFieldBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const labelEl = document.getElementById("trackedFieldLabel");
    const typeEl = document.getElementById("trackedFieldType");
    const hlEl = document.getElementById("trackedFieldHighlight");
    const expEl = document.getElementById("trackedFieldExpiryDays");

    const label = (labelEl?.value || "").trim();
    const type = typeEl?.value || "text";
    if (!label) {
      alert("Please enter a field label.");
      return;
    }

    const field = { id: state.nextTrackedFieldId++, label, type };

    if (type === "date") {
      field.highlightEnabled = !!hlEl?.checked;
      field.expiryDays = parseInt(expEl?.value || "28", 10);
      if (isNaN(field.expiryDays) || field.expiryDays <= 0) field.expiryDays = 28;
    }

    draftFields.push(field);

    if (labelEl) labelEl.value = "";
    if (hlEl) hlEl.checked = false;
    if (expEl) expEl.value = "28";

    renderFieldPreview();
  });

  document.getElementById("trackedTaskClearBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    clearTrackedForm();
  });

  document.getElementById("trackedTaskCreateBtn")?.addEventListener("click", (e) => {
    e.preventDefault();

    const titleEl = document.getElementById("trackedTaskTitle");
    const locEl = document.getElementById("trackedTaskLocation");
    const catEl = document.getElementById("trackedTaskCategory");
    const newCatEl = document.getElementById("newTrackedCategory");

    const title = (titleEl?.value || "").trim();
    if (!title) {
      alert("Please enter a task title.");
      return;
    }

    // Category: existing or new
    let categoryId = null;
    const existingCatVal = (catEl?.value || "").trim();
    const newCatName = (newCatEl?.value || "").trim();

    if (newCatName) {
      const exists = state.trackedCategories.find(c => (c.name || "").toLowerCase() === newCatName.toLowerCase());
      if (exists) {
        categoryId = exists.id;
      } else {
        const newCat = { id: state.nextTrackedCategoryId++, name: newCatName };
        state.trackedCategories.push(newCat);
        categoryId = newCat.id;
      }
    } else if (existingCatVal) {
      const idNum = parseInt(existingCatVal, 10);
      if (!isNaN(idNum)) categoryId = idNum;
    }

    const rawLoc = locEl?.value || "all";
    const location = rawLoc === "all" ? "all" : parseInt(rawLoc, 10);

    // Build field definitions from draft (keep ids if editing)
    const buildFields = (existingTask) => {
      const existingById = new Map((existingTask?.fields || []).map(f => [f.id, f]));
      return draftFields.map(df => {
        const old = existingById.get(df.id);
        const base = {
          id: df.id || state.nextTrackedFieldId++,
          label: df.label,
          type: df.type,
          highlightEnabled: !!df.highlightEnabled,
          expiryDays: df.type === "date" ? (parseInt(df.expiryDays || 28, 10) || 28) : undefined
        };
        // Preserve value when editing same field id
        if (old) {
          base.value = old.value;
        } else {
          base.value = (df.type === "checkbox") ? false : "";
        }
        return base;
      });
    };

    if (editingTrackedTaskId !== null) {
      // EDIT existing single task
      const t = state.trackedTasks.find(x => x.id === editingTrackedTaskId);
      if (!t) {
        editingTrackedTaskId = null;
        alert("Couldn't find that tracked task to edit. Try again.");
        return;
      }

      t.title = title;
      t.categoryId = categoryId || null;
      // keep original location unless user changes it
      t.location = (location === "all" ? "all" : location);
      t.fields = buildFields(t);

      saveState();
      clearTrackedForm();
      ensureCategorySelect();
      renderTrackedTasks();
      return;
    }

    // CREATE new tasks (with all-locations expansion)
    const baseDraftFields = draftFields.map(df => ({
      label: df.label,
      type: df.type,
      highlightEnabled: !!df.highlightEnabled,
      expiryDays: df.type === "date" ? (parseInt(df.expiryDays || 28, 10) || 28) : undefined
    }));

    const buildFieldsWithNewIds = () => baseDraftFields.map(bf => ({
      id: state.nextTrackedFieldId++,
      label: bf.label,
      type: bf.type,
      highlightEnabled: !!bf.highlightEnabled,
      expiryDays: bf.type === "date" ? (parseInt(bf.expiryDays || 28, 10) || 28) : undefined,
      value: (bf.type === "checkbox") ? false : ""
    }));

    if (location === "all") {
      if (!state.locations || state.locations.length === 0) {
        alert("You selected All locations, but you haven't added any locations yet.");
        return;
      }
      state.locations.forEach(loc => {
        state.trackedTasks.push({
          id: state.nextTrackedTaskId++,
          title,
          location: loc.id,
          categoryId: categoryId || null,
          fields: buildFieldsWithNewIds()
        });
      });
    } else {
      state.trackedTasks.push({
        id: state.nextTrackedTaskId++,
        title,
        location,
        categoryId: categoryId || null,
        fields: buildFieldsWithNewIds()
      });
    }

    saveState();
    clearTrackedForm();
    ensureCategorySelect();
    renderTrackedTasks();
  });
}


function lerp(a, b, t) { return a + (b - a) * t; }
function hexToRgb(hex) {
  const h = (hex || "").replace("#", "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0,2), 16),
    g: parseInt(h.slice(2,4), 16),
    b: parseInt(h.slice(4,6), 16)
  };
}
function rgbToHex({r,g,b}) {
  const to = (n) => String(Math.max(0, Math.min(255, Math.round(n))).toString(16)).padStart(2,"0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function closePortalMenu() {
  if (portalMenuEl && portalMenuEl.parentNode) {
    portalMenuEl.parentNode.removeChild(portalMenuEl);
  }
  portalMenuEl = null;
  portalCleanupFns.forEach(fn => {
    try { fn(); } catch {}
  });
  portalCleanupFns = [];
}

function openPortalMenu(anchorBtn, taskId, onAction) {
  closePortalMenu();

  const menu = document.createElement("div");
  menu.className = "tracked-menu tracked-menu-portal";
  menu.setAttribute("role", "menu");
  menu.innerHTML = `
    <button type="button" role="menuitem" data-action="edit">Edit</button>
    <button type="button" role="menuitem" data-action="dup">Duplicate</button>
    <button type="button" role="menuitem" data-action="del">Delete</button>
  `;

  document.body.appendChild(menu);
  portalMenuEl = menu;

  // Positioning: default below; flip above if needed
  const place = () => {
    if (!portalMenuEl) return;

    // Make sure we can measure
    portalMenuEl.style.visibility = "hidden";
    portalMenuEl.style.right = "auto";
    portalMenuEl.style.bottom = "auto";
    portalMenuEl.style.left = "0px";
    portalMenuEl.style.top = "0px";

    const rect = anchorBtn.getBoundingClientRect();
    const menuRect = portalMenuEl.getBoundingClientRect();

    const margin = 8;
    let top = rect.bottom + 6;
    if (top + menuRect.height > window.innerHeight - margin) {
      top = rect.top - menuRect.height - 6;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - menuRect.height - margin));

    let left = rect.right - menuRect.width;
    left = Math.max(margin, Math.min(left, window.innerWidth - menuRect.width - margin));

    portalMenuEl.style.left = `${Math.round(left)}px`;
    portalMenuEl.style.top = `${Math.round(top)}px`;
    portalMenuEl.style.visibility = "visible";
  };

  place();

  // Close on outside click, scroll, resize, escape
  const onDocClick = (e) => {
    if (!portalMenuEl) return;
    if (portalMenuEl.contains(e.target) || anchorBtn.contains(e.target)) return;
    closePortalMenu();
    anchorBtn.setAttribute("aria-expanded", "false");
  };

  const onScroll = () => {
    // Reposition while scrolling; closing is also fine, but reposition feels nicer
    place();
  };

  const onResize = () => place();

  const onKey = (e) => {
    if (e.key === "Escape") {
      closePortalMenu();
      anchorBtn.setAttribute("aria-expanded", "false");
    }
  };

  document.addEventListener("click", onDocClick, true);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onResize);
  document.addEventListener("keydown", onKey);

  portalCleanupFns.push(() => document.removeEventListener("click", onDocClick, true));
  portalCleanupFns.push(() => window.removeEventListener("scroll", onScroll, true));
  portalCleanupFns.push(() => window.removeEventListener("resize", onResize));
  portalCleanupFns.push(() => document.removeEventListener("keydown", onKey));

  // Wire actions
  portalMenuEl.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = btn.dataset.action;
      onAction(action, taskId);
      closePortalMenu();
      anchorBtn.setAttribute("aria-expanded", "false");
    });
  });
}


function computeDateFieldStyle(f) {
  if (!f || f.type !== "date" || !f.highlightEnabled) return "";
  const v = String(f.value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";

  const exp = parseInt(f.expiryDays || 28, 10);
  if (!exp || exp <= 0) return "";

  const then = new Date(v + "T00:00:00");
  const now = new Date();
  const diffDays = Math.floor((now - then) / (1000*60*60*24));
  const ratio = Math.max(0, Math.min(1, diffDays / exp));

  const green = hexToRgb("#d9f7d9");
  const red = hexToRgb("#f7d9d9");
  const c = {
    r: lerp(green.r, red.r, ratio),
    g: lerp(green.g, red.g, ratio),
    b: lerp(green.b, red.b, ratio),
  };
  const bg = rgbToHex(c);
  return `background-color:${bg}; border-color:${bg};`;
}

function computeTaskStatusStyle(t) {
  // Look for date fields with highlightEnabled
  const fields = (t.fields || []).filter(f => f.type === "date" && f.highlightEnabled);
  if (fields.length === 0) return "";

  // Compute "most urgent" (largest ratio) among highlighted date fields that have a value
  let bestRatio = -1;
  fields.forEach(f => {
    const v = String(f.value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    const exp = parseInt(f.expiryDays || 28, 10);
    if (!exp || exp <= 0) return;
    const then = new Date(v + "T00:00:00");
    const now = new Date();
    const diffDays = Math.floor((now - then) / (1000*60*60*24));
    const ratio = Math.max(0, Math.min(1, diffDays / exp));
    if (ratio > bestRatio) bestRatio = ratio;
  });

  if (bestRatio < 0) return ""; // no usable date yet

  const green = hexToRgb("#d9f7d9");
  const red = hexToRgb("#f7d9d9");
  const c = {
    r: lerp(green.r, red.r, bestRatio),
    g: lerp(green.g, red.g, bestRatio),
    b: lerp(green.b, red.b, bestRatio),
  };
  const bg = rgbToHex(c);
  return `background-color:${bg};`;
}

function renderTrackedTaskRow(t) {
  const locLabel = getLocationNameByValue(t.location);

  let html = `<div class="tracked-task-row" data-task="${t.id}">
    <div class="tracked-task-name">
      <strong>${escapeHtml(t.title)}</strong>
      <span class="muted"> • ${escapeHtml(locLabel)}</span>
    </div>

    <div class="tracked-task-fields">`;

  if (!t.fields || t.fields.length === 0) {
    html += `<span class="muted">No fields</span>`;
  } else {
    t.fields.forEach(f => {
      const fid = `${t.id}:${f.id}`;
      if (f.type === "checkbox") {
        const checked = f.value ? "checked" : "";
        html += `<label class="tracked-field tracked-field-checkbox">
          <span class="tracked-field-label">${escapeHtml(f.label)}</span>
          <input type="checkbox" data-field="${fid}" ${checked} />
        </label>`;
      } else if (f.type === "date") {
        html += `<label class="tracked-field tracked-field-date">
          <span class="tracked-field-label">${escapeHtml(f.label)}</span>
          <div class="tracked-date-row" style="${computeDateFieldStyle(f)}">
            <input type="date" data-field="${fid}" value="${escapeHtml(String(f.value || ""))}" />
            <button type="button" class="tracked-date-today" title="Set to today" data-set-today="${fid}">✓</button>
          </div>
        </label>`;
      } else if (f.type === "number") {
        html += `<label class="tracked-field">
          <span class="tracked-field-label">${escapeHtml(f.label)}</span>
          <input type="number" data-field="${fid}" value="${escapeHtml(String(f.value || ""))}" />
        </label>`;
      } else {
        html += `<label class="tracked-field">
          <span class="tracked-field-label">${escapeHtml(f.label)}</span>
          <input type="text" data-field="${fid}" value="${escapeHtml(String(f.value || ""))}" />
        </label>`;
      }
    });
  }

  html += `</div>

    <div class="tracked-task-actions">
      <button class="tracked-menu-btn" type="button" data-menu="${t.id}" aria-haspopup="menu" aria-expanded="false">⋯</button>
    </div>
  </div>`;

  return html;
}


export function renderTrackedTasks() {
  const wrapper = document.getElementById("trackedTasksWrapper");
  if (!wrapper) return;

  if (!Array.isArray(state.trackedTasks) || state.trackedTasks.length === 0) {
    wrapper.innerHTML = '<p class="no-tasks">No tracked tasks yet. Create one above.</p>';
    return;
  }

  // Group tasks: category -> location -> tasks[]
  const grouped = new Map(); // catId -> Map(locId -> tasks[])
  state.trackedTasks.forEach(t => {
    const catId = t.categoryId || 0;
    const locId = t.location === "all" ? 0 : (t.location || 0);

    if (!grouped.has(catId)) grouped.set(catId, new Map());
    const locMap = grouped.get(catId);
    if (!locMap.has(locId)) locMap.set(locId, []);
    locMap.get(locId).push(t);
  });

  // Category order: existing categories, then Uncategorized (0 if exists)
  const catOrder = state.trackedCategories.map(c => ({ id: c.id, name: c.name }));
  if (grouped.has(0)) catOrder.push({ id: 0, name: "Uncategorized" });

  // Location label helper
  const locLabel = (locId) => {
    if (locId === 0) return "All locations";
    const loc = state.locations.find(l => l.id === locId);
    return loc ? loc.name : "(Unknown location)";
  };

  let html = `<div class="tracked-accordion">`;

  catOrder.forEach(cat => {
    const locMap = grouped.get(cat.id);
    if (!locMap || locMap.size === 0) return;

    const isCatOpen = expandedCategoryId === cat.id;

    html += `
      <div class="tracked-category">
        <button class="tracked-category-toggle ${isCatOpen ? "open" : ""}" data-cat="${cat.id}">
          <span>${escapeHtml(cat.name)}</span>
          <span class="muted">${Array.from(locMap.values()).reduce((a,b)=>a+b.length,0)}</span>
        </button>
        <div class="tracked-category-body ${isCatOpen ? "" : "hidden"}">
    `;

    // Sort locations: known locations order, then All/Unknown
    const locIds = Array.from(locMap.keys());
    const ordered = [];
    // known locations
    state.locations.forEach(l => { if (locMap.has(l.id)) ordered.push(l.id); });
    // all-locations bucket (0)
    if (locMap.has(0)) ordered.push(0);
    // any unknown
    locIds.forEach(id => { if (!ordered.includes(id)) ordered.push(id); });

    const openLocId = expandedLocationByCategory.get(cat.id) ?? null;

    ordered.forEach(locId => {
      const list = locMap.get(locId) || [];
      if (list.length === 0) return;
      const isLocOpen = openLocId === locId;

      html += `
        <div class="tracked-subcategory">
          <button class="tracked-subcategory-toggle ${isLocOpen ? "open" : ""}" data-cat="${cat.id}" data-loc="${locId}">
            <span>${escapeHtml(locLabel(locId))}</span>
            <span class="muted">${list.length}</span>
          </button>
          <div class="tracked-subcategory-body ${isLocOpen ? "" : "hidden"}">
            ${list.map(t => renderTrackedTaskRow(t)).join("")}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `</div>`;
  wrapper.innerHTML = html;

  // Category accordion: only one open at a time
  wrapper.querySelectorAll("button.tracked-category-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const catId = parseInt(btn.dataset.cat, 10);
      if (isNaN(catId)) return;

      if (expandedCategoryId === catId) {
        expandedCategoryId = null;
      } else {
        expandedCategoryId = catId;
      }
      renderTrackedTasks();
    });
  });

  // Location accordion inside category: only one open per category
  wrapper.querySelectorAll("button.tracked-subcategory-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const catId = parseInt(btn.dataset.cat, 10);
      const locId = parseInt(btn.dataset.loc, 10);
      if (isNaN(catId) || isNaN(locId)) return;

      const current = expandedLocationByCategory.get(catId);
      if (current === locId) {
        expandedLocationByCategory.set(catId, null);
      } else {
        expandedLocationByCategory.set(catId, locId);
      }
      // Keep same category open
      expandedCategoryId = catId;
      renderTrackedTasks();
    });
  });

  // menus (Edit / Duplicate / Delete) - portal (prevents clipping)
  wrapper.querySelectorAll("button.tracked-menu-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const id = parseInt(btn.dataset.menu, 10);
      if (isNaN(id)) return;

      const expanded = btn.getAttribute("aria-expanded") === "true";
      // Toggle
      if (expanded) {
        closePortalMenu();
        btn.setAttribute("aria-expanded", "false");
        return;
      }

      btn.setAttribute("aria-expanded", "true");

      openPortalMenu(btn, id, (action, taskId) => {
        const t = state.trackedTasks.find(x => x.id === taskId);
        if (!t) return;

        if (action === "edit") {
          editingTrackedTaskId = taskId;
          const createBtn = document.getElementById("trackedTaskCreateBtn");
          if (createBtn) createBtn.textContent = "Save Changes";
          loadTaskIntoForm(t);

          expandedCategoryId = t.categoryId || 0;
          expandedLocationByCategory.set(
            expandedCategoryId,
            (t.location === "all" ? 0 : (t.location || 0))
          );
          renderTrackedTasks();
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (action === "dup") {
          loadTaskIntoForm(t);
          editingTrackedTaskId = null;
          const createBtn = document.getElementById("trackedTaskCreateBtn");
          if (createBtn) createBtn.textContent = "Add Tracked Task";
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (action === "del") {
          if (!confirm("Delete this tracked task?")) return;
          state.trackedTasks = state.trackedTasks.filter(x => x.id !== taskId);
          saveState();
          renderTrackedTasks();
        }
      });
    });
  });

  // Close portal menu when we re-render / switch
  wrapper.addEventListener("click", () => {
    // (capturing is in openPortalMenu, but this keeps state clean)
    // also reset all aria-expanded
    wrapper.querySelectorAll("button.tracked-menu-btn[aria-expanded='true']").forEach(b => b.setAttribute("aria-expanded", "false"));
  });

  // wire field changes
  wrapper.querySelectorAll("[data-field]").forEach(el => {
    el.addEventListener("change", () => {
      const [taskIdStr, fieldIdStr] = String(el.dataset.field).split(":");
      const taskId = parseInt(taskIdStr, 10);
      const fieldId = parseInt(fieldIdStr, 10);
      const task = state.trackedTasks.find(t => t.id === taskId);
      const field = task?.fields?.find(f => f.id === fieldId);
      if (!field) return;

      if (field.type === "checkbox") {
        field.value = !!el.checked;
      } else {
        field.value = el.value;
      }
      saveState();
    });
  });
  // quick-set date fields to today
  wrapper.querySelectorAll("button[data-set-today]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const fid = String(btn.dataset.setToday || "");
      if (!fid) return;

      const input = wrapper.querySelector(`input[type="date"][data-field="${CSS.escape(fid)}"]`);
      if (!input) return;

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const today = `${yyyy}-${mm}-${dd}`;

      input.value = today;
      // Trigger the same save logic
      input.dispatchEvent(new Event("change", { bubbles: true }));

      // Visual feedback: flash green then fade back to gray
      btn.classList.add("flash-green");
      setTimeout(() => btn.classList.remove("flash-green"), 900);
    });
  });

}


export function refreshTrackedFormOptions() {
  ensureLocationSelect();
  ensureCategorySelect();
  ensureBulkLocationSelect();
  ensureBulkCategorySelect();
}
