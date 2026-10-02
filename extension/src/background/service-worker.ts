// Background Service Worker

// Keep track of the latest analysis results to pass to the popup if needed,
// or handle context menu actions. For this MVP, most logic is handled
// directly between the Popup and the Backend via the API client.

chrome.runtime.onInstalled.addListener(() => {
  console.log('SkillSync - Career Copilot Extension Installed');
});

// Example: Handling background API calls to circumvent CORS issues
// if the popup cannot directly hit the backend (though Manifest V3 
// allows fetch in popup with proper host_permissions).
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'API_CALL') {
    // We would proxy fetch calls through here if needed for cookie isolation,
    // but the API client in the popup can use credentials: 'include'.
    // Leaving this as a placeholder for background logic.
    sendResponse({ status: 'received' });
  }
});
