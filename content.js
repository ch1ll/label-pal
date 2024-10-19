let reactions = {};

function getBrowserAPI() {
  return typeof browser !== 'undefined' ? browser : chrome;
}

getBrowserAPI().runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Content script received message:', request);
  if (request.action === "recordTimestamp") {
    let video = document.querySelector('video');
    if (video) {
      let currentTime = video.currentTime;
      let formattedTime = formatTime(currentTime);
      if (!reactions[request.reactionType]) {
        reactions[request.reactionType] = [];
      }
      reactions[request.reactionType].push({
        timestamp: formattedTime,
        formData: request.formData || {}
      });
      getBrowserAPI().runtime.sendMessage({ action: "updateTimestamps", reactions: reactions });
      console.log('Timestamp recorded:', formattedTime, request.formData);
    } else {
      console.log('No video element found on the page');
    }
  } else if (request.action === "updateReactions") {
    reactions = request.reactions;
    console.log('Reactions updated:', reactions);
  }
});

function formatTime(seconds) {
  let date = new Date(null);
  date.setSeconds(seconds);
  return date.toISOString().substr(11, 8);
}

console.log('Timestamp Recorder content script loaded');