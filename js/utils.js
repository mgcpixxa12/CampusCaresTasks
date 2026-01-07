export function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatFrequency(freq) {
  switch (freq) {
    case "daily": return "Daily";
    case "weekly": return "Weekly";
    case "monthly": return "Monthly";
    case "yearly": return "Yearly";
    case "one-time": return "One-time";
    default: return freq;
  }
}

export function formatMinutesToHHMM(mins) {
  const total = mins || 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

export function formatMinutesTo12hTime(mins) {
  let total = mins;
  if (total < 0) total = 0;
  total = total % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const period = h >= 12 ? "pm" : "am";
  let displayH = h % 12;
  if (displayH === 0) displayH = 12;
  return `${displayH}:${String(m).padStart(2,"0")}${period}`;
}

export function getLocationNameByValue(locations, val) {
  if (val === "all") return "All locations";
  const idNum = typeof val === "number" ? val : parseInt(val, 10);
  if (!idNum) return "";
  const loc = locations.find(l => l.id === idNum);
  return loc ? loc.name : "(Unknown location)";
}

export function getLocationColorById(locations, id) {
  if (!id) return null;
  const loc = locations.find(l => l.id === id);
  return loc ? loc.color : null;
}


export function formatDateWithOrdinal(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return "";
  const day = dateObj.getDate();
  const month = dateObj.toLocaleString(undefined, { month: "short" });
  const year = dateObj.getFullYear();
  const suffix = (day % 100 >= 11 && day % 100 <= 13) ? "th"
    : (day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th");
  return `${month} ${day}${suffix}, ${year}`;
}

export function getPlannerDateLabel(startMondayISO, weekIndex, dayIndex, fallbackDayName) {
  if (!startMondayISO) return fallbackDayName || "";
  const base = new Date(startMondayISO + "T00:00:00");
  if (isNaN(base.getTime())) return fallbackDayName || "";
  const d = new Date(base);
  d.setDate(d.getDate() + (weekIndex * 7 + dayIndex));
  const datePart = formatDateWithOrdinal(d);
  return `${fallbackDayName}, ${datePart}`;
}

export function getPlannerDateISO(startMondayISO, weekIndex, dayIndex) {
  if (!startMondayISO) return null;
  const base = new Date(startMondayISO + "T00:00:00");
  if (isNaN(base.getTime())) return null;
  const d = new Date(base);
  d.setDate(d.getDate() + (weekIndex * 7 + dayIndex));
  // yyyy-mm-dd
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
