// Privacy Lens content script.
// Supplies the currently selected page text to the popup on demand.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "GET_SELECTION") {
    const selection = window.getSelection() ? window.getSelection().toString().trim() : "";
    sendResponse({ selection });
    return false;
  }
  return false;
});