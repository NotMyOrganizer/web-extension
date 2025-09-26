// popup.js

const toggleSlider = document.getElementById('toggle-slider');
const outputEl = document.getElementById('output');

function show(obj) {
  try {
    outputEl.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  } catch (e) {
    outputEl.textContent = String(obj);
  }
}

// Load the saved state of the slider
chrome.storage.local.get(['isAutoScanEnabled'], (result) => {
  toggleSlider.checked = !!result.isAutoScanEnabled;
});

// Listen for slider changes
toggleSlider.addEventListener('change', () => {
  const isEnabled = toggleSlider.checked;
  // Save the state
  chrome.storage.local.set({ isAutoScanEnabled: isEnabled }, () => {
    // Send a message to the background script to let it know the state has changed
    chrome.runtime.sendMessage({
      type: 'TOGGLE_AUTOSCAN',
      isEnabled: isEnabled
    });
    show(`Auto-scanning ${isEnabled ? 'enabled' : 'disabled'}.`);
  });
});