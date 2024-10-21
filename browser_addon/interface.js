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

        // Initialize array to store timestamps and labels
        let recordedData = [];

        // Variable to store the video URL
        let videoUrl = '';

        // Get the video URL
        getVideoUrl(tabId).then(url => {
            videoUrl = url;
        }).catch(error => {
            console.error("Error getting video URL:", error);
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
                    // Store the data
                    recordedData.push({
                        timestamp: timestamp,
                        labels: selectedLabels
                    });
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
            const list = document.getElementById('timestampsList');
            const listItem = document.createElement('li');

            const timestampText = formatTime(timestamp);
            listItem.textContent = `${timestampText} - Labels: ${labels.map(l => l.text).join(', ')}`;

            // Add remove button for the timestamp
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.className = 'removeButton';
            removeButton.addEventListener('click', () => {
                removeTimestamp(timestamp, listItem);
            });

            listItem.appendChild(removeButton);
            list.appendChild(listItem);
        }

        // Function to remove a timestamp
        function removeTimestamp(timestamp, listItem) {
            recordedData = recordedData.filter(item => item.timestamp !== timestamp);
            listItem.remove();
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
            if (recordedData.length === 0) {
                alert('No data to export.');
                return;
            }

            const projectName = document.getElementById('projectInput').value.trim() || 'unnamed_project';
            const urlId = getUrlId(videoUrl);
            const fileName = `${sanitizeFilename(projectName)}_${sanitizeFilename(urlId)}_timestamps.json`;

            // Prepare data for export
            const exportData = recordedData.map(item => ({
                timestamp: item.timestamp,
                timestampFormatted: formatTime(item.timestamp),
                labels: item.labels.map(l => l.text)
            }));

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
            if (recordedData.length === 0) {
                alert('No data to export.');
                return;
            }

            if (!videoUrl) {
                alert('Video URL is not available. Please try refreshing the extension.');
                return;
            }

            const projectName = document.getElementById('projectInput').value.trim() || 'unnamed_project';
            const urlId = getUrlId(videoUrl);
            const fileName = `${sanitizeFilename(projectName)}_${sanitizeFilename(urlId)}_timestamps.yaml`;

            let yamlContent = `# Project: ${projectName}\n`;

            // Create a summary of labels
            const labelCounts = {};
            recordedData.forEach(item => {
                item.labels.forEach(label => {
                    if (labelCounts[label.text]) {
                        labelCounts[label.text]++;
                    } else {
                        labelCounts[label.text] = 1;
                    }
                });
            });

            // Add summary to YAML content
            yamlContent += "# Label counts:\n";
            for (const [label, count] of Object.entries(labelCounts)) {
                yamlContent += `#   ${label}: ${count}\n`;
            }

            yamlContent += "\ncontent:\n";
            yamlContent += ` - "${videoUrl}":\n`;

            recordedData.forEach(item => {
                const maxWindow = Math.max(...item.labels.map(l => l.window));
                const startTime = Math.max(0, item.timestamp - maxWindow);
                const endTime = item.timestamp + maxWindow;

                const startFormatted = formatTime(startTime);
                const endFormatted = formatTime(endTime);

                const labelTexts = item.labels.map(l => l.text).join(' ');

                yamlContent += `   - "${startFormatted}-${endFormatted}" #${labelTexts}\n`;
            });

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
