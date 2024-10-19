document.addEventListener('DOMContentLoaded', async function() {
    const container = document.getElementById('draggable-container');
    const dragHandle = document.getElementById('drag-handle');
    const resizeHandle = document.getElementById('resize-handle');
    const closeButton = document.getElementById('close-button');
  
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
  
    // Dragging functionality
    dragHandle.addEventListener('mousedown', startDragging);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDragging);
  
    // Resizing functionality
    resizeHandle.addEventListener('mousedown', startResizing);
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
  
    // Close button functionality
    closeButton.addEventListener('click', closeWindow);
  
    // Load saved position and size
    loadWindowState();
  
    function startDragging(e) {
      isDragging = true;
      startX = e.clientX - container.offsetLeft;
      startY = e.clientY - container.offsetTop;
    }
  
    function drag(e) {
      if (!isDragging) return;
      const newX = e.clientX - startX;
      const newY = e.clientY - startY;
      container.style.left = `${newX}px`;
      container.style.top = `${newY}px`;
    }
  
    function stopDragging() {
      isDragging = false;
      saveWindowState();
    }
  
    function startResizing(e) {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = parseInt(document.defaultView.getComputedStyle(container).width, 10);
      startHeight = parseInt(document.defaultView.getComputedStyle(container).height, 10);
    }
  
    function resize(e) {
      if (!isResizing) return;
      const newWidth = startWidth + e.clientX - startX;
      const newHeight = startHeight + e.clientY - startY;
      container.style.width = `${newWidth}px`;
      container.style.height = `${newHeight}px`;
    }
  
    function stopResizing() {
      isResizing = false;
      saveWindowState();
    }
  
    function closeWindow() {
      window.close();
    }
  
    function getBrowserAPI() {
      return typeof browser !== 'undefined' ? browser : chrome;
    }
  
    function saveWindowState() {
      const state = {
        left: container.style.left,
        top: container.style.top,
        width: container.style.width,
        height: container.style.height
      };
      getBrowserAPI().storage.local.set({ windowState: state });
    }
  
    function loadWindowState() {
      getBrowserAPI().storage.local.get('windowState', function(result) {
        if (result.windowState) {
          container.style.left = result.windowState.left || '20px';
          container.style.top = result.windowState.top || '20px';
          container.style.width = result.windowState.width || '350px';
          container.style.height = result.windowState.height || '500px';
        }
      });
    }
  
    // Timestamp Recorder Functionality
    const schemaManager = new SchemaManager();
    let reactions = {};
    let selectedSchemaText = null;
    let isLuaSchema = false;
  
    const schemaTextarea = document.getElementById('schemaTextarea');
    const loadSchemaButton = document.getElementById('loadSchemaButton');
    const toggleSchemaButton = document.getElementById('toggleSchemaButton');
    const schemaSection = document.getElementById('schemaSection');
    const dynamicForm = document.getElementById('dynamicForm');
    const exportButton = document.getElementById('exportTimestamps');
  
    toggleSchemaButton.addEventListener('click', function() {
      schemaSection.classList.toggle('hidden');
      toggleSchemaButton.textContent = schemaSection.classList.contains('hidden') ? 'Show Schema' : 'Hide Schema';
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
  
          toggleSchemaButton.textContent = 'Hide Schema';
        } catch (error) {
          console.error('Failed to load schema:', error);
          alert('Failed to load schema. Please check the format. ' + error);
        }
      } else {
        console.log('No schema input provided');
        alert('Please paste or type the schema before loading.');
      }
    });
  
    exportButton.addEventListener('click', exportTimestamps);
  
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
  
    // Load saved file name and reactions when window opens
    await loadSavedState();
  
    function generateDynamicForm() {
      console.log('Generating dynamic form');
      dynamicForm.innerHTML = '<h2>Record Timestamp</h2>';
      const form = document.createElement('form');
      form.id = 'schemaForm';
  
      const schema = schemaManager.getLabelOptions();
      
      schema.forEach(label => {
        const fieldset = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = label.text;
        fieldset.appendChild(legend);
  
        if (Array.isArray(label.options)) {
          // For JSON schemas with multiple options
          label.options.forEach((option, index) => {
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `${label.id}_${index}`;
            input.name = label.id;
            input.value = option;
  
            const optionLabel = document.createElement('label');
            optionLabel.htmlFor = input.id;
            optionLabel.appendChild(input);
            optionLabel.appendChild(document.createTextNode(option));
  
            fieldset.appendChild(optionLabel);
          });
        } else {
          // For Lua schemas or single-option JSON schemas
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.id = label.id;
          input.name = label.id;
          input.value = label.text;
  
          const labelElement = document.createElement('label');
          labelElement.htmlFor = label.id;
          labelElement.appendChild(input);
          labelElement.appendChild(document.createTextNode(label.text));
  
          fieldset.appendChild(labelElement);
        }
  
        form.appendChild(fieldset);
      });
  
      const submitButton = document.createElement('button');
      submitButton.type = 'button';
      submitButton.textContent = 'Record';
      submitButton.className = 'btn btn-primary';
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
        if (form.querySelector(`input[name="${key}"]:checked`)) {
          if (!data[key]) {
            data[key] = [];
          }
          data[key].push(value);
        }
      }
  
      try {
        getBrowserAPI().runtime.sendMessage({ 
          action: "recordTimestamp", 
          reactionType: isLuaSchema ? 'lua_form_submission' : 'json_form_submission',
          formData: data
        });
        console.log('Message sent to background script');
      } catch (error) {
        console.error('Error sending message to background script:', error);
      }
    }
  
    function updateTimestampDisplay() {
      console.log('Updating timestamp display');
      const columnsContainer = document.getElementById('timestampColumns');
      columnsContainer.innerHTML = '<h2>Recorded Timestamps</h2>';
      
      const reactionType = isLuaSchema ? 'lua_form_submission' : 'json_form_submission';
      const columnElement = createTimestampColumn(reactionType, 'Reactions');
      const timestampsElement = columnElement.querySelector(`#${reactionType}Timestamps`);
      
      if (reactions[reactionType] && reactions[reactionType].length > 0) {
        console.log("TEST TEST TEST");
        timestampsElement.innerHTML = reactions[reactionType].map((entry, index) => 
          `<div class="timestamp-entry">
             <span>${entry.timestamp}</span>
             <span>${JSON.stringify(entry.formData)}</span>
             <span class="remove-btn" data-type="${reactionType}" data-index="${index}">×</span>
           </div>`
        ).join('');
      } else {
        timestampsElement.innerHTML = '<p>No timestamps recorded yet.</p>';
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
      const tabs = await getBrowserAPI().tabs.query({ active: true, currentWindow: true });
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
      getBrowserAPI().tabs.query({active: true, currentWindow: true}, function(tabs) {
        getBrowserAPI().tabs.sendMessage(tabs[0].id, { action: "updateReactions", reactions: reactions });
      });
      console.log('Timestamp removed');
    }
  
    getBrowserAPI().runtime.onMessage.addListener(function(request, sender, sendResponse) {
      console.log('Draggable window received message:', request);
      //if (request.action === "updateTimestamps") {
      if (request.action == "recordTimestamp") {
        console.log('Received updateTimestamps message');
        reactions = request.reactions;
        saveState();
        updateTimestampDisplay();
      }
    });
  
    function saveState() {
      console.log('Saving state');
      let data = {
        reactions: reactions,
        selectedSchemaText: selectedSchemaText,
        currentSchema: schemaManager.currentSchema,
        isLuaSchema: isLuaSchema
      };
      getBrowserAPI().storage.local.set(data);
      console.log('State saved');
    }
  
    async function loadSavedState() {
      console.log('Loading saved state');
      const result = await new Promise(resolve => getBrowserAPI().storage.local.get(null, resolve));
      console.log('Loaded state:', result);
      if (result.reactions) {
        reactions = result.reactions;
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
      getBrowserAPI().tabs.query({active: true, currentWindow: true}, function(tabs) {
        getBrowserAPI().tabs.sendMessage(tabs[0].id, { action: "updateReactions", reactions: reactions });
      });
    }
  
    function sanitizeId(id) {
      return id.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }
  });