let sidebarOpen = false;

browser.browserAction.onClicked.addListener((tab) => {
    if (sidebarOpen) {
        browser.sidebarAction.close();
        sidebarOpen = false;
    } else {
        browser.sidebarAction.open();
        sidebarOpen = true;
        setSidebarSize();
    }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openPopup") {
        browser.windows.create({
            url: browser.runtime.getURL(`interface.html?tabId=${message.tabId}&mode=popup`),
            type: "popup",
            width: 420,
            height: 900
        });
    } else if (message.action === "sidebarLoaded") {
        setSidebarSize();
    }
});

function setSidebarSize() {
    const desiredWidth = 350;
    
    if (browser.sidebarAction && browser.sidebarAction.setWidth) {
        // currently this doesn't work with FF :(
        // Firefox
        browser.sidebarAction.setWidth({width: desiredWidth});
    } else if (browser.windows && browser.windows.getCurrent) {
        // Chrome and other browsers
        browser.windows.getCurrent({populate: true}).then((window) => {
            const sidebar = window.tabs.find(tab => tab.url.includes(browser.runtime.getURL("interface.html")));
            if (sidebar) {
                browser.windows.update(sidebar.windowId, {width: desiredWidth});
            }
        });
    }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openPopup") {
        browser.windows.create({
            url: browser.runtime.getURL(`interface.html?tabId=${message.tabId}&mode=popup`),
            type: "popup",
            width: 420,
            height: 900
        }).then((popupWindow) => {
            // Send the state to the newly created popup
            browser.tabs.sendMessage(popupWindow.tabs[0].id, {
                action: "setState",
                state: message.state
            });
        });
    }
});