// popup.js

const toggleSlider = document.getElementById("power-button");

// Load the saved state of the slider when popup opens
chrome.storage.local.get(["isAutoScanEnabled"], (result) => {
  toggleSlider.checked = !!result.isAutoScanEnabled;
});

// Listen for slider changes
toggleSlider.addEventListener("change", () => {
  const isEnabled = toggleSlider.checked;

  if (isEnabled) {
    // --- UPDATE: Ask for permission BEFORE enabling ---
    console.log('Requesting geolocation permission...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Success: Permission was granted
        console.log('Permission granted:', position);
        enableScanning(true);
      },
      (error) => {
        // Error: Permission was denied or another error occurred
        console.error('Geolocation error:', error.message);
        alert('Geolocation permission is required to enable auto-scanning. Please allow location access.');
        // Uncheck the box since we couldn't get permission
        toggleSlider.checked = false;
        enableScanning(false); // Ensure it's off in storage
      }
    );
  } else {
    // --- Disabling is simple ---
    enableScanning(false);
  }
});

function enableScanning(isEnabled) {
  chrome.storage.local.set({ isAutoScanEnabled: isEnabled }, () => {
    chrome.runtime.sendMessage({
      type: "TOGGLE_AUTOSCAN",
      isEnabled: isEnabled,
    });
    console.log(`Auto-scanning set to ${isEnabled}.`);
  });
}

// Keep popup UI in sync if storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.isAutoScanEnabled) {
    toggleSlider.checked = !!changes.isAutoScanEnabled.newValue;
  }
});