// popup.js

const btnHistory = document.getElementById('btnHistory');
const btnMeta = document.getElementById('btnMeta');
const btnRobots = document.getElementById('btnRobots');
const btnLocation = document.getElementById('btnLocation');
const outputEl = document.getElementById('output');

function show(obj) {
  try {
    outputEl.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  } catch (e) {
    outputEl.textContent = String(obj);
  }
}

btnHistory.addEventListener('click', async () => {
  show('Loading history...');
  chrome.runtime.sendMessage({ type: 'GET_HISTORY', maxResults: 200 }, (resp) => {
    if (!resp) { show('No response (maybe permission denied)'); return; }
    if (!resp.ok) {
      show(`Error: ${resp.error || 'unknown'}`);
      return;
    }
    show(resp.items);
  });
});

btnMeta.addEventListener('click', async () => {
  show('Requesting metadata from active tab...');
  chrome.runtime.sendMessage({ type: 'REQUEST_META_FROM_ACTIVE_TAB' }, (resp) => {
    if (!resp) { show('No response (maybe content script not injected on this page)'); return; }
    if (!resp.ok) {
      show(`Error: ${resp.error || 'unknown'}`);
      return;
    }
    show(resp.metadata);
  });
});

btnRobots.addEventListener('click', async () => {
  show('Fetching robots.txt for active tab...');
  // get active tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    show('No active tab or no URL found.');
    return;
  }

  chrome.runtime.sendMessage({ type: 'FETCH_ROBOTS', url: tab.url }, (resp) => {
    if (!resp) { show('No response'); return; }
    if (!resp.ok) {
      show(`Error: ${resp.error || 'unknown'}`);
      return;
    }
    show(resp.robots);
  });
});

btnLocation.addEventListener('click', () => {
  show('Requesting geolocation (browser will prompt)...');

  if (!navigator.geolocation) {
    show('Geolocation API not supported in this browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      show({
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy
        },
        timestamp: pos.timestamp
      });
    },
    (err) => {
      show({ error: err.message || err.code });
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
});
