let reactions = {};

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "recordTimestamp") {
    let video = document.querySelector('video');
    if (video) {
      let currentTime = video.currentTime;
      let formattedTime = formatTime(currentTime);
      if (!reactions[request.reactionType]) {
        reactions[request.reactionType] = [];
      }
      reactions[request.reactionType].push(formattedTime);
      browser.runtime.sendMessage({ action: "updateTimestamps", reactions: reactions });
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
