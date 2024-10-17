-- Audio Cues Schema

local schema = {
    name = "Audio Cues",
    version = "1.0",
    description = "Schema for labeling audio cues in videos",
    labels = {
      {
        id = "laugh",
        text = "Laugh",
        description = "Moments of laughter or amusement",
        shortcut = "l"
      },
      {
        id = "scream",
        text = "Scream",
        description = "Instances of screaming or shock",
        shortcut = "s"
      },
      {
        id = "both",
        text = "Both",
        description = "Simultaneous laughter and screaming",
        shortcut = "b"
      }
    }
  }
  
  -- Convert the schema to JSON for easy parsing by JavaScript
  local json = require("json") -- You'll need a JSON library for Lua
  return json.encode(schema)