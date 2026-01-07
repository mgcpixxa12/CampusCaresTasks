export function initTabs() {
  document.querySelectorAll(".tab-buttons button[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });
}

export function showTab(tab) {
  // Tabs
  document.querySelectorAll("main .tab").forEach(sec => sec.classList.remove("active"));
  // Buttons
  document.querySelectorAll(".tab-buttons button[data-tab]").forEach(btn => btn.classList.remove("active"));

  const targetSec = document.getElementById(tab + "Tab");
  const targetBtn = document.querySelector(`.tab-buttons button[data-tab="${tab}"]`);

  if (targetSec) targetSec.classList.add("active");
  if (targetBtn) targetBtn.classList.add("active");
}
