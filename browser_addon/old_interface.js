document.addEventListener('DOMContentLoaded', () => {
    // Get the tabId and mode from the URL parameters
    const params = new URLSearchParams(window.location.search);
    let tabId = parseInt(params.get('tabId'));
    const mode = params.get('mode');

    if (isNaN(tabId)) {
        // Get the current active tab
        browser.tabs.query({ active: true, currentWindow: true })
        .then((tabs) => {
            if (tabs.length > 0) {
                tabId = tabs[0].id;
                initializeExtension(tabId);
            } else {
                console.error("No active tab found.");
            }
        })
        .catch((error) => {
            console.error("Error getting active tab:", error);
        });
    } else {
        initializeExtension(tabId);
    }

    function initializeExtension(tabId) {
        // Notify background script that sidebar is loaded
        if (mode !== 'popup') {
            browser.runtime.sendMessage({ action: "sidebarLoaded" });
        }

        // Initialize labels array
        let labels = [];

        // Initialize object to store timestamps and labels grouped by URL
        let recordedData = {};

        // Variable to store the current video URL
        let currentVideoUrl = '';

        // Function to update the current video URL
        function updateVideoUrl(tabId) {
            getVideoUrl(tabId).then(url => {
                currentVideoUrl = url;
                if (!recordedData[currentVideoUrl]) {
                    recordedData[currentVideoUrl] = [];
                }
                document.getElementById('currentVideoUrl').textContent = `Current URL: ${currentVideoUrl}`;
                updateTimestampsList();
            }).catch(error => {
                console.error("Error getting video URL:", error);
            });
        }

        // Initial update of video URL
        updateVideoUrl(tabId);

        // Listen for tab updates to refresh the video URL
        browser.tabs.onUpdated.addListener((updatedTabId, changeInfo, tab) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                updateVideoUrl(tabId);
            }
        });

        // Add event listener for the help button
        const helpButton = document.getElementById('helpButton');
        const helpContent = document.getElementById('helpContent');

        helpButton.addEventListener('click', () => {
            helpContent.classList.toggle('hidden');
            helpButton.setAttribute('aria-expanded', helpContent.classList.contains('hidden') ? 'false' : 'true');
        });

        // Add event listener for the switch to pop-up button
        const switchToPopupButton = document.getElementById('switchToPopupButton');
        if (mode !== 'popup') {
            switchToPopupButton.addEventListener('click', () => {
                browser.runtime.sendMessage({
                    action: "openPopup",
                    tabId: tabId
                });
                // Close the sidebar if in sidebar mode
                if (browser.sidebarAction) {
                    browser.sidebarAction.close();
                }
            });
        } else {
            // Hide the button if already in pop-up mode
            switchToPopupButton.style.display = 'none';
        }

        // Add event listener to the Record Timestamp button
        document.getElementById('recordTimestampButton').addEventListener('click', () => {
            // Get selected labels
            const selectedLabels = getSelectedLabels();

            // Check if any labels are selected
            if (selectedLabels.length === 0) {
                alert("Please select at least one label before recording a timestamp.");
                return;
            }

            // Send a message to the content script to get the current video time
            browser.tabs.sendMessage(tabId, { type: "getCurrentTime" })
            .then(response => {
                if (response && response.currentTime != null) {
                    const timestamp = response.currentTime;
                    // Add the timestamp to the list with associated labels
                    addTimestampToList(timestamp, selectedLabels);
                } else {
                    alert("No video element found on the page.");
                }
            })
            .catch(error => {
                console.error("Error sending message to content script:", error);
                alert("Error: Unable to get current video time. Make sure you're on a page with a video playing.");
            });    
        });

        // Add event listener to the Add Label button
        document.getElementById('addLabelButton').addEventListener('click', () => {
            const newLabelInput = document.getElementById('newLabelInput');
            const newLabelWindow = document.getElementById('newLabelWindow');
            const newLabel = newLabelInput.value.trim();
            const windowValue = parseInt(newLabelWindow.value);

            if (newLabel && !isNaN(windowValue) && windowValue > 0) {
                addLabel(newLabel, windowValue);
                newLabelInput.value = '';
                newLabelWindow.value = '';
            } else {
                alert('Please enter a valid label and a positive integer for the window.');
            }
        });

        // Add event listener to the Export to JSON button
        document.getElementById('exportJSONButton').addEventListener('click', () => {
            exportDataToJson();
        });

        // Add event listener to the Export to YAML button
        document.getElementById('exportYAMLButton').addEventListener('click', () => {
            exportDataToYaml();
        });

        // Add collapsible functionality
        const settingsSection = document.getElementById('settingsSection');
        const settingsSectionContent = document.getElementById('settingsSectionContent');

        settingsSection.addEventListener('click', (event) => {
            // Prevent the click event from propagating to child elements
            if (event.target === settingsSection || event.target === settingsSection.querySelector('h2')) {
                settingsSection.classList.toggle('active');
                settingsSectionContent.classList.toggle('active');
            }
        });

        // Function to add a new label
        function addLabel(labelText, windowValue) {
            // Avoid duplicate labels
            if (labels.some(label => label.text === labelText)) {
                alert('Label already exists.');
                return;
            }
            labels.push({ text: labelText, window: windowValue });

            const labelsList = document.getElementById('labelsList');

            const listItem = document.createElement('li');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = labelText;
            checkbox.id = `label_${labelText}`;

            const label = document.createElement('label');
            label.htmlFor = `label_${labelText}`;
            label.textContent = `${labelText} (Window: ${windowValue}s)`;

            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.className = 'removeButton';
            removeButton.addEventListener('click', () => {
                removeLabel(labelText, listItem);
            });

            listItem.appendChild(checkbox);
            listItem.appendChild(label);
            listItem.appendChild(removeButton);
            labelsList.appendChild(listItem);
        }

        // Function to remove a label
        function removeLabel(labelText, listItem) {
            labels = labels.filter(label => label.text !== labelText);
            listItem.remove();
        }

        // Function to get selected labels
        function getSelectedLabels() {
            const selected = [];
            const checkboxes = document.querySelectorAll('#labelsList input[type="checkbox"]:checked');
            checkboxes.forEach(checkbox => {
                const label = labels.find(l => l.text === checkbox.value);
                if (label) {
                    selected.push(label);
                }
            });
            return selected;
        }

        // Function to add a timestamp to the list
        function addTimestampToList(timestamp, labels) {
            if (!recordedData[currentVideoUrl]) {
                recordedData[currentVideoUrl] = [];
            }
            recordedData[currentVideoUrl].push({
                timestamp: timestamp,
                labels: labels
            });
            updateTimestampsList();
        }

        // Function to update the timestamps list in the UI
        function updateTimestampsList() {
            const list = document.getElementById('timestampsList');
            list.innerHTML = ''; // Clear the list

            if (recordedData[currentVideoUrl] && recordedData[currentVideoUrl].length > 0) {
                const urlHeader = document.createElement('h3');
                urlHeader.textContent = `Timestamps for: ${currentVideoUrl}`;
                list.appendChild(urlHeader);

                recordedData[currentVideoUrl].forEach((item, index) => {
                    const listItem = document.createElement('li');
                    const timestampText = formatTime(item.timestamp);
                    listItem.textContent = `${timestampText} - Labels: ${item.labels.map(l => l.text).join(', ')}`;

                    const removeButton = document.createElement('button');
                    removeButton.textContent = 'Remove';
                    removeButton.className = 'removeButton';
                    removeButton.addEventListener('click', () => {
                        removeTimestamp(currentVideoUrl, index);
                    });

                    listItem.appendChild(removeButton);
                    list.appendChild(listItem);
                });
            } else {
                const noTimestampsMessage = document.createElement('p');
                noTimestampsMessage.textContent = 'No timestamps recorded for this URL yet.';
                list.appendChild(noTimestampsMessage);
            }
        }

        // Function to remove a timestamp
        function removeTimestamp(url, index) {
            if (recordedData[url]) {
                recordedData[url].splice(index, 1);
                updateTimestampsList();
            }
        }

        // Function to format time in HH:MM:SS
        function formatTime(seconds) {
            const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
            const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
            const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
            return `${hrs}:${mins}:${secs}`;
        }

        // Function to get the URL ID
        function getUrlId(url) {
            try {
                const urlObj = new URL(url);
                let urlId;

                if (urlObj.hostname.includes('youtube.com')) {
                    // For YouTube URLs
                    urlId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
                } else if (urlObj.hostname.includes('twitch.tv')) {
                    // For Twitch URLs
                    urlId = urlObj.pathname.split('/').pop();
                } else {
                    // For other URLs, use the last part of the pathname
                    urlId = urlObj.pathname.split('/').pop();
                }

                // If urlId is empty, use the hostname
                return urlId || urlObj.hostname;
            } catch (error) {
                console.error("Error parsing URL:", error);
                return 'unknown';
            }
        }

        // Function to sanitize filename
        function sanitizeFilename(name) {
            return name.replace(/[^a-z0-9]/gi, '_');
        }

        // Function to export data to JSON
        function exportDataToJson() {
            if (Object.keys(recordedData).length === 0) {
                alert('No data to export.');
                return;
            }

            const projectName = document.getElementById('projectInput').value.trim() || 'unnamed_project';
            const fileName = `${sanitizeFilename(projectName)}_timestamps.json`;

            // Prepare data for export
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

            // Create a temporary link to trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();

            // Clean up
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // Function to export data to YAML
        function exportDataToYaml() {
            if (Object.keys(recordedData).length === 0) {
                alert('No data to export.');
                return;
            }

            const projectName = document.getElementById('projectInput').value.trim() || 'unnamed_project';
            const fileName = `${sanitizeFilename(projectName)}_timestamps.yaml`;

            let yamlContent = `# Project: ${projectName}\n`;

            // Create a summary of labels across all URLs
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

            // Add summary to YAML content
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

            // Create a temporary link to trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();

            // Clean up
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // Function to get video URL
        function getVideoUrl(tabId) {
            return new Promise((resolve, reject) => {
                browser.tabs.get(tabId).then(tab => {
                    if (tab && tab.url) {
                        resolve(tab.url);
                    } else {
                        reject(new Error("Unable to get the tab URL"));
                    }
                }).catch(error => {
                    reject(error);
                });
            });
        }
    }
});