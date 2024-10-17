class SchemaManager {
  constructor() {
    this.currentSchema = null;
  }

  async loadSchemaFromString(schemaString) {
    console.log('SchemaManager: Loading schema from string');
    try {
      this.currentSchema = JSON.parse(schemaString);
      console.log('SchemaManager: Schema loaded successfully', this.currentSchema);
      return this.currentSchema;
    } catch (error) {
      console.error('SchemaManager: Error parsing schema JSON:', error);
      throw error;
    }
  }

  getLabelOptions() {
    console.log('SchemaManager: Getting label options');
    if (!this.currentSchema) {
      console.log('SchemaManager: No current schema');
      return [];
    }
    console.log('SchemaManager: Returning label options', this.currentSchema.labels);
    return this.currentSchema.labels.map(label => ({
      id: label.id,
      text: label.text,
      shortcut: label.shortcut
    }));
  }
}

// Expose the SchemaManager class globally
window.SchemaManager = SchemaManager;
