const toggleSlider = document.getElementById("power-button");

chrome.storage.local.get(["isAutoScanEnabled"], (result) => {
  toggleSlider.checked = !!result.isAutoScanEnabled;
});

toggleSlider.addEventListener("change", () => {
  const isEnabled = toggleSlider.checked;

  if (isEnabled) {
    console.log('Requesting geolocation permission...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Permission granted:', position);
        enableScanning(true);
      },
      (error) => {
        console.error('Geolocation error:', error.message);
        alert('Geolocation permission is required to enable auto-scanning. Please allow location access.');
        toggleSlider.checked = false;
        enableScanning(false);
      }
    );
  } else {
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

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.isAutoScanEnabled) {
    toggleSlider.checked = !!changes.isAutoScanEnabled.newValue;
  }
});