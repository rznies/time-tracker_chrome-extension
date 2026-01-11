# Chrome Time Tracker Extension - Final Production Specification
## REVIEWED & APPROVED - All Critical Issues Resolved

**Version**: 2.0 (Post-Review)  
**Target Platform**: Chrome Extension Manifest V3  
 
**Status**: ✅ SHIP READY

---

## Executive Summary

This specification incorporates all critical findings from multi-AI architectural review (Claude, ChatGPT, Gemini, Grok). All data loss scenarios, race conditions, and MV3 compliance issues have been addressed. This is a production-ready design with zero tolerance for silent data loss.

**Core Principle**: Never hold more than 60 seconds of uncommitted tracking data. Every heartbeat commits incrementally.

---

## Project Overview

A privacy-first Chrome Extension that tracks time spent on websites with second-level precision. Provides productivity alerts when user-defined limits are exceeded. Offers 7-day historical dashboard with CSV/JSON export. 100% local-first architecture with no external API calls.

---

## Critical Architectural Decisions (Post-Review)

### 1. Incremental Commit Architecture (CRITICAL FIX)

**Problem Identified**: Original design held active session data in `chrome.storage.session` without periodic commits. Browser crashes could lose hours of data.

**Solution**: 
- Heartbeat alarm (every 60 seconds) calculates delta since `lastHeartbeat`
- Commits delta to `chrome.storage.local` immediately
- Resets `lastHeartbeat` to current time
- Maximum uncommitted data: 60 seconds

**Key Implementation Rule**:
```
delta = now - lastHeartbeat  // NOT startTime
lastHeartbeat = now          // Reset after every commit
startTime = informational only (for session start timestamp)
```

### 2. Race Condition Prevention (CRITICAL FIX)

**Problem Identified**: Multiple rapid tab switches cause get-modify-set operations to overwrite each other, resulting in data loss (under-counting).

**Solution**: Web Locks API
- Wrap ALL storage operations that modify stats in `navigator.locks.request('tracker_storage', async () => {...})`
- Ensures only one event can update storage at a time
- Lock name: `'tracker_storage'`

**Lock Scope**: Apply to:
- `commitSession()`
- Heartbeat delta commits
- Any function that does get-modify-set on stats

### 3. Storage Quota Management (CRITICAL FIX)

**Problem Identified**: Path-level tracking can generate thousands of unique keys. Default 5MB quota insufficient for heavy users.

**Solution**:
- Add `"unlimitedStorage"` permission to manifest
- Implement path capping: Max 50 paths per domain per day
- Paths beyond limit grouped under `"(other)"` bucket
- Path cleanup included in retention policy

### 4. Service Worker Lifecycle Hardening

**Problem Identified**: Alarms only initialized in `onInstalled`. Extension updates or alarm clearing leaves extension non-functional.

**Solution**:
- Initialize alarms in BOTH `onInstalled` AND `onStartup`
- On startup, check if alarms exist before creating
- Self-healing: If heartbeat hasn't fired in 90 seconds, recreate alarm

---

## URL Tracking Strategy

### Granularity Levels

**Storage Level (Domain Only)**:
- Track time aggregated by domain: `github.com`, `youtube.com`
- Domain is the primary key for all stats and limits
- Storage keys: `stats_2026-01-11` → `{ "github.com": 3847 }`

**UI Display Level (Domain + Path)**:
- Show breakdown by path: `github.com/trending`, `github.com/notifications`
- Paths stored separately for UI purposes only
- Storage keys: `paths_2026-01-11` → `{ "github.com": { "/trending": 1800 } }`

### URL Normalization Rules (MANDATORY)

Extract domain for storage:
1. Parse URL using `new URL(urlString)`
2. Extract `hostname` (lowercase)
3. Strip `www.` prefix if present
4. Result: `github.com`

Extract path for UI tracking:
1. Parse URL using `new URL(urlString)`
2. Extract `pathname` only (NOT `search`, NOT `hash`)
3. Default to `/` if empty
4. **NEVER store query parameters or hash fragments** (privacy + storage bloat)
5. Result: `/trending`

**Examples**:
```
Input:  https://www.GitHub.com/trending?since=weekly#top
Domain: github.com
Path:   /trending

Input:  https://docs.google.com/document/d/ABC123/edit?usp=sharing
Domain: docs.google.com  
Path:   /document/d/ABC123/edit

Input:  https://mail.google.com/mail/u/0/#inbox/ABC123
Domain: mail.google.com
Path:   /mail/u/0/
```

### Special URL Handling

**Block List (Never Track)**:
- `chrome://...`
- `chrome-extension://...`
- `edge://...`
- `about:...`
- `file://...`

Return `null` from normalization function for these URLs.

