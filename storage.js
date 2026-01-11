// storage.js - Persistent storage management with Web Locks
import { getDateKey, getStartOfDay, getEndOfDay } from './utils.js';

const LOCK_NAME = 'tracker_storage';

/**
 * Update stats with delta, handling midnight crossover and path capping
 * @param {object} session Active session object
 * @param {number} now Current timestamp
 * @param {boolean} isIncremental If true, session continues (update lastHeartbeat). If false, session ends.
 * @returns {Promise<void>}
 */
export async function updateStats(session, now, isIncremental) {
  // Use Web Locks API to prevent race conditions
  await navigator.locks.request(LOCK_NAME, async () => {
    if (!session || !session.domain) return;

    const lastHeartbeat = session.lastHeartbeat;
    
    // Calculate total delta
    const rawDelta = now - lastHeartbeat;
    if (rawDelta <= 0) return; // No time passed

    const dateKeyStart = getDateKey(lastHeartbeat);
    const dateKeyEnd = getDateKey(now);

    // Prepare updates
    const updates = {};
    
    if (dateKeyStart === dateKeyEnd) {
      // Same day
      const seconds = Math.floor(rawDelta / 1000);
      if (seconds > 0) {
        await applyDelta(dateKeyStart, session.domain, session.currentPath, seconds);
      }
    } else {
      // Crossover midnight
      const endOfDay = getEndOfDay(lastHeartbeat);
      const startOfNextDay = getStartOfDay(now);
      
      const delta1 = endOfDay - lastHeartbeat; // ms
      const delta2 = now - startOfNextDay;     // ms
      
      const seconds1 = Math.floor(delta1 / 1000);
      const seconds2 = Math.floor(delta2 / 1000);

      if (seconds1 > 0) {
        await applyDelta(dateKeyStart, session.domain, session.currentPath, seconds1);
      }
      if (seconds2 > 0) {
        await applyDelta(dateKeyEnd, session.domain, session.currentPath, seconds2);
      }
    }
  });
}

/**
 * Apply delta to storage (Helper called inside lock)
 */
async function applyDelta(dateKey, domain, path, seconds) {
  const statsKey = `stats_${dateKey}`;
  const pathsKey = `paths_${dateKey}`;

  // Read current data
  const data = await chrome.storage.local.get([statsKey, pathsKey]);
  
  const stats = data[statsKey] || {};
  const paths = data[pathsKey] || {};

  // Update Domain Stats
  stats[domain] = (stats[domain] || 0) + seconds;

  // Update Path Stats with Capping
  if (!paths[domain]) {
    paths[domain] = {};
  }

  const domainPaths = paths[domain];
  
  // Check if path exists or we have room
  if (domainPaths[path] !== undefined) {
    domainPaths[path] += seconds;
  } else {
    // New path, check limit
    const keys = Object.keys(domainPaths);
    // Filter out "(other)" from count if it exists (though it counts as a key)
    // Spec says: Max 50 paths.
    if (keys.length < 50) {
      domainPaths[path] = seconds;
    } else {
      // Add to overflow
      domainPaths['(other)'] = (domainPaths['(other)'] || 0) + seconds;
    }
  }

  // Write back
  await chrome.storage.local.set({
    [statsKey]: stats,
    [pathsKey]: paths
  });
}

/**
 * Clean up old data based on retention policy
 * @param {number} retentionDays 
 */
export async function cleanupOldData(retentionDays = 7) {
  await navigator.locks.request(LOCK_NAME, async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffDateKey = getDateKey(cutoff.getTime());

    const allKeys = await chrome.storage.local.get(null);
    const keysToRemove = [];

    for (const key of Object.keys(allKeys)) {
      // Match stats_YYYY-MM-DD, paths_..., alerts_...
      const match = key.match(/^(stats|paths|alerts)_(\d{4}-\d{2}-\d{2})$/);
      if (match) {
        const fileDateKey = match[2];
        // String comparison works for YYYY-MM-DD
        if (fileDateKey < cutoffDateKey) {
          keysToRemove.push(key);
        }
      }
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log('Cleaned up keys:', keysToRemove);
    }
  });
}

/**
 * Get limits
 */
export async function getLimits() {
  const data = await chrome.storage.local.get('limits');
  return data.limits || {};
}

/**
 * Get stats for specific date
 */
export async function getStats(dateKey) {
  const key = `stats_${dateKey}`;
  const data = await chrome.storage.local.get(key);
  return data[key] || {};
}

/**
 * Get alerts for specific date
 */
export async function getAlerts(dateKey) {
  const key = `alerts_${dateKey}`;
  const data = await chrome.storage.local.get(key);
  return data[key] || {};
}

/**
 * Set alert as shown
 */
export async function setAlertShown(dateKey, domain) {
   // Minimal lock for this simple toggle
   await navigator.locks.request(LOCK_NAME, async () => {
     const key = `alerts_${dateKey}`;
     const data = await chrome.storage.local.get(key);
     const alerts = data[key] || {};
     alerts[domain] = true;
     await chrome.storage.local.set({ [key]: alerts });
   });
}
