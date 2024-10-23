// content_script.js
console.log("Content script loaded");

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received in content script:", message);
    
    if (message.type === "getCurrentTime") {
        console.log("Attempting to get current time");
        const videoElement = document.querySelector('video');
        
        if (videoElement) {
            console.log("Video element found");
            const currentTime = videoElement.currentTime;
            console.log("Current time:", currentTime);
            sendResponse({ currentTime: currentTime });
        } else {
            console.log("No video element found");
            sendResponse({ error: "No video element found" });
        }
    }
    
    return true; // Indicates that the response will be sent asynchronously
});

console.log("Content script setup complete");