---

## Time Tracking Rules

### Session Lifecycle

**Session Start Conditions**:
1. `tabs.onActivated` - User switches to different tab
2. `tabs.onUpdated` with `changeInfo.url` - In-tab navigation
3. `windows.onFocusChanged` to valid window - User switches windows
4. `chrome.idle.onStateChanged` to `"active"` - User returns from idle

**Session End Conditions**:
1. Any session start condition (commit previous, start new)
2. `tabs.onRemoved` - Tab closed
3. `windows.onFocusChanged` to `WINDOW_ID_NONE` - User switches to non-Chrome window
4. `chrome.idle.onStateChanged` to `"idle"` or `"locked"` - User goes idle/locks screen

**Periodic Commits** (CRITICAL):
- Heartbeat alarm fires every 60 seconds
- Calculate `delta = now - lastHeartbeat`
- Commit delta to storage
- Update `lastHeartbeat = now`
- Session continues (does NOT end)

### Midnight Crossover Handling

**Decision**: Split sessions at midnight for accurate daily tracking and limit enforcement

**Implementation**:
1. On every commit (including heartbeat), check if date has changed
2. If `getDateKey(now) !== getDateKey(lastHeartbeat)`:
   - Calculate pre-midnight delta: `(endOfDay(lastHeartbeat) - lastHeartbeat)`
   - Commit to previous day's stats
   - Calculate post-midnight delta: `(now - startOfDay(now))`
   - Commit to current day's stats
   - Update `lastHeartbeat = now`
3. This ensures:
   - Daily totals are accurate
   - Limits apply correctly to each day
   - Dashboard shows time on correct dates

**Helper Functions Needed**:
```
endOfDay(timestamp)    → 23:59:59.999 of that day
startOfDay(timestamp)  → 00:00:00.000 of that day
getDateKey(timestamp)  → "2026-01-11"
```

### Idle Behavior

**Idle Threshold**: 60 seconds (configurable in settings)

**Idle Detection Flow**:
1. User goes idle (`chrome.idle.onStateChanged` → `"idle"` or `"locked"`)
2. Commit current session with delta up to idle time
3. Clear active session from storage
4. User returns (`onStateChanged` → `"active"`)
5. Query currently active tab
6. If same tab/window, start new session (resume tracking)
7. If different tab/window, wait for explicit tab activation

**Key Point**: Idle pauses tracking, but returning to same tab automatically resumes.

### Multiple Windows

**Rule**: Track only the focused window

**Implementation**:
- Store `windowId` in `activeSession`
- On `windows.onFocusChanged`:
  - Commit session for old window
  - Start new session for focused window's active tab
- If user switches to non-Chrome window (`WINDOW_ID_NONE`), commit and pause

**Edge Case - Same URL in Multiple Windows**:
- Only focused window counts
- Time not tracked on unfocused window even if same URL

### Incognito Mode

**Rule**: Never track incognito windows (privacy-first)

**Implementation**:
1. On every session start, check `tab.incognito`
2. If `true`, do not create active session
3. On every commit, re-validate `tab.incognito`
4. If session somehow started in normal mode and switched to incognito, drop session without commit

---

## Data Storage Schema

### Active Session State (chrome.storage.session)

**Purpose**: Track currently active browsing session

**Schema**:
```javascript
{
  activeSession: {
    domain: "github.com",           // Normalized domain
    currentPath: "/trending",       // Normalized path (no query/hash)
    startTime: 1704988800000,       // Session start (informational)
    lastHeartbeat: 1704988860000,   // Last commit timestamp (CRITICAL)
    tabId: 123,                     // Active tab ID
    windowId: 456                   // Active window ID
  }
}
```

**Update Frequency**: On every state change (tab switch, navigation, heartbeat)

**Durability**: Survives service worker restarts, cleared on browser close

### Daily Tracking Data (chrome.storage.local)

**Domain-Level Stats**:
```javascript
{
  "stats_2026-01-11": {
    "github.com": 3847,      // Total seconds on domain today
    "youtube.com": 1250,
    "docs.google.com": 892
  },
  "stats_2026-01-12": {
    "github.com": 2100
  }
}
```

**Path-Level Stats (UI Display Only)**:
```javascript
{
  "paths_2026-01-11": {
    "github.com": {
      "/trending": 1800,
      "/notifications": 1200,
      "/user/profile": 847,
      "(other)": 200           // Overflow bucket (paths beyond cap)
    }
  }
}
```

**Path Capping**: Max 50 unique paths per domain per day. Path #51+ grouped under `"(other)"`.

### Limits Configuration (chrome.storage.local)

