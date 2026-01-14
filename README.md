# 4-Week Planner (Modular)

This is your original single-file planner split into separate, cleaner files (no build tools needed).

## Files
- `index.html` – markup + loads Google GSI and the ES-module entrypoint
- `css/styles.css` – all styles
- `js/main.js` – app bootstrap + wiring
- `js/state.js` – data model + localStorage + change hooks
- `js/auth.js` – Google Sign-In + Google Drive sync
- `js/tabs.js` – tab navigation
- `js/tasks.js` – task editor + task table rendering
- `js/locations.js` – locations editor + checklist rendering
- `js/calendar.js` – calendar rendering + drag/drop + frequency rules
- `js/utils.js` – shared helpers
- `js/constants.js` – constants / keys

## Run
Just open `index.html` in a browser, or host the folder on GitHub Pages.
(Drive sync requires HTTPS, so GitHub Pages is recommended.)

## Local server launcher (double-click)
For local testing, you can run a tiny server and auto-open Chrome in Incognito:

### Windows
Double-click: **Start Local Server (Windows).bat**

### macOS
Double-click: **Start Local Server (macOS).command**
- If macOS blocks it: right-click → Open (first run), or run:
  `chmod +x "Start Local Server (macOS).command"`

### Linux
Run:
`chmod +x start-server-linux.sh`
then:
`./start-server-linux.sh`

All launchers:
- Start `python -m http.server` on port **8000**
- Open `http://localhost:8000/index.html` in **Chrome Incognito** (or default browser if Chrome isn’t found)

## Google Drive sync re-auth behavior
Google Drive access tokens **expire** and browsers often require a **user click** to re-authorize.
To prevent annoying popups while you're editing:

- The app will **NOT** trigger an account chooser during background autosave.
- If Drive needs a refresh, you'll see a **Reconnect Drive** button in the header.
- Click **Reconnect Drive** once, and autosave will resume.

## New tabs: Unfinished Tasks + Tracked Tasks

### Week 1 Monday date
On the **Calendar** tab, set the **Week 1 Monday date**. This enables:
- Showing real dates in the day headers (e.g. “Monday, Jan 5th, 2026”)
- Automatic “Unfinished Tasks” detection for past days

### Unfinished Tasks
If a scheduled task on a **past** day is not checked off, it will appear in **Unfinished Tasks**.

### Tracked Tasks
Create custom tasks with form-like fields (text/number/date/checkbox), optionally grouped by categories.
Tracked Tasks default to **All locations**, but you can select a specific location.

### Tracked Tasks: "All locations"
When you create a tracked task with **All locations**, the app generates **one tracked-task instance per location** (so each school/classroom has its own checklist fields & values).


## Cache-busting (GitHub Pages)
This build uses a version query string (`?v=20260114_03`) on all JS module imports so browsers don’t keep running old cached code. If you deploy a new build, bump the BUILD string in `index.html` and the JS import URLs.
