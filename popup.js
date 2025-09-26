// popup.js

const toggleSlider = document.getElementById("toggle-slider");
const outputEl = document.getElementById("output");

function show(obj) {
  try {
    outputEl.textContent =
      typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  } catch (e) {
    outputEl.textContent = String(obj);
  }
}

// Load the saved state of the slider when popup opens
chrome.storage.local.get(["isAutoScanEnabled"], (result) => {
  toggleSlider.checked = !!result.isAutoScanEnabled;
  show(`Auto-scanning ${toggleSlider.checked ? "enabled" : "disabled"}.`);
});

// Listen for slider changes
toggleSlider.addEventListener("change", () => {
  const isEnabled = toggleSlider.checked;
  chrome.storage.local.set({ isAutoScanEnabled: isEnabled }, () => {
    chrome.runtime.sendMessage({
      type: "TOGGLE_AUTOSCAN",
      isEnabled: isEnabled,
    });
    show(`Auto-scanning ${isEnabled ? "enabled" : "disabled"}.`);
  });
});

// Keep popup UI in sync if storage changes (e.g., another popup changed it)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.isAutoScanEnabled) {
    const newValue = changes.isAutoScanEnabled.newValue;
    toggleSlider.checked = !!newValue;
    show(`Auto-scanning ${toggleSlider.checked ? "enabled" : "disabled"}.`);
  }
});
