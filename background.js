// background.js - Service Worker
import { normalizeDomain, normalizePath, getDateKey, matchesDomain } from './utils.js';
import * as storage from './storage.js';

// Configuration
const HEARTBEAT_INTERVAL_MIN = 1;
const IDLE_THRESHOLD_SECONDS = 60;

// --- Session Management ---

async function getActiveSession() {
  const data = await chrome.storage.session.get('activeSession');
  return data.activeSession || null;
}

async function setActiveSession(session) {
  await chrome.storage.session.set({ activeSession: session });
}

async function clearActiveSession() {
  await chrome.storage.session.remove('activeSession');
}

/**
 * Start a new tracking session
 */
async function startSession(tabId, windowId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    
    // Privacy checks
    if (tab.incognito) return;
    if (!tab.url) return;

    const domain = normalizeDomain(tab.url);
    if (!domain) return; // Blocked or invalid

    const path = normalizePath(tab.url);
    const now = Date.now();

    const session = {
      domain,
      currentPath: path,
      startTime: now,
      lastHeartbeat: now,
      tabId,
      windowId
    };

    await setActiveSession(session);
    console.log(`Started session: ${domain} ${path}`);
  } catch (e) {
    // Tab might be closed or inaccessible
    console.log('Failed to start session:', e);
  }
}

/**
 * Commit current session and optionally clear it
 * @param {boolean} keepAlive If true, updates lastHeartbeat but keeps session active
 */
async function commitSession(keepAlive = false) {
  const session = await getActiveSession();
  if (!session) return;

  const now = Date.now();
  
  // Write to storage (thread-safe)
  await storage.updateStats(session, now, keepAlive);

  if (keepAlive) {
    // Update heartbeat
    session.lastHeartbeat = now;
    
    // Check if path changed in the same tab (handled by onUpdated, but good for safety)
    // Here we just save the timestamp update
    await setActiveSession(session);
    
    // Check limits after heartbeat
    await checkLimits(session.domain);
  } else {
    await clearActiveSession();
  }
}

/**
 * Check limits and notify if exceeded
 */
async function checkLimits(domain) {
  const limits = await storage.getLimits();
  if (Object.keys(limits).length === 0) return;

  const dateKey = getDateKey(Date.now());
  const stats = await storage.getStats(dateKey);
  const alerts = await storage.getAlerts(dateKey);

  // Find matching limit
  let matchedLimit = null;
  let matchedPattern = null;

  for (const [pattern, limit] of Object.entries(limits)) {
    if (matchesDomain(domain, pattern)) {
      matchedLimit = limit;
      matchedPattern = pattern;
      break; 
    }
  }

  if (!matchedLimit) return;

  const totalSeconds = stats[domain] || 0;
  
  if (totalSeconds >= matchedLimit) {
    // Check if already notified
    if (!alerts[domain]) {
      // Send notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Time Limit Reached',
        message: `You've spent over ${Math.floor(totalSeconds/60)}m on ${domain} today.`
      });

      // Mark as notified
      await storage.setAlertShown(dateKey, domain);
    }
  }
}

// --- Event Listeners ---

// 1. Tab Activated
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await commitSession(false); // End previous
  await startSession(activeInfo.tabId, activeInfo.windowId);
});

// 2. Tab Updated (Navigation)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    const session = await getActiveSession();
    if (session && session.tabId === tabId) {
      // Check if domain or path changed
      const newDomain = normalizeDomain(tab.url);
      const newPath = normalizePath(tab.url);

      if (newDomain !== session.domain) {
        // Domain changed
        await commitSession(false);
        await startSession(tabId, tab.windowId);
      } else if (newPath !== session.currentPath) {
        // Only path changed
        await commitSession(false); // Commit old path time
        await startSession(tabId, tab.windowId); // Start new path segment
      }
    }
  }
});

// 3. Tab Removed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const session = await getActiveSession();
  if (session && session.tabId === tabId) {
    await commitSession(false);
  }
});

// 4. Window Focus Changed
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await commitSession(false);
  
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Focus lost to other app
    return;
  }

  // Focus gained
  const tabs = await chrome.tabs.query({active: true, windowId});
  if (tabs.length > 0) {
    await startSession(tabs[0].id, windowId);
  }
});

// 5. Idle State Changed
chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === 'active') {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs.length > 0) {
      await startSession(tabs[0].id, tabs[0].windowId);
    }
  } else {
    // idle or locked
    await commitSession(false);
  }
});

// 6. Alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'heartbeat') {
    await commitSession(true); // Keep alive
  } else if (alarm.name === 'dailyCleanup') {
    const data = await chrome.storage.local.get('settings');
    const retention = data.settings?.retentionDays || 7;
    await storage.cleanupOldData(retention);
  }
});

// --- Lifecycle ---

function initAlarms() {
  chrome.alarms.get('heartbeat', (a) => {
    if (!a) chrome.alarms.create('heartbeat', { periodInMinutes: HEARTBEAT_INTERVAL_MIN });
  });

  chrome.alarms.get('dailyCleanup', (a) => {
    if (!a) {
      // Schedule for next 3 AM
      const now = new Date();
      const next3am = new Date(now);
      next3am.setDate(now.getDate() + 1);
      next3am.setHours(3, 0, 0, 0);
      
      chrome.alarms.create('dailyCleanup', {
        when: next3am.getTime(),
        periodInMinutes: 1440 // Daily
      });
    }
  });
}

chrome.runtime.onStartup.addListener(() => {
  initAlarms();
  // Self-heal: check if we should be tracking
  chrome.idle.queryState(IDLE_THRESHOLD_SECONDS, async (state) => {
    if (state === 'active') {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs.length > 0) {
        // Only start if not already valid? 
        // Safer to just commit existing and restart to be sure
        await commitSession(false);
        await startSession(tabs[0].id, tabs[0].windowId);
      }
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  initAlarms();
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
});
