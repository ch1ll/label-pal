document.addEventListener('DOMContentLoaded', async function() {
  console.log('DOMContentLoaded event fired');

  // Create an instance of SchemaManager
  const schemaManager = new SchemaManager();

  let reactions = {};
  let currentTabId = null;
  let selectedSchemaText = null;

  const schemaTextarea = document.getElementById('schemaTextarea');
  const loadSchemaButton = document.getElementById('loadSchemaButton');
  const toggleSchemaButton = document.getElementById('toggleSchemaButton');
  const schemaSection = document.getElementById('schemaSection');

  toggleSchemaButton.addEventListener('click', function() {
    schemaSection.classList.toggle('visible');
    toggleSchemaButton.textContent = schemaSection.classList.contains('visible') ? 'Hide Schema' : 'Schema';
  });

  loadSchemaButton.addEventListener('click', async function() {
    console.log('Load Schema button clicked');
    selectedSchemaText = schemaTextarea.value.trim();
    if (selectedSchemaText) {
      try {
        console.log('Attempting to load schema...');
        await schemaManager.loadSchemaFromString(selectedSchemaText);
        console.log('Schema loaded successfully');
  
        // Validate the schema structure
        if (!schemaManager.currentSchema.labels || !Array.isArray(schemaManager.currentSchema.labels)) {
          throw new Error('Schema must contain a "labels" array.');
        }
  
        // Clear existing timestamp data
        clearExistingData();
        
        updateLabelButtons();
        console.log('UI updated with new schema');
        //alert('Schema loaded successfully!');
        
        // Hide schema section after successful load
        schemaSection.classList.remove('visible');
        toggleSchemaButton.textContent = 'Schema';
      } catch (error) {
        console.error('Failed to load schema:', error);
        alert('Failed to load schema. Please check the JSON format and structure.' + error);
      }
    } else {
      console.log('No schema input provided');
      alert('Please paste or type the schema JSON before loading.');
    }
  });

  document.getElementById('exportTimestamps').addEventListener('click', exportTimestamps);

  // Add event listeners for timestamp removal
  document.getElementById('timestampColumns').addEventListener('click', function(e) {
    if (e.target.classList.contains('remove-btn')) {
      const type = e.target.getAttribute('data-type');
      const index = parseInt(e.target.getAttribute('data-index'));
      removeTimestamp(type, index);
    }
  });

  // Add keyboard shortcuts
  document.addEventListener('keydown', function(event) {
    const labelOptions = schemaManager.getLabelOptions();
    for (let option of labelOptions) {
      if (option.shortcut && event.key === option.shortcut) {
        recordReaction(option.id);
        event.preventDefault();
      }
    }
  });

  // Load saved file name and reactions when popup opens
  await loadSavedState();

  async function updateLabelButtons() {
    console.log('Updating label buttons');
    const labelOptions = schemaManager.getLabelOptions();
    console.log('Label options:', labelOptions);
    const labelButtonsContainer = document.getElementById('labelButtons');
    labelButtonsContainer.innerHTML = '';
    
    labelOptions.forEach(option => {
      const button = document.createElement('button');
      button.textContent = option.text;
      button.addEventListener('click', () => recordReaction(option.id));
      if (option.shortcut) {
        button.title = `Shortcut: ${option.shortcut}`;
      }
      labelButtonsContainer.appendChild(button);
    });
    console.log('Label buttons updated');
  }

  function clearExistingData() {
    console.log('Clearing existing timestamp data');
    reactions = {};
    schemaManager.getLabelOptions().forEach(option => {
      reactions[option.id] = [];
    });
    saveState();
    updateTimestampDisplay();
    console.log('Existing timestamp data cleared');
  }

  async function recordReaction(type) {
    console.log('Recording reaction:', type);
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    await browser.tabs.sendMessage(tabs[0].id, { action: "recordTimestamp", reactionType: type });
  }

  async function exportTimestamps() {
    console.log('Exporting timestamps');
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    let url = new URL(tabs[0].url);
    let filename = generateFilename(url);
    
    let dataToExport = {
      source: url.toString(),
      schema: schemaManager.currentSchema,
      reactions: reactions
    };
    
    let dataStr = JSON.stringify(dataToExport, null, 2);
    let dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    let linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', filename);
    linkElement.click();
    console.log('Timestamps exported:', filename);
  }

  function generateFilename(url) {
    if (url.hostname.includes('youtube.com')) {
      let videoId = new URLSearchParams(url.search).get('v');
      return `timestamps_youtube_${videoId}.json`;
    } else if (url.hostname.includes('twitch.tv')) {
      let pathParts = url.pathname.split('/');
      let videoId = pathParts[pathParts.length - 1];
      return `timestamps_twitch_${videoId}.json`;
    } else {
      // Default case if neither YouTube nor Twitch
      return `timestamps_${url.hostname}_${Date.now()}.json`;
    }
  }

  function removeTimestamp(type, index) {
    console.log('Removing timestamp:', type, index);
    reactions[type].splice(index, 1);
    saveState();
    updateTimestampDisplay();
    
    // Send updated reactions to content script
    browser.tabs.sendMessage(currentTabId, { action: "updateReactions", reactions: reactions });
    console.log('Timestamp removed');
  }

  browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "updateTimestamps") {
      console.log('Received updateTimestamps message');
      reactions = request.reactions;
      saveState();
      updateTimestampDisplay();
    }
  });

  function updateTimestampDisplay() {
    console.log('Updating timestamp display');
    const labelOptions = schemaManager.getLabelOptions();
    
    for (let option of labelOptions) {
      let type = option.id;
      let columnElement = document.getElementById(`${type}Column`);
      if (!columnElement) {
        columnElement = createTimestampColumn(type, option.text);
      }
      let headerElement = columnElement.querySelector('h3');
      let timestampsElement = document.getElementById(`${type}Timestamps`);
      
      if (reactions[type] && reactions[type].length > 0) {
        headerElement.classList.remove('hidden');
        timestampsElement.innerHTML = reactions[type].map((t, index) => 
          `<div class="timestamp-entry">
             <span>${t}</span>
             <span class="remove-btn" data-type="${type}" data-index="${index}">X</span>
           </div>`
        ).join('');
      } else {
        headerElement.classList.add('hidden');
        timestampsElement.innerHTML = '';
      }
    }
    console.log('Timestamp display updated');
  }

  function createTimestampColumn(type, text) {
    console.log('Creating timestamp column:', type, text);
    const columnsContainer = document.getElementById('timestampColumns');
    const columnElement = document.createElement('div');
    columnElement.id = `${type}Column`;
    columnElement.className = 'column';
    columnElement.innerHTML = `
      <h3 id="${type}" class="hidden">${text}</h3>
      <div id="${type}Timestamps"></div>
    `;
    columnsContainer.appendChild(columnElement);
    return columnElement;
  }

  function saveState() {
    console.log('Saving state');
    let data = {
      [currentTabId]: reactions,
      selectedSchemaText: selectedSchemaText,
      currentSchema: schemaManager.currentSchema
    };
    browser.storage.local.set(data);
    console.log('State saved');
  }

  async function loadSavedState() {
    console.log('Loading saved state');
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    currentTabId = tabs[0].id;
    const result = await browser.storage.local.get([currentTabId.toString(), 'selectedSchemaText', 'currentSchema']);
    console.log('Loaded state:', result);
    if (result[currentTabId]) {
      reactions = result[currentTabId];
    } else {
      clearExistingData();
    }
    if (result.selectedSchemaText) {
      selectedSchemaText = result.selectedSchemaText;
      schemaTextarea.value = selectedSchemaText;
      await schemaManager.loadSchemaFromString(selectedSchemaText);
      updateLabelButtons();
    }
    updateTimestampDisplay();
  
    // Send loaded reactions to content script
    await browser.tabs.sendMessage(currentTabId, { action: "updateReactions", reactions: reactions });
  }
});


