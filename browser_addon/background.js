browser.browserAction.onClicked.addListener((tab) => {
    browser.windows.create({
        url: browser.runtime.getURL(`interface.html?tabId=${tab.id}`),
        type: "popup",
        width: 400,
        height: 600
    });
});
