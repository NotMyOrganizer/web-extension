// service_worker.js
// Runs in the background (Manifest V3 service worker).

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
      // normalize
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

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message && message.type === 'GET_HISTORY') {
        const items = await getHistoryItems(message.maxResults || 200);
        sendResponse({ ok: true, items });
        return;
      }

      if (message && message.type === 'FETCH_ROBOTS') {
        const result = await fetchRobotsForUrl(message.url);
        sendResponse({ ok: true, robots: result });
        return;
      }

      // We also provide a background helper to request page metadata via scripting (if popup asks)
      if (message && message.type === 'REQUEST_META_FROM_ACTIVE_TAB') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          sendResponse({ ok: false, error: 'No active tab' });
          return;
        }
        // Ask content script directly to return metadata
        chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_METADATA' }, (resp) => {
          // sendResponse from background to caller
          sendResponse({ ok: true, metadata: resp });
        });
        return; // we'll call sendResponse asynchronously inside callback
      }

      // unknown
      sendResponse({ ok: false, error: 'unknown message type' });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  // indicates we'll call sendResponse asynchronously
  return true;
});
