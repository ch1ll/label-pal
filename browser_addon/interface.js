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
                    collapsibleSection.classList.toggle('active');
                });
            }
        }

        setupCollapsibleSections();

        let labels = [];
        let recordedData = {};
        let currentVideoUrl = '';

        // Get the noLabelsPrompt element before using it
        const noLabelsPrompt = document.getElementById('noLabelsPrompt');

        // Load data from storage
        await loadDataFromStorage();

        // Update video URL and ensure recordedData is ready
        await updateVideoUrl(tabId);

        // Update UI elements
        updateLabelsList();
        updateNoLabelsPrompt();
        updateTimestampsList();

        function updateNoLabelsPrompt() {
            if (noLabelsPrompt) {
                noLabelsPrompt.classList.toggle('hidden', labels.length !== 0);
            }
        }

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

        // Add event listeners for export buttons
        const exportJSONButton = document.getElementById('exportJSONButton');
        if (exportJSONButton) {
            exportJSONButton.addEventListener('click', exportDataToJson);
        }

        const exportYAMLButton = document.getElementById('exportYAMLButton');
        if (exportYAMLButton) {
            exportYAMLButton.addEventListener('click', exportDataToYaml);
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

                // Save labels to storage
                saveLabelsToStorage();
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
                    checkbox.id = `label_${label.text}`;

                    const labelNode = document.createElement('label');
                    labelNode.htmlFor = `label_${label.text}`;
                    labelNode.appendChild(checkbox);
                    labelNode.append(` ${label.text} (Window: ${label.window}s)`);

                    listItem.appendChild(labelNode);

                    const removeButton = document.createElement('button');
                    removeButton.textContent = 'X';
                    removeButton.className = 'removeButton';
                    removeButton.onclick = () => {
                        labels = labels.filter(l => l.text !== label.text);
                        updateLabelsList();
                        updateNoLabelsPrompt();

                        // Save labels to storage
                        saveLabelsToStorage();
                    };

                    listItem.appendChild(removeButton);
                    labelsList.appendChild(listItem);
                });
            }
        }

        function addTimestampToList(timestamp, selectedLabels) {
            if (!recordedData[currentVideoUrl]) {
                recordedData[currentVideoUrl] = [];
            }
            const dataEntry = { timestamp, labels: selectedLabels };
            recordedData[currentVideoUrl].push(dataEntry);
            updateTimestampsList();

            // Save recorded data to storage
            saveRecordedDataToStorage();
        }

        function updateTimestampsList() {
            const list = document.getElementById('timestampsList');
            if (list) {
                list.innerHTML = '';

                const entries = recordedData[currentVideoUrl] || [];
                if (entries.length > 0) {
                    const urlHeader = document.createElement('a');
                    urlHeader.href = currentVideoUrl;
                    urlHeader.textContent = `${currentVideoUrl}`;
                    list.appendChild(urlHeader);
                    entries.forEach((item, index) => {
                        const listItem = document.createElement('li');
                        const timestampText = formatTime(item.timestamp);
                        listItem.textContent = `${timestampText} - Labels: ${item.labels.map(l => l.text).join(', ')}`;

                        const removeButton = document.createElement('button');
                        removeButton.textContent = 'X';
                        removeButton.className = 'removeButton';
                        removeButton.onclick = () => {
                            recordedData[currentVideoUrl].splice(index, 1);
                            updateTimestampsList();

                            // Save recorded data to storage
                            saveRecordedDataToStorage();
                        };

                        listItem.appendChild(removeButton);
                        list.appendChild(listItem);
                    });
                } else {
                    const noTimestampsMessage = document.createElement('p');
                    noTimestampsMessage.textContent = 'No timestamps recorded for this URL yet.';
                    list.appendChild(noTimestampsMessage);
                }
            }
        }

        function formatTime(seconds) {
            const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
            const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
            const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
            return `${hrs}:${mins}:${secs}`;
        }

        function getUrlId(url) {
            try {
                const urlObj = new URL(url);
                let urlId;

                if (urlObj.hostname.includes('youtube.com')) {
                    urlId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
                } else if (urlObj.hostname.includes('twitch.tv')) {
                    urlId = urlObj.pathname.split('/').pop();
                } else {
                    urlId = urlObj.pathname.split('/').pop();
                }

                return urlId || urlObj.hostname;
            } catch (error) {
                console.error("Error parsing URL:", error);
                return 'unknown';
            }
        }

        function sanitizeFilename(name) {
            return name.replace(/[^a-z0-9]/gi, '_');
        }

        function exportDataToJson() {
            if (Object.keys(recordedData).length === 0) {
                alert('No data to export.');
                return;
            }

            const projectName = document.getElementById('projectInput').value.trim() || 'unnamed_project';
            const fileName = `${sanitizeFilename(projectName)}_timestamps.json`;

            const exportData = {};
            for (const [url, data] of Object.entries(recordedData)) {
                exportData[url] = data.map(item => ({
                    timestamp: item.timestamp,
                    timestampFormatted: formatTime(item.timestamp),
                    labels: item.labels.map(l => l.text)
                }));
            }

            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();

            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function exportDataToYaml() {
            if (Object.keys(recordedData).length === 0) {
                alert('No data to export.');
                return;
            }

            const projectName = document.getElementById('projectInput').value.trim() || 'unnamed_project';
            const fileName = `${sanitizeFilename(projectName)}_timestamps.yaml`;

            let yamlContent = `# Project: ${projectName}\n`;

            const labelCounts = {};
            for (const data of Object.values(recordedData)) {
                data.forEach(item => {
                    item.labels.forEach(label => {
                        if (labelCounts[label.text]) {
                            labelCounts[label.text]++;
                        } else {
                            labelCounts[label.text] = 1;
                        }
                    });
                });
            }

            yamlContent += "# Label counts:\n";
            for (const [label, count] of Object.entries(labelCounts)) {
                yamlContent += `#   ${label}: ${count}\n`;
            }

            yamlContent += "\ncontent:\n";
            for (const [url, data] of Object.entries(recordedData)) {
                yamlContent += ` - "${url}":\n`;
                data.forEach(item => {
                    const maxWindow = Math.max(...item.labels.map(l => l.window));
                    const startTime = Math.max(0, item.timestamp - maxWindow);
                    const endTime = item.timestamp + maxWindow;

                    const startFormatted = formatTime(startTime);
                    const endFormatted = formatTime(endTime);

                    const labelTexts = item.labels.map(l => l.text).join(' ');

                    yamlContent += `   - "${startFormatted}-${endFormatted}" #${labelTexts}\n`;
                });
            }

            const blob = new Blob([yamlContent], { type: 'text/yaml' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();

            document.body.removeChild(a);
            URL.revokeObjectURL(url);
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

        async function updateVideoUrl(tabId) {
            try {
                currentVideoUrl = await getVideoUrl(tabId);
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

        // Data persistence functions
        async function loadDataFromStorage() {
            try {
                const storageData = await browser.storage.local.get(['labels', 'recordedData']);
                if (storageData.labels) {
                    labels = storageData.labels;
                }
                if (storageData.recordedData) {
                    recordedData = storageData.recordedData;
                }
            } catch (error) {
                console.error("Error loading data from storage:", error);
            }
        }

        async function saveLabelsToStorage() {
            try {
                await browser.storage.local.set({ labels });
            } catch (error) {
                console.error("Error saving labels to storage:", error);
            }
        }

        async function saveRecordedDataToStorage() {
            try {
                await browser.storage.local.set({ recordedData });
            } catch (error) {
                console.error("Error saving recorded data to storage:", error);
            }
        }
    }
});
