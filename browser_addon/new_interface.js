document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    let tabId = parseInt(params.get('tabId'), 10);
    const mode = params.get('mode');

    async function getActiveTab() {
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            return tabs.length > 0 ? tabs[0].id : null;
        } catch (error) {
            console.error("Error getting active tab:", error);
            return null;
        }
    }

    if (!Number.isInteger(tabId)) {
        tabId = await getActiveTab();
        if (!tabId) {
            console.error("No active tab available.");
            return; // Early exit if no tab ID could be determined
        }
    }

    await initializeExtension(tabId);

    async function initializeExtension(tabId) {
        if (mode !== 'popup') {
            browser.runtime.sendMessage({ action: "sidebarLoaded" });
        }

        function setupCollapsibleSections() {
            const settingsToggle = document.getElementById('settingsToggle');
            const settingsSectionContent = document.getElementById('settingsSectionContent');
            const collapsibleSection = document.getElementById('settingsSection');
        
            if (settingsToggle && settingsSectionContent && collapsibleSection) {
                settingsToggle.addEventListener('click', () => {
                    const isExpanded = settingsToggle.getAttribute('aria-expanded') === 'true';
                    settingsToggle.setAttribute('aria-expanded', (!isExpanded).toString());
                    settingsSectionContent.classList.toggle('collapsed');
                    collapsibleSection.classList.toggle('active'); // Ensure this toggles the 'active' class
                });
            }
        }
        

        setupCollapsibleSections();

        let labels = [];
        const noLabelsPrompt = document.getElementById('noLabelsPrompt');

        function updateNoLabelsPrompt() {
            if (noLabelsPrompt) {
                noLabelsPrompt.classList.toggle('hidden', labels.length !== 0);
            }
        }

        updateNoLabelsPrompt();

        let recordedData = {};
        let currentVideoUrl = '';

        async function updateVideoUrl(tabId) {
            try {
                currentVideoUrl = await getVideoUrl(tabId);
                // Initialize recordedData for the new URL
                if (!recordedData[currentVideoUrl]) {
                    recordedData[currentVideoUrl] = [];
                }
                const currentVideoUrlElement = document.getElementById('currentVideoUrl');
                if (currentVideoUrlElement) {
                    currentVideoUrlElement.textContent = `Current URL: ${currentVideoUrl}`;
                    updateTimestampsList();
                } else {
                    console.warn("Element with ID 'currentVideoUrl' not found.");
                }
            } catch (error) {
                console.error("Error getting video URL:", error);
            }
        }

        await updateVideoUrl(tabId);

        browser.tabs.onUpdated.addListener((updatedTabId, changeInfo, tab) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                updateVideoUrl(tabId);
            }
        });

        const helpButton = document.getElementById('helpButton');
        if (helpButton) {
            helpButton.addEventListener('click', toggleHelpContent);
        }

        if (mode !== 'popup') {
            setupPopupSwitch(tabId);
        } else {
            const switchToPopupButton = document.getElementById('switchToPopupButton');
            if (switchToPopupButton) {
                switchToPopupButton.style.display = 'none';
            }
        }

        const recordTimestampButton = document.getElementById('recordTimestampButton');
        if (recordTimestampButton) {
            recordTimestampButton.addEventListener('click', recordTimestamp);
        }

        const addLabelButton = document.getElementById('addLabelButton');
        if (addLabelButton) {
            addLabelButton.addEventListener('click', addLabel);
        }

        function toggleHelpContent() {
            const helpContent = document.getElementById('helpContent');
            if (helpContent) {
                const isHidden = helpContent.classList.toggle('hidden');
                helpButton.setAttribute('aria-expanded', (!isHidden).toString());
            }
        }

        function setupPopupSwitch(tabId) {
            const button = document.getElementById('switchToPopupButton');
            if (button) {
                button.addEventListener('click', () => {
                    browser.runtime.sendMessage({ action: "openPopup", tabId });
                    if (browser.sidebarAction) {
                        browser.sidebarAction.close();
                    }
                });
            }
        }

        async function recordTimestamp() {
            const selectedLabels = getSelectedLabels();
            if (selectedLabels.length === 0) {
                alert("Please select at least one label before recording a timestamp.");
                return;
            }

            try {
                const response = await browser.tabs.sendMessage(tabId, { type: "getCurrentTime" });
                if (response && response.currentTime != null) {
                    const timestamp = response.currentTime;
                    addTimestampToList(timestamp, selectedLabels);
                } else {
                    alert("No video element found on the page.");
                }
            } catch (error) {
                console.error("Error sending message to content script:", error);
                alert("Error: Unable to get current video time. Make sure you're on a page with a video playing.");
            }
        }

        function getSelectedLabels() {
            return Array.from(document.querySelectorAll('#labelsList input[type="checkbox"]:checked'))
                .map(checkbox => labels.find(label => label.text === checkbox.value))
                .filter(Boolean);
        }

        function addLabel() {
            const newLabelInput = document.getElementById('newLabelInput');
            const newLabelWindow = document.getElementById('newLabelWindow');
            const newLabel = newLabelInput.value.trim();
            const windowValue = parseInt(newLabelWindow.value, 10);

            if (newLabel && !isNaN(windowValue) && windowValue > 0) {
                if (labels.some(label => label.text === newLabel)) {
                    alert('Label already exists.');
                    return;
                }

                const newLabelObj = { text: newLabel, window: windowValue };
                labels.push(newLabelObj);
                updateLabelsList();
                newLabelInput.value = '';
                newLabelWindow.value = '';
                updateNoLabelsPrompt();
            } else {
                alert('Please enter a valid label and a positive integer for the window.');
            }
        }

        function updateLabelsList() {
            const labelsList = document.getElementById('labelsList');
            if (labelsList) {
                labelsList.innerHTML = '';

                labels.forEach(label => {
                    const listItem = document.createElement('li');

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = label.text;

                    const labelNode = document.createElement('label');
                    labelNode.appendChild(checkbox);
                    labelNode.append(` ${label.text} (Window: ${label.window}s)`);

                    listItem.appendChild(labelNode);

                    const removeButton = document.createElement('button');
                    removeButton.textContent = 'Remove';
                    removeButton.className = 'removeButton';
                    removeButton.onclick = () => {
                        labels = labels.filter(l => l.text !== label.text);
                        updateLabelsList();
                        updateNoLabelsPrompt();
                    };

                    listItem.appendChild(removeButton);
                    labelsList.appendChild(listItem);
                });
            }
        }

        function addTimestampToList(timestamp, selectedLabels) {
            // Initialize if not already
            if (!recordedData[currentVideoUrl]) {
                recordedData[currentVideoUrl] = [];
            }
            const dataEntry = { timestamp, labels: selectedLabels.map(l => l.text) };
            recordedData[currentVideoUrl].push(dataEntry);
            updateTimestampsList();
        }

        function updateTimestampsList() {
            const list = document.getElementById('timestampsList');
            if (list) {
                list.innerHTML = '';

                const entries = recordedData[currentVideoUrl] || [];
                entries.forEach((item, index) => {
                    const listItem = document.createElement('li');

                    const timestampText = document.createTextNode(`${item.timestamp} - Labels: ${item.labels.join(', ')}`);

                    const removeButton = document.createElement('button');
                    removeButton.textContent = 'Remove';
                    removeButton.className = 'removeButton';
                    removeButton.onclick = () => {
                        recordedData[currentVideoUrl].splice(index, 1);
                        updateTimestampsList();
                    };

                    listItem.appendChild(timestampText);
                    listItem.appendChild(removeButton);
                    list.appendChild(listItem);
                });
            }
        }

        async function getVideoUrl(tabId) {
            try {
                const tab = await browser.tabs.get(tabId);
                return tab.url;
            } catch (error) {
                console.error("Unable to get the tab URL", error);
                return null;
            }
        }
    }
});
