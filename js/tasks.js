import { state, saveState } from "./state.js?v=20260224_04";
import { escapeHtml, formatFrequency, getLocationNameByValue } from "./utils.js?v=20260224_04";
import { showTab } from "./tabs.js?v=20260224_04";
import { renderCalendar } from "./calendar.js?v=20260224_04";
import { renderLocationsTab } from "./locations.js?v=20260224_04";

export function populateTaskLocationOptions(selectedValue) {
  const select = document.getElementById("taskLocation");
  if (!select) return;
  const current = selectedValue !== undefined ? selectedValue : (select.value || "all");

  select.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All locations";
  select.appendChild(optAll);

  state.locations.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = String(loc.id);
    opt.textContent = loc.name;
    select.appendChild(opt);
  });

  if (current != null) select.value = String(current);
}

export function initTaskForm() {
  const submitBtn = document.getElementById("taskFormSubmitBtn");
  const cancelBtn = document.getElementById("taskFormCancelBtn");
  submitBtn?.addEventListener("click", handleTaskFormSubmit);
  cancelBtn?.addEventListener("click", cancelEditTask);
}

export function handleTaskFormSubmit() {
  const nameInput = document.getElementById("taskName");
  const descInput = document.getElementById("taskDescription");
  const lengthInput = document.getElementById("taskLength");
  const freqSelect = document.getElementById("taskFrequency");
  const locSelect = document.getElementById("taskLocation");

  const name = nameInput.value.trim();
  const desc = descInput.value.trim();
  const lengthMinutes = parseInt(lengthInput.value, 10);
  const frequency = freqSelect.value;
  const rawLoc = locSelect.value || "all";
  const locationVal = rawLoc === "all" ? "all" : parseInt(rawLoc, 10);

  if (!name) { alert("Please enter a task name."); return; }
  if (isNaN(lengthMinutes)) { alert("Please enter a number of minutes (can be negative for lunch)."); return; }

  if (state.editingTaskId === null) {
    const newTask = { id: state.nextTaskId++, name, description: desc, lengthMinutes, frequency, location: locationVal };
    state.tasks.push(newTask);
  } else {
    const task = state.tasks.find(t => t.id === state.editingTaskId);
    if (task) {
      task.name = name;
      task.description = desc;
      task.lengthMinutes = lengthMinutes;
      task.frequency = frequency;
      task.location = locationVal;
    }
  }

  state.editingTaskId = null;
  document.getElementById("taskFormSubmitBtn").textContent = "Add Task to List";
  document.getElementById("taskFormCancelBtn").style.display = "none";

  nameInput.value = "";
  descInput.value = "";
  lengthInput.value = "";
  freqSelect.value = "daily";
  populateTaskLocationOptions("all");

  renderTaskList();
  renderCalendar();
  renderLocationsTab();
  saveState();
}

export function startEditTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  state.editingTaskId = taskId;
  document.getElementById("taskName").value = task.name;
  document.getElementById("taskDescription").value = task.description || "";
  document.getElementById("taskLength").value = task.lengthMinutes;
  document.getElementById("taskFrequency").value = task.frequency;
  populateTaskLocationOptions(task.location || "all");

  document.getElementById("taskFormSubmitBtn").textContent = "Save Changes";
  document.getElementById("taskFormCancelBtn").style.display = "inline-block";
  showTab("tasks");
}

export function cancelEditTask() {
  state.editingTaskId = null;
  document.getElementById("taskName").value = "";
  document.getElementById("taskDescription").value = "";
  document.getElementById("taskLength").value = "";
  document.getElementById("taskFrequency").value = "daily";
  populateTaskLocationOptions("all");
  document.getElementById("taskFormSubmitBtn").textContent = "Add Task to List";
  document.getElementById("taskFormCancelBtn").style.display = "none";
}

export function deleteTask(taskId) {
  if (!confirm("Delete this task and remove it from the calendar?")) return;

  state.tasks = state.tasks.filter(t => t.id !== taskId);

  if (state.editingTaskId === taskId) cancelEditTask();

  for (let w = 0; w < 4; w++) {
    for (let d = 0; d < 7; d++) {
      state.assignments[w][d] = state.assignments[w][d].filter(
        entry => !(entry.type === "task" && entry.taskId === taskId)
      );
    }
  }

  saveState();
  renderTaskList();
  renderCalendar();
  renderLocationsTab();
}

