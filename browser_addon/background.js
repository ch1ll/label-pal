browser.browserAction.onClicked.addListener((tab) => {
    browser.windows.create({
        url: browser.runtime.getURL(`interface.html?tabId=${tab.id}`),
        type: "popup",
        width: 420,
        height: 900
    });
});
