
// content.js
let reactions = { laugh: [], scream: [], both: [] };

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "recordTimestamp") {
    let video = document.querySelector('video');
    if (video) {
      let currentTime = video.currentTime;
      let formattedTime = formatTime(currentTime);
      reactions[request.reactionType].push(formattedTime);
      browser.runtime.sendMessage({action: "updateTimestamps", reactions: reactions});
    }
  } else if (request.action === "updateReactions") {
    reactions = request.reactions;
  }
});

function formatTime(seconds) {
  let date = new Date(null);
  date.setSeconds(seconds);
  return date.toISOString().substr(11, 8);
}

// Initialize reactions from storage when content script loads
browser.storage.local.get(null).then((result) => {
  let tabId = browser.runtime.sendMessage({action: "getTabId"});
  if (result[tabId]) {
    reactions = result[tabId];
  }
});