```javascript
{
  "limits": {
    "youtube.com": 7200,       // 2 hours in seconds
    "twitter.com": 3600,       // 1 hour
    "reddit.com": 1800         // 30 minutes
  }
}
```

### Alert State (chrome.storage.local)

```javascript
{
  "alerts_2026-01-11": {
    "youtube.com": true,       // Notification already shown today
    "twitter.com": false
  }
}
```

**Reset**: Alerts automatically reset at midnight (new date key)

### Settings (chrome.storage.local)

```javascript
{
  "settings": {
    "idleThreshold": 60,       // Seconds before considered idle
    "retentionDays": 7,        // Days of history to keep
    "alarmInterval": 60        // Heartbeat interval in seconds
  }
}
```

---

## Limit Enforcement Logic

### Pattern Matching (Subdomain Wildcards)

**Rule**: Limits apply to domain and all subdomains

**Implementation**:
```
User sets limit on: "youtube.com"
Matches:
  - youtube.com
  - m.youtube.com
  - www.youtube.com
  - music.youtube.com

Does NOT match:
  - notyoutube.com
  - youtube.com.fake.site
```

**Matching Algorithm**:
1. Exact match: `domain === pattern`
2. Subdomain match: `domain.endsWith('.' + pattern)`

### Limit Checking Frequency

**When to Check**:
1. Every heartbeat alarm (every 60 seconds)
2. On every session commit

**Check Logic**:
1. Get user-defined limits
2. Find matching limit for current domain (including subdomain matching)
3. Query today's total for domain from `stats_${dateKey}`
4. If `totalSeconds >= limitSeconds`:
   - Check alert state for today
   - If not already notified, send notification
   - Mark as notified in `alerts_${dateKey}`

### Notification Behavior

**Frequency**: One notification per domain per day

**Content**:
```
Title: "Time Limit Reached"
Message: "You've spent 2h 5m on youtube.com today (limit: 2h)"
Icon: Extension icon
```

**Post-Limit Behavior**: Continue tracking normally (notification only, no blocking)

**User Actions**: None required (informational only)

---

## Data Retention & Cleanup

### Retention Policy

**Rule**: Keep exactly 7 calendar days (midnight to midnight)

**Implementation**:
1. Calculate cutoff date: `today - 7 days`
2. Remove all keys with date older than cutoff
3. Affected key patterns:
   - `stats_YYYY-MM-DD`
   - `alerts_YYYY-MM-DD`
   - `paths_YYYY-MM-DD`

### Cleanup Schedule

**Timing**: Daily at 3:00 AM local time

**Alarm Setup**:
1. Calculate minutes until next 3:00 AM
2. Create alarm with initial delay, then `periodInMinutes: 1440` (24 hours)

**Execution**:
1. Get all keys from `chrome.storage.local`
2. Filter keys matching patterns above
3. Parse date from key name
4. If date < cutoff, add to removal list
5. Remove all keys in batch

---

## Event Listeners (Complete List)

### 1. tabs.onActivated

**Trigger**: User switches to different tab

**Actions**:
1. Commit current active session (if exists)
2. Get newly activated tab details
3. Check if incognito (skip if true)
4. Normalize URL to domain and path
5. Start new session with current timestamp

### 2. tabs.onUpdated (CRITICAL - Catches In-Tab Navigation)

**Trigger**: URL changes within same tab, tab status changes

**Actions**:
1. Check if `changeInfo.url` exists (ignore other updates)
2. Debounce: Ignore if same domain as current session
3. Check if this is the active tab (compare `tabId` with `activeSession.tabId`)
4. If active and domain changed:
   - Commit current session
   - Start new session with new URL
5. If path changed but domain same:
   - Update `activeSession.currentPath`

**Debouncing Logic**:
- Track last committed domain per tab
- Ignore duplicate domain transitions
- Wait for `status === "complete"` for better accuracy (optional optimization)

### 3. tabs.onRemoved

**Trigger**: Tab is closed

**Actions**:
1. Check if closed tab is the active session
2. If yes, commit final session
3. Clear active session from storage

### 4. windows.onFocusChanged

**Trigger**: User switches between Chrome windows or to other applications

**Actions**:
1. If `windowId === chrome.windows.WINDOW_ID_NONE`:
   - Commit active session
   - Clear active session (user switched to non-Chrome app)
2. If `windowId` is valid:
   - Commit current session
   - Query active tab in newly focused window
   - Start new session for that tab

### 5. chrome.idle.onStateChanged

**Trigger**: User goes idle, locks screen, or returns to active

**Actions**:

**On `"idle"` or `"locked"`**:
1. Commit current session up to idle time
2. Clear active session

**On `"active"`**:
1. Query currently active tab and window
2. Check if incognito (skip if true)
3. Start new session for current tab

