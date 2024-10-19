function openWindow() {
  const createData = {
    type: 'popup',
    url: 'draggable-window.html',
    width: 350,
    height: 500
  };
  
  if (typeof browser !== 'undefined' && browser.windows) {
    browser.windows.create(createData);
  } else if (typeof chrome !== 'undefined' && chrome.windows) {
    chrome.windows.create(createData);
  }
}

function addBrowserActionListener() {
  if (typeof browser !== 'undefined' && browser.browserAction) {
    browser.browserAction.onClicked.addListener(openWindow);
  } else if (typeof chrome !== 'undefined' && chrome.action) {
    chrome.action.onClicked.addListener(openWindow);
  }
}

addBrowserActionListener();

function handleMessage(request, sender, sendResponse) {
  if (request.action === "recordTimestamp") {
    if (typeof browser !== 'undefined' && browser.tabs) {
      browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          browser.tabs.sendMessage(tabs[0].id, request);
        }
      });
    } else if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, request);
        }
      });
    }
  } else if (request.action === "updateTimestamps") {
    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.sendMessage(request);
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(request);
    }
  }
}

if (typeof browser !== 'undefined' && browser.runtime) {
  browser.runtime.onMessage.addListener(handleMessage);
} else if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener(handleMessage);
}