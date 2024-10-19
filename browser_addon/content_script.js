// content_script.js

// Find the video element on the page
let videoElement = document.querySelector('video');

if (videoElement) {
    // Listen for messages from the extension
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === "getCurrentTime") {
            sendResponse({ currentTime: videoElement.currentTime });
        }
    });
}
