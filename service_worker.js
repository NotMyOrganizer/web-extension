// service_worker.js

// --- Global State ---
let isAutoScanEnabled = false;
let lastNavigationTimestamp = null;
let lastUrl = null;

// The API endpoint (replace with a real one)
const API_URL = 'https://api.example.com/extension-data';

// --- Utility Functions ---

// Helper: fetch robots.txt for a given URL (domain)
async function fetchRobotsForUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    const robotsUrl = `${url.protocol}//${url.hostname}/robots.txt`;
    const resp = await fetch(robotsUrl, { method: 'GET', credentials: 'omit' });
    if (!resp.ok) {
      return { ok: false, status: resp.status, content: '' };
    }
    const text = await resp.text();
    return { ok: true, status: resp.status, content: text, robotsUrl };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Helper: get browser history (most recent N items)
function getHistoryItems(maxResults = 100) {
  return new Promise((resolve) => {
    chrome.history.search({ text: '', maxResults }, (results) => {
      const items = (results || []).map(r => ({
        id: r.id,
        url: r.url,
        title: r.title,
        lastVisitTime: r.lastVisitTime,
        visitCount: r.visitCount
      }));
      resolve(items);
    });
  });
}

// Helper: get geolocation (requires user prompt, so can't be done silently)
function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation not supported'));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy
          },
          timestamp: pos.timestamp
        });
      },
      (err) => {
        reject({ error: err.message || err.code });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

// --- Main Data Collection & API Sending Logic ---

async function collectAndSendAllData(tabId, url) {
  console.log('Collecting data for:', url);

  try {
    // 1. Get History (synchronously)
    const historyData = await getHistoryItems(10); // get a small number for demo

    // 2. Get Metadata (via content script)
    const metadataResp = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_METADATA' }, resolve);
    });
    const metadata = metadataResp?.metadata || null;

    // 3. Get robots.txt
    const robotsData = await fetchRobotsForUrl(url);

    // 4. Get Geolocation (NOTE: This will prompt the user, so it's not ideal for silent collection. Including for completeness as requested.)
    let geolocationData = null;
    try {
      geolocationData = await getGeolocation();
    } catch (e) {
      console.warn("Could not get geolocation. User likely denied permission.", e);
    }

    const payload = {
      timestamp: Date.now(),
      url: url,
      data: {
        history: historyData,
        metadata: metadata,
        robots: robotsData,
        geolocation: geolocationData
      }
    };

    // Send the JSON payload to the API
    console.log('Sending payload to API:', payload);
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      console.log('Data successfully sent to API.');
    } else {
      console.error('Failed to send data to API. Status:', resp.status);
    }

  } catch (err) {
    console.error('Error during data collection or sending:', err);
  }
}

// --- Event Listeners ---

// 1. Listen for the toggle from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_AUTOSCAN') {
    isAutoScanEnabled = message.isEnabled;
    console.log(`Auto-scanning is now ${isAutoScanEnabled ? 'enabled' : 'disabled'}`);
    sendResponse({ ok: true });
  }
});

// 2. Listen for URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if we have a valid URL and the user is not just updating an old tab
  if (changeInfo.status === 'complete' && tab.url && tab.url !== lastUrl && tab.url.startsWith('http')) {
    const timeOnPreviousPage = Date.now() - (lastNavigationTimestamp || Date.now());
    lastNavigationTimestamp = Date.now();
    lastUrl = tab.url;

    // Check if auto-scanning is enabled and the time on the previous page was > 10s
    if (isAutoScanEnabled && timeOnPreviousPage >= 5000) {
      console.log(`User spent ${timeOnPreviousPage / 1000} seconds on previous page. Triggering scan for new URL.`);
      collectAndSendAllData(tabId, tab.url);
    } else {
      console.log('Conditions not met for scan.');
    }
  }
});

// Initial state load
chrome.storage.local.get(['isAutoScanEnabled'], (result) => {
  isAutoScanEnabled = !!result.isAutoScanEnabled;
  console.log(`Initial state: auto-scanning is ${isAutoScanEnabled ? 'enabled' : 'disabled'}`);
});