export function renderTaskList() {
  const wrapper = document.getElementById("tasksTableWrapper");
  if (!wrapper) return;

  if (state.tasks.length === 0) {
    wrapper.innerHTML = '<p class="no-tasks">No tasks yet. Add some above.</p>';
    return;
  }

  let html = '<table><thead><tr>';
  html += "<th>#</th><th>Name</th><th>Description</th><th>Length (min)</th><th>Frequency</th><th>Location</th><th>Actions</th>";
  html += "</tr></thead><tbody>";

  state.tasks.forEach((task, index) => {
    html += `<tr data-task-index="${index}">
      <td>${task.id}</td>
      <td>${escapeHtml(task.name)}</td>
      <td>${escapeHtml(task.description || "")}</td>
      <td>
        <input type="number" class="task-inline-input" value="${task.lengthMinutes}" data-minutes-taskid="${task.id}" />
      </td>
      <td>
        <select class="task-inline-select" data-freq-taskid="${task.id}">
          <option value="daily"${task.frequency === "daily" ? " selected" : ""}>Daily</option>
          <option value="weekly"${task.frequency === "weekly" ? " selected" : ""}>Weekly</option>
          <option value="monthly"${task.frequency === "monthly" ? " selected" : ""}>Monthly</option>
          <option value="yearly"${task.frequency === "yearly" ? " selected" : ""}>Yearly</option>
          <option value="one-time"${task.frequency === "one-time" ? " selected" : ""}>One-time</option>
        </select>
      </td>
      <td>${escapeHtml(getLocationNameByValue(state.locations, task.location))}</td>
      <td>
        <button type="button" data-edit-taskid="${task.id}">Edit</button>
        <button type="button" data-delete-taskid="${task.id}">Delete</button>
      </td>
    </tr>`;
  });

  html += "</tbody></table>";
  wrapper.innerHTML = html;

  // Wire inline edits & action buttons
  wrapper.querySelectorAll("[data-minutes-taskid]").forEach(inp => {
    inp.addEventListener("change", () => handleInlineTaskMinutesChange(parseInt(inp.dataset.minutesTaskid,10), inp.value));
  });
  wrapper.querySelectorAll("[data-freq-taskid]").forEach(sel => {
    sel.addEventListener("change", () => handleInlineTaskFrequencyChange(parseInt(sel.dataset.freqTaskid,10), sel.value));
  });
  wrapper.querySelectorAll("[data-edit-taskid]").forEach(btn => {
    btn.addEventListener("click", () => startEditTask(parseInt(btn.dataset.editTaskid,10)));
  });
  wrapper.querySelectorAll("[data-delete-taskid]").forEach(btn => {
    btn.addEventListener("click", () => deleteTask(parseInt(btn.dataset.deleteTaskid,10)));
  });

  attachDragAndDropToTaskRows();
}

function handleInlineTaskMinutesChange(taskId, newValue) {
  const mins = parseInt(newValue, 10);
  if (isNaN(mins)) return;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.lengthMinutes = mins;
  saveState();
  renderCalendar();
  renderLocationsTab();
}

function handleInlineTaskFrequencyChange(taskId, newFreq) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.frequency = newFreq;
  saveState();
  renderCalendar();
  renderLocationsTab();
}

function attachDragAndDropToTaskRows() {
  const wrapper = document.getElementById("tasksTableWrapper");
  const rows = wrapper.querySelectorAll("tbody tr[data-task-index]");

  rows.forEach(row => {
    row.draggable = true;

    row.addEventListener("dragstart", function () {
      state.draggedTaskIndex = parseInt(this.dataset.taskIndex, 10);
      this.classList.add("dragging");
    });

    row.addEventListener("dragover", e => e.preventDefault());

    row.addEventListener("drop", function (e) {
      e.preventDefault();
      const targetIndex = parseInt(this.dataset.taskIndex, 10);
      if (
        state.draggedTaskIndex === null ||
        isNaN(state.draggedTaskIndex) ||
        isNaN(targetIndex) ||
        state.draggedTaskIndex === targetIndex
      ) {
        this.classList.remove("dragging");
        return;
      }
      const moved = state.tasks.splice(state.draggedTaskIndex, 1)[0];
      state.tasks.splice(targetIndex, 0, moved);
      state.draggedTaskIndex = null;
      saveState();
      renderTaskList();
      renderCalendar();
      renderLocationsTab();
    });

    row.addEventListener("dragend", function () {
      this.classList.remove("dragging");
    });
  });
}
