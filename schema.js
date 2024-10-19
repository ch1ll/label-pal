class SchemaManager {
  constructor() {
    this.currentSchema = null;
  }

  async loadSchemaFromString(schemaString) {
    console.log('SchemaManager: Loading schema from string');
    try {
      if (schemaString.trim().startsWith('{')) {
        // It's JSON
        this.currentSchema = JSON.parse(schemaString);
      } else {
        // It's Lua
        const jsonSchema = this.parseLuaSchema(schemaString);
        this.currentSchema = { labels: this.convertChoicesToLabels(JSON.parse(jsonSchema)) };
      }
      console.log('SchemaManager: Schema loaded successfully', this.currentSchema);
      return this.currentSchema;
    } catch (error) {
      console.error('SchemaManager: Error parsing schema:', error);
      throw error;
    }
  }

  getLabelOptions() {
    console.log('SchemaManager: Getting label options');
    if (!this.currentSchema) {
      console.log('SchemaManager: No current schema');
      return [];
    }
    if (this.currentSchema.labels) {
      // Lua schema
      return this.currentSchema.labels;
    } else {
      // JSON schema
      return this.currentSchema.map(choice => ({
        id: this.sanitizeId(choice.name),
        text: choice.name,
        options: choice.options
      }));
    }
  }

  parseLuaSchema(luaSchema) {
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

  convertChoicesToLabels(choices) {
    return choices.flatMap(choice => {
      return choice.options.map((option, index) => ({
        id: this.sanitizeId(`${choice.name}_${option}`),
        text: option,
        shortcut: String.fromCharCode(97 + index) // Assign 'a', 'b', 'c', etc. as shortcuts
      }));
    });
  }

  sanitizeId(id) {
    return id.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }
}

// Expose the SchemaManager class globally
window.SchemaManager = SchemaManager;

