export const dayNames = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// Local storage keys
export const STORAGE_KEY_TASKS = "planner_tasks_v1";
export const STORAGE_KEY_ASSIGNMENTS = "planner_assignments_v1";
export const STORAGE_KEY_LOCATIONS = "planner_locations_v1";
export const STORAGE_KEY_DAYCELLSETTINGS = "planner_daycellsettings_v1";
export const STORAGE_KEY_WEEK_VISIBILITY = "planner_weekVisibility_v1";

// Google login & Drive config
export const ADMIN_EMAILS = new Set(["johnpaulcheramie@gmail.com"]);
export const LOGIN_STORAGE_KEY = "planner_google_session_v1";
export const DRIVE_FILE_NAME = "planner-data.json";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// Planner start date (Monday of Week 1)
export const STORAGE_KEY_START_MONDAY = "planner_startMonday_v1";
export const STORAGE_KEY_TRACKED_CATEGORIES = "planner_trackedCategories_v1";
export const STORAGE_KEY_TRACKED_TASKS = "planner_trackedTasks_v1";
// Tracks last modification time of the planner state (ms since epoch)
export const STORAGE_KEY_LAST_MODIFIED = "planner_lastModified_v1";
