# Precision Time Tracker (Chrome Extension)

**Version 2.0 - Production Ready**

A privacy-first, local-only Chrome Extension that tracks your web activity with second-level precision.

## Features
- **Privacy First**: 100% Local storage, no external API calls, incognito mode blocked.
- **Precision**: Tracks time incrementally (every 60s) to prevent data loss.
- **Dashboard**: 7-day history with charts and detailed path breakdown.
- **Limits**: Set daily time limits for specific domains.
- **Export**: Download your data as CSV or JSON.

## Installation
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer Mode** (top right toggle).
3. Click **Load unpacked**.
4. Select the `chrome-time-tracker` folder from this directory.

## Architecture
- **Manifest V3**: Uses Service Workers and Alarms.
- **Web Locks API**: Prevents race conditions during rapid tab switching.
- **Storage**: Uses `chrome.storage.local` with "unlimitedStorage" permission.

## Notes
- **Icons**: Placeholder icons are referenced in the manifest. You may see a default icon until you provide `icon16.png`, `icon48.png`, and `icon128.png` in the `icons/` folder.
