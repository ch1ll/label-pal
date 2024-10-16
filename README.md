# How to Load a Temporary Add-on in Firefox

Follow these steps to load a temporary add-on in Firefox:

1. Open Firefox browser.

2. In the URL bar, enter the following: `about:debugging#/runtime/this-firefox`

3. Press Enter to navigate to the debugging page.

4. On the left sidebar, ensure "This Firefox" is selected.

5. In the main content area, locate the "Temporary Extensions" section.

6. Click the "Load Temporary Add-on" button.

7. In the file browser that opens, navigate to the unzipped directory of your add-on.

8. Select any file within that directory, typically `manifest.json`.

9. Click "Open" to load the add-on.

## Tips

- For easier access to your newly loaded add-on, consider pinning it to the Firefox toolbar:
1. Click the menu button (☰) in the top-right corner of Firefox.
2. Find your add-on in the list.
3. Click the "Pin to Toolbar" option next to it.

- Remember that temporary add-ons will be removed when you close Firefox. You'll need to load them again the next time you start the browser.

- This method is particularly useful for testing and developing add-ons before publishing them to the Firefox Add-ons store.