# LabelPal

LabelPal is a browser extension that allows users to create timestamped labels for videos, making it easy to mark and organize important moments during video playback.

## Features

- Create custom labels with configurable time windows
- Record timestamps with multiple labels simultaneously
- Export data in both JSON and YAML formats
- Support for multiple video URLs
- Sidebar and popup interface modes
- Persistent storage of labels and timestamps
- Real-time video time capture

## Installation

Currently, the extension supports Firefox. To install it for development:

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file from the extension's directory

## Usage

### Basic Setup

1. Click the LabelPal icon to open the extension (I recommend pinning to toolbar for ease of access.)
2. Enter an optional project name
3. Add labels with associated time windows
   - Each label requires a name and a time window (in seconds)
   - The time window defines how much time before and after the timestamp should be included

### Recording Timestamps

1. Select one or more labels you want to apply
2. Click "Record Timestamp" while the video is playing
3. The current video time will be recorded with your selected labels

### Managing Data

- **Labels**: 
  - Add new labels with custom time windows
  - Remove individual labels
  - Clear all labels at once
  
- **Timestamps**:
  - View recorded timestamps organized by URL
  - Remove individual timestamps
  - Clear all timestamps at once

### Exporting Data

#### JSON Export
Exports data in the following format:
```json
{
  "https://video-url.com": [
    {
      "timestamp": 123.45,
      "timestampFormatted": "00:02:03",
      "labels": ["Label1", "Label2"]
    }
  ]
}
```

#### YAML Export
Exports data with time windows in the following format:
```yaml
# Project: project_name
# Label counts:
#   Label1: 5
#   Label2: 3

content:
 - "https://video-url.com":
   - "00:01:53-00:02:13" #Label1 Label2
```

## Interface Modes

### Sidebar Mode
- Opens as a sidebar in the browser
- Persistent view while navigating
- Toggle between expanded and collapsed states

### Popup Mode
- Opens in a separate window
- Useful for dual-monitor setups
- Can be switched to from sidebar mode
- To return to sidebar mode, simply close the pop-up window and click the add on icon.

## Technical Details

### Files Structure
- `background.js`: Handles extension initialization and window management
- `content_script.js`: Interacts with video elements on the page
- `interface.html`: Main UI structure
- `interface.css`: Styling for the extension
- `interface.js`: Core functionality and user interactions

### Storage
- Uses browser.storage.local for persistent data storage
- Stores labels and timestamps separately
- Data persists across browser sessions

## Known Limitations

- Currently supports Firefox only
- May require re-opening the extension if video time capture fails
- Time windows are symmetrical (same duration before and after timestamp)

## Troubleshooting

If you encounter the error "Unable to get current video time":
1. Close the extension
2. Reload the page with the video
3. Re-open the extension

## Development

### Building from Source

1. Clone the repository
2. Ensure all required files are present
3. Load as a temporary add-on in Firefox for testing

### Contributing

Contributions are welcome! Please ensure your code follows the existing style and includes appropriate documentation.