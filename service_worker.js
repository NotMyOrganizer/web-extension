// service_worker.js

// --- Constants and Global State ---
const API_URL = "https://api.example.com/extension-data"; // Replace with your real API endpoint
const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';
let isAutoScanEnabled = false;
let lastNavigationTimestamp = null;
let lastUrl = null;

// --- Utility Functions ---


/**
 * Retrieves a list of recent history items.
 */
function getHistoryItems(maxResults = 100) {
  return new Promise((resolve) => {
    chrome.history.search({ text: "", maxResults }, (results) => {
      const items = (results || []).map((r) => ({
        id: r.id,
        url: r.url,
        title: r.title,
        timestamp: r.lastVisitTime,
        visitCount: r.visitCount,
      }));
      resolve(items);
    });
  });
}

/**
 * A robust wrapper for chrome.tabs.sendMessage that handles errors.
 */
function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(response);
    });
  });
}

/**
 * Checks if the offscreen document is currently open.
 */
async function hasOffscreenDocument() {
  const matchedClients = await clients.matchAll();
  return matchedClients.some(c => c.url.endsWith(OFFSCREEN_DOCUMENT_PATH));
}

/**
 * Gets geolocation data using an offscreen document.
 */
async function getGeolocation() {
  if (!(await hasOffscreenDocument())) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['GEOLOCATION'],
      justification: 'To fetch user location for the data payload.',
    });
  }
  const response = await chrome.runtime.sendMessage({ type: 'GET_GEOLOCATION' });
  await chrome.offscreen.closeDocument(); // Close after use to conserve resources

  if (response && response.ok) {
    return response;
  } else {
    throw new Error(response?.error || 'Unknown geolocation error');
  }
}

async function extractMetadata(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "GET_METADATA" });
    return response?.data || {};
  } catch (err) {
    console.warn("Metadata extraction failed:", err.message);
    return { error: err.message };
  }
}

// --- Core Logic ---

/**
 * Collects all data points and sends them to the API.
 */
async function collectAndSendAllData(tabId, url) {
  // Avoid scanning the same URL repeatedly
  if (url === lastUrl) {
    console.log("URL is the same as the last scanned one. Skipping.");
    return;
  }
  lastUrl = url;
  
  console.log("Collecting data for:", url);

  try {
    // const historyData = await getHistoryItems(10);

    let metadata = await extractMetadata(tabId);

    let geolocationData = null;
    try {
      geolocationData = await getGeolocation();
    } catch (e) {
      console.warn("Could not get geolocation. User may have denied permission or an error occurred.", e.message);
    }

    const payload = {
      timestamp: Date.now(),
      url: url,
      metadata : metadata,
      getGeolocation : geolocationData
    };

    console.log("Sending payload to API:", payload);

    const payload2 = {
      timestamp: Date.now(),
      url: url,
      metadata : metadata.meta.description || null,
      getGeolocation : geolocationData
    }

    console.log("The payload 2 is :" , payload2);
    
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      console.log("Data successfully sent to API.");
    } else {
      console.error("Failed to send data to API. Status:", resp.status);
    }
  } catch (err) {
    console.error("An error occurred during the data collection process:", err);
  }
}

// --- Event Listeners ---

// Listen for messages from the popup (e.g., to toggle scanning)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TOGGLE_AUTOSCAN") {
    isAutoScanEnabled = message.isEnabled;
    // Persist the setting so it's remembered
    chrome.storage.local.set({ isAutoScanEnabled: isAutoScanEnabled }, () => {
      console.log(`Auto-scanning is now ${isAutoScanEnabled ? "enabled" : "disabled"}`);
      sendResponse({ ok: true });
    });
    return true; // Indicates an asynchronous response
  }
});

// Listen for standard page loads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isAutoScanEnabled && changeInfo.status === "complete" && tab.url?.startsWith("http")) {
    console.log("tabs.onUpdated event fired for:", tab.url);
    collectAndSendAllData(tabId, tab.url);
  }
});

// --- Initialization ---

// Load the initial state from storage when the extension starts
chrome.storage.local.get(["isAutoScanEnabled"], (result) => {
  isAutoScanEnabled = !!result.isAutoScanEnabled;
  console.log(`Initial state: auto-scanning is ${isAutoScanEnabled ? "enabled" : "disabled"}`);
});