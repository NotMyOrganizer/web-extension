// service_worker.js

// --- Global State ---
let isAutoScanEnabled = false;
let lastNavigationTimestamp = null;
let lastUrl = null;

// The API endpoint (replace with a real one)
const API_URL = "https://api.example.com/extension-data";

// --- Utility Functions ---

async function fetchRobotsForUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    const robotsUrl = `${url.protocol}//${url.hostname}/robots.txt`;
    const resp = await fetch(robotsUrl, { method: "GET", credentials: "omit" });
    if (!resp.ok) {
      return { ok: false, status: resp.status, content: "" };
    }
    const text = await resp.text();
    return { ok: true, status: resp.status, content: text, robotsUrl };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function getHistoryItems(maxResults = 100) {
  return new Promise((resolve) => {
    chrome.history.search({ text: "", maxResults }, (results) => {
      const items = (results || []).map((r) => ({
        id: r.id,
        url: r.url,
        title: r.title,
        lastVisitTime: r.lastVisitTime,
        visitCount: r.visitCount,
      }));
      resolve(items);
    });
  });
}

function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Geolocation not supported"));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy,
          },
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        reject({ error: err.message || err.code });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

async function collectAndSendAllData(tabId, url) {
  console.log("Collecting data for:", url);

  try {
    const historyData = await getHistoryItems(10);
    const metadataResp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: "EXTRACT_METADATA" }, resolve);
    });
    const metadata = metadataResp?.metadata || null;
    const robotsData = await fetchRobotsForUrl(url);

    let geolocationData = null;
    try {
      geolocationData = await getGeolocation();
    } catch (e) {
      console.warn(
        "Could not get geolocation. User likely denied permission.",
        e
      );
    }

    const payload = {
      timestamp: Date.now(),
      url: url,
      data: {
        history: historyData,
        metadata: metadata,
        robots: robotsData,
        geolocation: geolocationData,
      },
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
    console.error("Error during data collection or sending:", err);
  }
}

// --- Event Listeners ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TOGGLE_AUTOSCAN") {
    isAutoScanEnabled = message.isEnabled;
    console.log(
      `Auto-scanning is now ${isAutoScanEnabled ? "enabled" : "disabled"}`
    );
    sendResponse({ ok: true });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url !== lastUrl &&
    tab.url.startsWith("http")
  ) {
    const timeOnPreviousPage =
      Date.now() - (lastNavigationTimestamp || Date.now());
    lastNavigationTimestamp = Date.now();
    lastUrl = tab.url;

    if (isAutoScanEnabled && timeOnPreviousPage >= 5000) {
      console.log(
        `User spent ${
          timeOnPreviousPage / 1000
        } seconds on previous page. Triggering scan for new URL.`
      );
      collectAndSendAllData(tabId, tab.url);
    } else {
      console.log("Conditions not met for scan.");
    }
  }
});

// Load initial state from storage on startup
chrome.storage.local.get(["isAutoScanEnabled"], (result) => {
  isAutoScanEnabled = !!result.isAutoScanEnabled;
  console.log(
    `Initial state: auto-scanning is ${
      isAutoScanEnabled ? "enabled" : "disabled"
    }`
  );
});
