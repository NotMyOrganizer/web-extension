const API_URL = "https://api.example.com/extension-data";
const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';
let isAutoScanEnabled = false;
let lastUrl = null;

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
  const matchedClients = await clients.matchAll();
  return matchedClients.some(c => c.url.endsWith(OFFSCREEN_DOCUMENT_PATH));
}

async function getGeolocation() {
  if (!(await hasOffscreenDocument())) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['GEOLOCATION'],
      justification: 'To fetch user location for the data payload.',
    });
  }
  const response = await chrome.runtime.sendMessage({ type: 'GET_GEOLOCATION' });
  await chrome.offscreen.closeDocument();
  if (response && response.ok) {
    return response;
  } else {
    throw new Error(response?.error || 'Unknown geolocation error');
  }
}

async function collectAndSendAllData(tabId, url) {
  if (url === lastUrl) {
    console.log("URL is the same as the last scanned one. Skipping.");
    return;
  }
  lastUrl = url;
  
  console.log("Collecting data for:", url);

  try {
    const metadata = await extractMetadata(tabId);

    let geolocationData = null;
    try {
      geolocationData = await getGeolocation();
    } catch (e) {
      console.warn("Could not get geolocation. User may have denied permission or an error occurred.", e.message);
    }

    const payload = {
      timestamp: Date.now(),
      url: url,
      metadata: metadata.meta.description || null,
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TOGGLE_AUTOSCAN") {
    isAutoScanEnabled = message.isEnabled;
    chrome.storage.local.set({ isAutoScanEnabled: isAutoScanEnabled }, () => {
      console.log(`Auto-scanning is now ${isAutoScanEnabled ? "enabled" : "disabled"}`);
      sendResponse({ ok: true });
    });
    return true;
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