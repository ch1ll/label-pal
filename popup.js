document.addEventListener('DOMContentLoaded', async function() {
  console.log('DOMContentLoaded event fired');

  const schemaManager = new SchemaManager();
  let reactions = {};
  let currentTabId = null;
  let selectedSchemaText = null;
  let isLuaSchema = false;

  const schemaTextarea = document.getElementById('schemaTextarea');
  const loadSchemaButton = document.getElementById('loadSchemaButton');
  const toggleSchemaButton = document.getElementById('toggleSchemaButton');
  const schemaSection = document.getElementById('schemaSection');
  const dynamicForm = document.getElementById('dynamicForm');

  toggleSchemaButton.addEventListener('click', function() {
    schemaSection.classList.toggle('hidden');
    toggleSchemaButton.textContent = schemaSection.classList.contains('hidden') ? 'Schema' : 'Hide Schema';
  });

  loadSchemaButton.addEventListener('click', async function() {
    console.log('Load Schema button clicked');
    selectedSchemaText = schemaTextarea.value.trim();
    if (selectedSchemaText) {
      try {
        console.log('Attempting to load schema...');
        await schemaManager.loadSchemaFromString(selectedSchemaText);
        console.log('Schema loaded successfully');

        isLuaSchema = !selectedSchemaText.startsWith('{');

        clearExistingData();
        generateDynamicForm();
        console.log('UI updated with new schema');

        schemaSection.classList.add('hidden');
        toggleSchemaButton.textContent = 'Schema';
      } catch (error) {
        console.error('Failed to load schema:', error);
        alert('Failed to load schema. Please check the format. ' + error);
      }
    } else {
      console.log('No schema input provided');
      alert('Please paste or type the schema before loading.');
    }
  });

  function generateDynamicForm() {
    console.log('Generating dynamic form');
    dynamicForm.innerHTML = '';
    const form = document.createElement('form');
    form.id = 'schemaForm';

    const schema = schemaManager.getLabelOptions();
    
    schema.forEach(label => {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = label.text;
      fieldset.appendChild(legend);

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = label.id;
      input.name = label.id;
      input.value = label.text;

      const labelElement = document.createElement('label');
      labelElement.htmlFor = label.id;
      labelElement.appendChild(input);
      labelElement.appendChild(document.createTextNode(` ${label.text}`));

      fieldset.appendChild(labelElement);
      form.appendChild(fieldset);
    });

    const submitButton = document.createElement('button');
    submitButton.type = 'button';
    submitButton.textContent = 'Record';
    submitButton.addEventListener('click', handleRecord);
    form.appendChild(submitButton);

    dynamicForm.appendChild(form);
    console.log('Dynamic form generated');
  }

  async function handleRecord() {
    console.log('Recording form state');
    const form = document.getElementById('schemaForm');
    const formData = new FormData(form);
    const data = {};

    for (let [key, value] of formData.entries()) {
      if (form.querySelector(`input[name="${key}"]`).checked) {
        data[key] = value;
      }
    }

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    await browser.tabs.sendMessage(tabs[0].id, { 
      action: "recordTimestamp", 
      reactionType: isLuaSchema ? 'lua_form_submission' : 'json_form_submission',
      formData: data
    });

    updateTimestampDisplay();
  }

  function updateTimestampDisplay() {
    console.log('Updating timestamp display');
    const columnsContainer = document.getElementById('timestampColumns');
    columnsContainer.innerHTML = '';
    
    const reactionType = isLuaSchema ? 'lua_form_submission' : 'json_form_submission';
    const columnElement = createTimestampColumn(reactionType, 'Reactions');
    const timestampsElement = columnElement.querySelector(`#${reactionType}Timestamps`);
    
    if (reactions[reactionType] && reactions[reactionType].length > 0) {
      timestampsElement.innerHTML = reactions[reactionType].map((entry, index) => 
        `<div class="timestamp-entry">
           <span>${entry.timestamp}</span>
           <span>${JSON.stringify(entry.formData)}</span>
           <span class="remove-btn" data-type="${reactionType}" data-index="${index}">X</span>
         </div>`
      ).join('');
    }
    console.log('Timestamp display updated');
  }

  function createTimestampColumn(type, text) {
    console.log('Creating timestamp column:', type, text);
    const columnsContainer = document.getElementById('timestampColumns');
    const columnElement = document.createElement('div');
    columnElement.id = `${sanitizeId(type)}Column`;
    columnElement.className = 'column';
    columnElement.innerHTML = `
      <h3 id="${sanitizeId(type)}">${text}</h3>
      <div id="${sanitizeId(type)}Timestamps"></div>
    `;
    columnsContainer.appendChild(columnElement);
    return columnElement;
  }

  function clearExistingData() {
    console.log('Clearing existing timestamp data');
    reactions = {};
    reactions[isLuaSchema ? 'lua_form_submission' : 'json_form_submission'] = [];
    saveState();
    updateTimestampDisplay();
    console.log('Existing timestamp data cleared');
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

  function saveState() {
    console.log('Saving state');
    let data = {
      [currentTabId]: reactions,
      selectedSchemaText: selectedSchemaText,
      currentSchema: schemaManager.currentSchema,
      isLuaSchema: isLuaSchema
    };
    browser.storage.local.set(data);
    console.log('State saved');
  }

  async function loadSavedState() {
    console.log('Loading saved state');
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    currentTabId = tabs[0].id;
    const result = await browser.storage.local.get([currentTabId.toString(), 'selectedSchemaText', 'currentSchema', 'isLuaSchema']);
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
      isLuaSchema = result.isLuaSchema;
      generateDynamicForm();
    }
    updateTimestampDisplay();
  
    // Send loaded reactions to content script
    await browser.tabs.sendMessage(currentTabId, { action: "updateReactions", reactions: reactions });
  }

  function sanitizeId(id) {
    return id.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }
});