**Idle Threshold**: Set via `chrome.idle.setDetectionInterval(60)`

### 6. chrome.alarms.onAlarm (CRITICAL - Heartbeat)

**Trigger**: Periodic alarm fires

**Alarm Types**:

**"heartbeat" (every 60 seconds)**:
1. Get active session from storage
2. If no active session, exit
3. Calculate `delta = now - lastHeartbeat`
4. If delta > 0:
   - Check for midnight crossover (handle split if needed)
   - Commit delta to appropriate date bucket(s)
   - Update `lastHeartbeat = now`
   - Save updated session back to storage
5. Check limits for current domain

**"dailyCleanup" (daily at 3 AM)**:
1. Execute retention cleanup logic
2. Remove data older than 7 days

### 7. chrome.runtime.onStartup (CRITICAL - Alarm Recovery)

**Trigger**: Browser starts

**Actions**:
1. Check if "heartbeat" alarm exists
2. If not, create with `periodInMinutes: 1`
3. Check if "dailyCleanup" alarm exists
4. If not, recreate with next 3 AM schedule

### 8. chrome.runtime.onInstalled

**Trigger**: Extension installed or updated

**Actions**:
1. Create "heartbeat" alarm
2. Create "dailyCleanup" alarm
3. Set idle detection interval
4. Initialize default settings (if first install)

---

## Core Functions & Logic

### startSession(tabId, windowId)

**Purpose**: Initialize new tracking session

**Steps**:
1. Get tab details using `chrome.tabs.get(tabId)`
2. Check `tab.incognito` → return early if true
3. Normalize URL to domain and path
4. If domain is null (blocked URL), return early
5. Create session object:
   ```javascript
   {
     domain: normalizedDomain,
     currentPath: normalizedPath,
     startTime: Date.now(),
     lastHeartbeat: Date.now(),
     tabId: tabId,
     windowId: windowId
   }
   ```
6. Save to `chrome.storage.session`

**Error Handling**: Catch invalid tab IDs, malformed URLs

### commitSession()

**Purpose**: Save tracked time to permanent storage

**Steps** (Inside Web Lock):
1. Acquire lock: `navigator.locks.request('tracker_storage', async () => { ... })`
2. Get `activeSession` from `chrome.storage.session`
3. If no session, return early
4. Calculate `delta = Math.floor((now - lastHeartbeat) / 1000)`
5. If delta <= 0, return early
6. Check for midnight crossover:
   - If `getDateKey(now) !== getDateKey(lastHeartbeat)`:
     - Split delta at midnight boundary
     - Commit pre-midnight portion to old date
     - Commit post-midnight portion to new date
   - Else:
     - Commit full delta to current date
7. Update domain stats: `stats[domain] += delta`
8. Update path stats: `paths[domain][path] += delta` (with capping logic)
9. Save stats to `chrome.storage.local`
10. Clear active session from storage

**Path Capping Logic**:
```
If paths[domain] has < 50 keys:
  Add new path normally
Else:
  Add to paths[domain]["(other)"]
```

### reconcileSession()

**Purpose**: Recover from service worker restart mid-session

**Steps**:
1. Get `activeSession` from storage
2. If no session, return early
3. Query current active tab: `chrome.tabs.query({ active: true, currentWindow: true })`
4. Compare with stored session:
   - Different tab? → Commit and start new
   - Different window? → Commit and start new
   - Different domain? → Commit and start new
   - Same tab/domain but different path? → Update path only
   - Exact match? → Update lastHeartbeat, continue tracking

### commitIncrementalDelta() (Heartbeat-Specific)

**Purpose**: Commit time without ending session

**Steps** (Inside Web Lock):
1. Get `activeSession`
2. Calculate `delta = now - lastHeartbeat`
3. Check midnight crossover (handle split if needed)
4. Commit delta to appropriate date bucket(s)
5. Update both domain and path stats
6. Update `lastHeartbeat = now`
7. Save updated session back to storage (do NOT clear it)

**Key Difference from commitSession**: Session continues after commit

### checkLimits(domain, dateKey)

**Purpose**: Enforce productivity limits and send notifications

**Steps**:
1. Get user-defined limits from storage
2. Find matching limit for domain (with subdomain matching)
3. If no limit defined, return early
4. Get today's total: `stats[dateKey][domain]`
5. If `total >= limit`:
   - Check if already notified: `alerts[dateKey][domain]`
   - If not notified:
     - Send notification
     - Mark as notified: `alerts[dateKey][domain] = true`

### normalizeDomain(urlString)

**Purpose**: Extract and normalize domain from URL

