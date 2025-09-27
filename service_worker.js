// service_worker.js

// --- (Constants and other utility functions remain the same) ---
const API_URL = "https://api.example.com/extension-data"; // Replace with your real API endpoint
const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';
let isAutoScanEnabled = false;
let lastUrl = null;

// --- (getHistoryItems, sendMessageToTab, hasOffscreenDocument, getGeolocation, extractMetadata functions remain the same) ---

/* NOTE: The helper functions like getHistoryItems, getGeolocation, etc. are omitted here for brevity but should remain in your file. */
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

async function extractMetadata(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "GET_METADATA" });
    return response?.data || {};
  } catch (err) {
    console.warn("Metadata extraction failed:", err.message);
    return { error: err.message };
  }
}

async function hasOffscreenDocument() {
    /* ... your existing code ... */
}
async function getGeolocation() {
    /* ... your existing code ... */
}


/**
 * Collects all data points and sends them to the API.
 */
async function collectAndSendAllData(tabId, url) {
  if (url === lastUrl) {
    console.log("URL is the same as the last scanned one. Skipping.");
    return;
  }
  lastUrl = url;
  
  console.log("Collecting data for:", url);

  try {
    // --- UPDATE: Re-enabled history collection ---
    const historyData = await getHistoryItems(10);
    const metadata = await extractMetadata(tabId);

    let geolocationData = null;
    try {
      geolocationData = await getGeolocation();
    } catch (e) {
      console.warn("Could not get geolocation. User may have denied permission or an error occurred.", e.message);
    }

    // --- UPDATE: Cleaned up the payload ---
    const payload = {
      timestamp: Date.now(),
      url: url,
      history: historyData,
      metadata: metadata,
      geolocation: geolocationData,
    };

    console.log("Sending payload to API:", payload);
    
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

// --- (Event Listeners and Initialization remain the same) ---
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isAutoScanEnabled && changeInfo.status === "complete" && tab.url?.startsWith("http")) {
    console.log("tabs.onUpdated event fired for:", tab.url);
    collectAndSendAllData(tabId, tab.url);
  }
});

chrome.storage.local.get(["isAutoScanEnabled"], (result) => {
  isAutoScanEnabled = !!result.isAutoScanEnabled;
  console.log(`Initial state: auto-scanning is ${isAutoScanEnabled ? "enabled" : "disabled"}`);
});