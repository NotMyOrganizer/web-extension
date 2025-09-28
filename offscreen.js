chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_GEOLOCATION') {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Successfully retrieved location
        sendResponse({
          ok: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        // Failed to retrieve location
        sendResponse({
          ok: false,
          error: error.message,
        });
      }
    );
    // Return true to indicate you wish to send a response asynchronously
    return true;
  }
});