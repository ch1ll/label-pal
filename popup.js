// popup.js
let reactions = { laugh: [], scream: [], both: [] };
let currentTabId = null;

function recordReaction(type) {
  browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
    browser.tabs.sendMessage(tabs[0].id, {action: "recordTimestamp", reactionType: type});
  });
}

document.getElementById('laughButton').addEventListener('click', () => recordReaction('laugh'));
document.getElementById('screamButton').addEventListener('click', () => recordReaction('scream'));
document.getElementById('bothButton').addEventListener('click', () => recordReaction('both'));

document.getElementById('exportTimestamps').addEventListener('click', function() {
  browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
    let url = new URL(tabs[0].url);
    let filename = generateFilename(url);
    
    let dataToExport = {
      source: url.toString(),
      reactions: reactions
    };
    
    let dataStr = JSON.stringify(dataToExport, null, 2);
    let dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    let linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', filename);
    linkElement.click();
  });
});

function generateFilename(url) {
  if (url.hostname.includes('youtube.com')) {
    let videoId = new URLSearchParams(url.search).get('v');
    return `timestamps_youtube_${videoId}.json`;
  } else if (url.hostname.includes('twitch.tv')) {
    let pathParts = url.pathname.split('/');
    let videoId = pathParts[pathParts.length - 1];
    return `timestamps_twitch_${videoId}.json`;
  } else {
    // Default case if neither YouTube nor Twitch
    return `timestamps_${url.hostname}_${Date.now()}.json`;
  }
}

function removeTimestamp(type, index) {
  reactions[type].splice(index, 1);
  saveReactions();
  updateTimestampDisplay();
  
  // Send updated reactions to content script
  browser.tabs.sendMessage(currentTabId, {action: "updateReactions", reactions: reactions});
}

// Add event listeners for timestamp removal
document.getElementById('timestampColumns').addEventListener('click', function(e) {
  if (e.target.classList.contains('remove-btn')) {
    const type = e.target.getAttribute('data-type');
    const index = parseInt(e.target.getAttribute('data-index'));
    removeTimestamp(type, index);
  }
});

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "updateTimestamps") {
    reactions = request.reactions;
    saveReactions();
    updateTimestampDisplay();
  }
});

function updateTimestampDisplay() {
  for (let type in reactions) {
    let columnElement = document.getElementById(`${type}Column`);
    let headerElement = columnElement.querySelector('h3');
    let timestampsElement = document.getElementById(`${type}Timestamps`);
    
    if (reactions[type].length > 0) {
      headerElement.classList.remove('hidden');
      timestampsElement.innerHTML = reactions[type].map((t, index) => 
        `<div class="timestamp-entry">
           <span>${t}</span>
           <span class="remove-btn" data-type="${type}" data-index="${index}">X</span>
         </div>`
      ).join('');
    } else {
      headerElement.classList.add('hidden');
      timestampsElement.innerHTML = '';
    }
  }
}

function saveReactions() {
  let data = {};
  data[currentTabId] = reactions;
  browser.storage.local.set(data);
}

function loadReactions() {
  browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
    currentTabId = tabs[0].id;
    browser.storage.local.get(currentTabId.toString()).then((result) => {
      if (result[currentTabId]) {
        reactions = result[currentTabId];
      } else {
        reactions = { laugh: [], scream: [], both: [] };
      }
      updateTimestampDisplay();
      
      // Send loaded reactions to content script
      browser.tabs.sendMessage(currentTabId, {action: "updateReactions", reactions: reactions});
    });
  });
}

// Load saved reactions when popup opens
loadReactions();