function parseLuaSchema(luaSchema) {
  // Regular expressions to match SingleChoice and MultipleChoice
  const singleChoicePattern = /SingleChoice\('(\w+)',\s*{([^}]+)},\s*([^,]+)(?:,\s*([^)]+))?\)/;
  const multipleChoicePattern = /MultipleChoice\('(\w+)',\s*{([^}]+)},\s*{([^}]+)}(?:,\s*'([^']+)')?\)/;

  const choices = [];
  let multiLineBuffer = '';
  let inMultiLine = false;

  // Split the schema into lines and process each line
  const lines = luaSchema.split('\n');
  for (let line of lines) {
    line = line.trim();
    
    if (line.startsWith('--')) {
      continue; // Skip commented lines
    }

    if (inMultiLine) {
      multiLineBuffer += ' ' + line;
      if (line.includes(')')) {
        inMultiLine = false;
        line = multiLineBuffer;
        multiLineBuffer = '';
      } else {
        continue;
      }
    } else if (line.includes('MultipleChoice') && !line.includes(')')) {
      inMultiLine = true;
      multiLineBuffer = line;
      continue;
    }

    const singleMatch = line.match(singleChoicePattern);
    if (singleMatch) {
      const [, name, options, crop, condition] = singleMatch;
      choices.push({
        type: 'SingleChoice',
        name,
        options: options.split(',').map(opt => opt.trim().replace(/"/g, '').replace(/Other/g, '"Other"')),
        crop: crop.trim(),
        condition: condition ? condition.trim().replace(/'/g, '') : null
      });
      continue;
    }

    const multipleMatch = line.match(multipleChoicePattern);
    if (multipleMatch) {
      const [, name, options, crops, condition] = multipleMatch;
      choices.push({
        type: 'MultipleChoice',
        name,
        options: options.split(',').map(opt => opt.trim().replace(/"/g, '').replace(/Other/g, '"Other"')),
        crops: crops.split(',').map(crop => crop.trim()),
        condition: condition ? condition.trim().replace(/'/g, '') : null
      });
    }
  }

  return JSON.stringify(choices, null, 2);
}