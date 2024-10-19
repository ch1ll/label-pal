document.addEventListener('DOMContentLoaded', () => {
    // Get the tabId from the URL parameters
    const params = new URLSearchParams(window.location.search);
    const tabId = parseInt(params.get('tabId'));

    // Initialize labels array
    let labels = [];

    // Initialize array to store timestamps and labels
    let recordedData = [];

    // Add event listener to the Record Timestamp button
    document.getElementById('recordTimestampButton').addEventListener('click', () => {
        // Get selected labels
        const selectedLabels = getSelectedLabels();

        // Send a message to the content script to get the current video time
        browser.tabs.sendMessage(tabId, { type: "getCurrentTime" }).then(response => {
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
        }).catch(error => {
            console.error("Error sending message to content script:", error);
        });
    });

    // Add event listener to the Add Label button
    document.getElementById('addLabelButton').addEventListener('click', () => {
        const newLabelInput = document.getElementById('newLabelInput');
        const newLabel = newLabelInput.value.trim();
        if (newLabel) {
            addLabel(newLabel);
            newLabelInput.value = '';
        }
    });

    // Add event listener to the Export to JSON button
    document.getElementById('exportButton').addEventListener('click', () => {
        exportDataToJson();
    });

    // Function to add a new label
    function addLabel(labelText) {
        // Avoid duplicate labels
        if (labels.includes(labelText)) {
            alert('Label already exists.');
            return;
        }
        labels.push(labelText);

        const labelsList = document.getElementById('labelsList');

        const listItem = document.createElement('li');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = labelText;
        checkbox.id = `label_${labelText}`;

        const label = document.createElement('label');
        label.htmlFor = `label_${labelText}`;
        label.textContent = labelText;

        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.className = 'removeLabelButton';
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
        labels = labels.filter(label => label !== labelText);
        listItem.remove();
    }

    // Function to get selected labels
    function getSelectedLabels() {
        const selected = [];
        const checkboxes = document.querySelectorAll('#labelsList input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            selected.push(checkbox.value);
        });
        return selected;
    }

    // Function to add a timestamp to the list
    function addTimestampToList(timestamp, labels) {
        const list = document.getElementById('timestampsList');
        const listItem = document.createElement('li');

        const timestampText = formatTime(timestamp);
        listItem.textContent = `${timestampText}`;

        if (labels.length > 0) {
            listItem.textContent += ` - Labels: ${labels.join(', ')}`;
        }

        list.appendChild(listItem);
    }

    // Function to format time in HH:MM:SS
    function formatTime(seconds) {
        const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    }

    // Function to export data to JSON
    function exportDataToJson() {
        if (recordedData.length === 0) {
            alert('No data to export.');
            return;
        }

        // Prepare data for export
        const exportData = recordedData.map(item => ({
            timestamp: item.timestamp,
            timestampFormatted: formatTime(item.timestamp),
            labels: item.labels
        }));

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Create a temporary link to trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'timestamps.json';
        document.body.appendChild(a);
        a.click();

        // Clean up
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});