**Steps**:
1. Check blocklist (chrome://, chrome-extension://, etc.) → return null
2. Parse with `new URL(urlString)`
3. Extract `hostname.toLowerCase()`
4. Strip `www.` prefix if present
5. Return normalized domain

**Error Handling**: Try-catch for malformed URLs, return null on error

### normalizePath(urlString)

**Purpose**: Extract path without query params or hash

**Steps**:
1. Parse with `new URL(urlString)`
2. Extract `pathname`
3. Default to `/` if empty
4. Return path (no query string, no hash)

### getDateKey(timestamp)

**Purpose**: Convert timestamp to date string

**Implementation**:
```javascript
const date = new Date(timestamp);
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
return `${year}-${month}-${day}`;
```

### matchesDomain(domain, pattern)

**Purpose**: Check if domain matches limit pattern (with subdomain support)

**Implementation**:
```javascript
if (domain === pattern) return true;
if (domain.endsWith('.' + pattern)) return true;
return false;
```

### cleanupOldData()

**Purpose**: Remove data beyond retention period

**Steps**:
1. Get retention days from settings (default 7)
2. Calculate cutoff date: `new Date() - retentionDays`
3. Get all storage keys
4. Filter for `stats_`, `alerts_`, `paths_` keys
5. Parse date from key name
6. If date < cutoff, add to removal list
7. Remove all expired keys in batch

---

## User Interface Design

### Popup (Quick Access)

**Layout**: Compact card-based design, ~400x600px

**Components**:

1. **Current Session Timer** (Live)
   - Domain: `github.com`
   - Duration: `5m 32s` (updates every second)
   - Path: `/trending` (subtle, smaller text)

2. **Today's Summary**
   - Total time today: `3h 24m`
   - Top 5 domains with durations
   - Click domain to expand path breakdown

3. **Quick Actions**
   - "Set Limit" button (opens modal)
   - "View Dashboard" button (opens options page)

**Live Updates**: Use `setInterval` to update current session every 1 second

**Data Loading**: Fetch only today's stats (not full 7-day history)

### Options Page (Full Dashboard)

**Layout**: Full-page app with sidebar navigation

**Sections**:

**1. Overview Tab**
- 7-day activity chart (bar chart, days on X-axis, hours on Y-axis)
- Stacked bars if showing multiple domains
- Today's total (prominent display)

**2. Breakdown Tab**
- Sortable data table:
  - Columns: Domain (with favicon), Duration, Paths, % of Day, Actions
  - Sort by: Duration (default), Domain (alphabetical), % of Day
  - Expandable rows for path-level breakdown
- Date range selector (defaults to today)

**3. Limits Tab**
- List of active limits with edit/delete buttons
- "Add New Limit" form:
  - Domain input with autocomplete (from tracked domains)
  - Duration input (hours/minutes selector)
  - Save button
- UI warning: "Limits apply to entire domain including subdomains"

**4. Export Tab**
- Date range selector
- Export format: CSV / JSON
- Download button
- Preview of data to be exported

**5. Settings Tab**
- Idle threshold (slider, 30-300 seconds)
- Retention period (dropdown, 7/14/30 days)
- Clear all data button (with confirmation)

### Path-Level Breakdown UI

**Expandable Table Row**:
```
▼ github.com                    1h 4m 7s    4.5%
  ├─ /trending                  30m 12s
  ├─ /notifications             20m 45s
  ├─ /user/profile              13m 10s
  └─ (other)                    0m 0s
```

**Implementation**: Store paths separately, load on-demand when user expands

---

## Export Functionality

### CSV Format

**Columns**:
```
Date,Domain,Duration (seconds),Duration (formatted),Percentage of Day,Top Path,Top Path Duration
```

**Example**:
```csv
"Date","Domain","Duration (seconds)","Duration (formatted)","Percentage of Day","Top Path","Top Path Duration"
"2026-01-11","github.com","3847","1h 4m 7s","4.5%","/trending","30m 12s"
"2026-01-11","youtube.com","1250","20m 50s","1.5%","/watch","15m 30s"
```

**Security Fix**: Formula Injection Prevention
- Check if cell starts with `=`, `+`, `-`, `@`
- If true, prefix with single quote: `'=dangerous`

### JSON Format

**Structure**:
```json
{
  "exportDate": "2026-01-11T10:30:00Z",
  "dateRange": {
    "start": "2026-01-05",
    "end": "2026-01-11"
  },
  "data": [
    {
      "date": "2026-01-11",
      "domain": "github.com",
      "durationSeconds": 3847,
      "durationFormatted": "1h 4m 7s",
      "percentageOfDay": 4.5,
      "paths": {
        "/trending": 1812,
        "/notifications": 1245,
        "/user/profile": 790
      }
    }
  ]
}
```

### Export Generation (Client-Side Only)

**Implementation**:
1. Query storage for date range
2. Build data structure
3. Convert to CSV/JSON
4. Create Blob: `new Blob([data], { type: 'text/csv' })`
5. Generate download URL: `URL.createObjectURL(blob)`
6. Trigger download with temporary `<a>` element
7. Revoke URL after download

**No Server Interaction**: All processing done in browser

---

## Security & Privacy Requirements

### 1. Local-First Architecture

**Rule**: Zero network requests

**Enforcement**:
- No `fetch()` calls
- No `XMLHttpRequest`
- No external script imports
- All processing client-side

### 2. XSS Prevention

**Rule**: Never use `innerHTML` for user-controlled data

**Implementation**:
- Use `textContent` for all URLs and domains
- Sanitize before rendering in tables/charts
- Escape special HTML characters

### 3. Incognito Privacy

**Rule**: Never track incognito browsing

**Enforcement**:
- Check `tab.incognito` on every session start
- Re-validate on every commit
- Drop session if switched to incognito mid-session

### 4. URL Blocking

**Rule**: Never track internal browser pages

**Blocked Patterns**:
- `chrome://`
- `chrome-extension://`
- `edge://`
- `about:`
- `file://`

### 5. Sensitive Data Sanitization

**Rule**: Never store query parameters or hash fragments

**Reason**: Prevents PII leakage
- Password reset tokens: `/reset?token=XYZ`
- Email IDs: `/inbox#msg-12345`
- Session identifiers: `/app?session=ABC`

**Implementation**: Strip `search` and `hash` from all path tracking

### 6. CSV Formula Injection Prevention

**Rule**: Escape dangerous cell prefixes

**Implementation**:
```javascript
if (/^[=+\-@]/.test(cell)) {
  cell = "'" + cell;  // Prefix with single quote
}
```

### 7. Least Privilege Permissions

**Manifest Permissions** (Justified):
- `tabs`: Read active tab info (required for tracking)
- `storage`: Local data persistence (required)
- `idle`: Detect user inactivity (required)
- `alarms`: Periodic operations (required)
- `notifications`: Limit alerts (required)
- `unlimitedStorage`: Heavy user support (required)

**No Host Permissions**: Extension does not inject content scripts

---

## Error Handling & Edge Cases

### 1. Invalid URLs

**Scenario**: Malformed URL string

**Handling**:
- Wrap `new URL()` in try-catch
- Return `null` from normalization
- Skip tracking for null domains

### 2. Missing Tab Access

**Scenario**: Tab closed between query and access

**Handling**:
- Catch `chrome.runtime.lastError`
- Log error
- Return early from session start

### 3. Storage Write Failures

**Scenario**: Quota exceeded (pre-unlimitedStorage fix)

**Handling**:
- Check `chrome.runtime.lastError` after set operations
- Show user notification if critical data lost
- Trigger emergency cleanup

### 4. Alarm Not Firing

**Scenario**: Browser kills alarms

**Detection**:
- On every tab event, check: `now - lastHeartbeat > 90 seconds`
- If true, assume missed heartbeat
- Manually trigger reconciliation

**Recovery**:
- Recreate alarm
- Commit pending delta

### 5. Service Worker Killed Mid-Commit

**Scenario**: Browser terminates worker during storage operation

**Mitigation**:
- Web Locks API ensures atomicity
- Worst case: Duplicate commit (over-counting by <60s)
- Acceptable trade-off vs data loss

### 6. Rapid Tab Switching

**Scenario**: User switches tabs 10 times in 1 second

**Handling**:
- Web Locks API serializes commits
- Each event waits for lock
- No data loss, but slight processing delay

**Optimization**: Debounce commits with 100ms delay (optional)

### 7. tabs.onUpdated Firing Multiple Times

**Scenario**: SPA navigation triggers multiple update events

**Handling**:
- Track last committed domain per tab
- Ignore events if domain unchanged
- Only commit when domain actually changes

### 8. Browser Shutdown

**Scenario**: User closes browser mid-session

**Expected Behavior**:
- Active session in `chrome.storage.session` is lost
- Last committed data (up to 60 seconds old) is safe
- Next launch starts fresh

**User Communication**: Document as known limitation (acceptable <60s loss on crashes)

### 9. Picture-in-Picture Windows

**Scenario**: User opens video in PiP while browsing other tab

**Current Behavior**: Only focused window tracked (PiP not tracked)

**Justification**: PiP is background media, not active browsing

**Documentation**: List as known limitation

### 10. DevTools Undocked

**Scenario**: DevTools in separate window

**Current Behavior**: Not tracked (DevTools window has no URL)

**Justification**: Correct behavior

---

## Testing & Verification Plan

### Critical Path Tests (Mandatory)

**1. Service Worker Lifecycle Test**
- Start session on Tab A
- Force terminate service worker (chrome://serviceworker-internals)
- Wait for worker to restart
- Switch to Tab B
- Verify Tab A time was committed correctly
- **Pass Criteria**: No data loss, time accurate within ±1 second

**2. Incremental Commit Test**
- Start session on domain X
- Wait 90 seconds without any tab switches
- Check storage directly
- Verify at least one heartbeat commit occurred
- **Pass Criteria**: Data committed incrementally, not all at end

**3. Race Condition Test**
- Open 20 tabs with different domains
- Switch between tabs rapidly (1 switch per second)
- Continue for 2 minutes
- Calculate expected total time (~120 seconds)
- Verify stored data matches expected (within ±5%)
- **Pass Criteria**: No data loss from overlapping commits

**4. tabs.onUpdated Test (CRITICAL)**
- Open Tab A to `github.com/trending`
- Wait 30 seconds
- Click link to navigate to `github.com/notifications` (in-tab navigation)
- Wait 30 seconds
- Check storage
- Verify both paths tracked separately with ~30s each
- **Pass Criteria**: In-tab navigation triggers commit correctly

**5. Midnight Crossover Test**
- Manually set system time to 23:59:00
- Start session
- Wait until 00:01:00 (cross midnight)
- Check storage for both dates
- Verify time split correctly between days
- **Pass Criteria**: Pre-midnight time in old date, post-midnight in new date

**6. Idle Detection Test**
- Start session
- Trigger idle state (either wait or mock `chrome.idle.onStateChanged`)
- Wait 30 seconds (while idle)
- Return to active
- Verify idle time NOT counted
- **Pass Criteria**: Only active time tracked

**7. Limit Notification Test**
- Set limit on domain X to 10 seconds
- Track domain X for 15 seconds
- Verify notification fires exactly once
- Continue tracking to 30 seconds
- Verify no duplicate notification
- **Pass Criteria**: Single notification per day per domain

**8. Browser Restart Test (Adjusted)**
- Start session
- Track for 30 seconds
- Force close browser (kill process)
- Reopen browser
- Check storage
- **Pass Criteria**: Up to 60 seconds of data loss acceptable (last heartbeat period)

**9. Incognito Test**
- Open incognito window
- Browse for 2 minutes
- Check storage
- **Pass Criteria**: Zero data tracked from incognito

**10. Storage Cleanup Test**
- Manually create data with dates 8, 9, 10 days ago
- Trigger cleanup alarm
- Verify data >7 days removed
- Verify data ≤7 days retained
- **Pass Criteria**: Correct retention policy enforcement

### Automated Test Coverage

**Unit Tests** (if using testing framework):
- `normalizeDomain()` with various URL formats
- `matchesDomain()` with subdomain patterns
- `getDateKey()` with edge case timestamps
- `formatDuration()` with various second values
- Midnight split calculation logic

**Integration Tests**:
- Full session lifecycle (start → heartbeat → commit → cleanup)
- Concurrent event handling
- Storage atomicity under load

### Manual Verification

**Heavy Usage Simulation**:
- Install extension
- Use browser normally for 7 days
- Check storage usage daily
- Verify no performance degradation
- Check for memory leaks in service worker

**Multi-Window Workflow**:
- Open 3 windows with different content
- Switch between windows frequently
- Verify only focused window time tracked

**SPA Navigation**:
- Test on single-page apps (Gmail, GitHub, Twitter)
- Verify in-page route changes trigger commits
- Check for duplicate tracking

---

## Performance Optimization Guidelines

### 1. Lazy Loading in UI
- Popup: Load only today's data
- Options page: Load data on-demand per tab
- Don't load all 7 days upfront

### 2. Batch Operations
- Group multiple stat updates in single storage write
- Use transaction-like pattern with Web Locks

### 3. Debouncing (Optional)
- Debounce rapid commits with 100ms delay
- Only if performance issues detected
- Don't debounce heartbeat commits

### 4. Storage Efficiency
- Use flat key structure (already implemented)
- Avoid nested objects requiring full deserialization
- Keep individual key sizes small (<1KB per day)

### 5. Memory Management
- Service worker should not cache large datasets
- Clear unused variables after operations
- Avoid global state accumulation

---

## Known Limitations (Document for Users)

1. **Data Loss on Browser Crash**: Up to 60 seconds of data may be lost if browser crashes
2. **Idle Detection**: Reading without keyboard/mouse input may be marked as idle after 60s
3. **Background Media**: Videos playing in background tabs are not counted as active time
4. **Picture-in-Picture**: PiP windows not tracked separately
5. **Incognito Mode**: No tracking in incognito (by design)
6. **Midnight Sessions**: Long sessions are split at midnight for accurate daily tracking
7. **Path Limit**: Only top 50 paths per domain tracked, others grouped under "(other)"

---

## Manifest V3 Configuration (Final)

```json
{
  "manifest_version": 3,
  "name": "Precision Time Tracker",
  "version": "1.0.0",
  "description": "Track time spent on websites with second-level precision and productivity alerts",
  "permissions": [
    "tabs",
    "storage",
    "idle",
    "alarms",
    "notifications",
    "unlimitedStorage"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_page": "options.html",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

## Implementation Checklist 

### Phase 1: Core Service Worker
- [ ] Set up Manifest V3 structure
- [ ] Implement URL normalization functions
- [ ] Implement all event listeners (tabs, windows, idle)
- [ ] Implement session state management
- [ ] Implement Web Locks API for all storage operations

### Phase 2: Incremental Commit Architecture
- [ ] Implement heartbeat alarm (60s interval)
- [ ] Implement incremental delta commit logic
- [ ] Implement midnight crossover split logic
- [ ] Implement alarm recovery on startup
- [ ] Test service worker lifecycle resilience

### Phase 3: Limit Enforcement
- [ ] Implement limit configuration storage
- [ ] Implement domain pattern matching
- [ ] Implement limit checking on heartbeat
- [ ] Implement notification system
- [ ] Implement alert state tracking

### Phase 4: Path-Level Tracking
- [ ] Add path to activeSession state
- [ ] Implement path commit logic
- [ ] Implement path capping (50 per domain)
- [ ] Handle path overflow bucket

### Phase 5: Data Management
- [ ] Implement retention cleanup routine
- [ ] Implement daily cleanup alarm
- [ ] Test cleanup with old data
- [ ] Verify storage efficiency

### Phase 6: User Interface
- [ ] Build popup HTML/CSS (Material Design 3)
- [ ] Implement live session timer
- [ ] Build options page with tabs
- [ ] Implement 7-day activity chart
- [ ] Implement sortable data table

### Phase 7: Export Functionality
- [ ] Implement CSV export with formula injection prevention
- [ ] Implement JSON export
- [ ] Add date range selector
- [ ] Test export with various data sizes

### Phase 8: Security & Privacy
- [ ] Implement incognito blocking
- [ ] Implement URL blocklist
- [ ] Sanitize all user-controlled data
- [ ] Remove query params/hash from paths
- [ ] Final security audit

### Phase 9: Testing
- [ ] Run all critical path tests
- [ ] Perform automated unit tests
- [ ] Manual heavy usage testing
- [ ] Multi-window workflow testing
- [ ] Edge case validation

### Phase 10: Polish
- [ ] Add error handling throughout
- [ ] Implement user-friendly error messages
- [ ] Add settings page
- [ ] Write user documentation
- [ ] Final performance optimization

---

## Critical Reminders for Implementation

1. **NEVER calculate delta from startTime** - Always use `lastHeartbeat`
2. **ALWAYS wrap storage updates in Web Locks** - Prevents race conditions
3. **ALWAYS strip query params and hash from paths** - Privacy requirement
4. **ALWAYS check incognito on session start AND commit** - Security requirement
5. **ALWAYS split sessions at midnight** - Ensures accurate daily tracking
6. **ALWAYS use chrome.alarms, NEVER setInterval** - MV3 requirement
7. **ALWAYS initialize alarms in both onInstalled AND onStartup** - Reliability
8. **ALWAYS commit incrementally on heartbeat** - Data loss prevention
9. **ALWAYS cap paths at 50 per domain** - Storage management
10. **ALWAYS validate tab.incognito before tracking** - Privacy first

---

## File Structure (Recommended)

```
chrome-time-tracker/
├── manifest.json
├── background.js              # Service Worker (event listeners + core logic)
├── utils.js                   # Shared helpers (normalize, format, etc.)
├── storage.js                 # Storage operations with Web Locks
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── components/
│   ├── chart.js               # Chart rendering logic
│   └── table.js               # Data table component
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── libs/                      # Third-party libraries (if needed)
    └── chart.min.js
```

---

## Success Criteria

This implementation will be considered **production-ready** when:

1. ✅ No data loss scenarios (except documented <60s on browser crash)
2. ✅ Zero race conditions under rapid tab switching
3. ✅ Accurate time tracking within ±1 second over long sessions
4. ✅ Limits enforced correctly across midnight boundaries
5. ✅ All incognito browsing properly excluded
6. ✅ Storage usage remains under control (path capping works)
7. ✅ Service worker survives restarts without data corruption
8. ✅ All 10 critical path tests pass
9. ✅ No XSS vulnerabilities in UI
10. ✅ Performance remains acceptable with heavy usage