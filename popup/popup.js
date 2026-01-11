import { formatDuration, getDateKey } from '../utils.js';

let intervalId = null;

async function updateState() {
  // 1. Get Active Session
  const sessionData = await chrome.storage.session.get('activeSession');
  const session = sessionData.activeSession;

  const currentDomainEl = document.getElementById('current-domain');
  const currentTimeEl = document.getElementById('current-time');

  let activeSeconds = 0;

  if (session && session.domain) {
    const now = Date.now();
    // Calculate live duration: (lastHeartbeat - start) + (now - lastHeartbeat)
    // Actually, we store startTime. But to be consistent with storage commits, 
    // we should look at accumulated stats + current delta?
    // Simplified for popup: just show how long this *current session* has been active.
    activeSeconds = Math.floor((now - session.startTime) / 1000);
    
    currentDomainEl.textContent = session.domain;
    currentDomainEl.title = session.domain + session.currentPath;
    currentTimeEl.textContent = formatDuration(activeSeconds);
  } else {
    currentDomainEl.textContent = 'No active session';
    currentTimeEl.textContent = '--';
  }

  // 2. Get Today's Total
  const dateKey = getDateKey(Date.now());
  const statsKey = `stats_${dateKey}`;
  const localData = await chrome.storage.local.get(statsKey);
  const stats = localData[statsKey] || {};

  let totalSeconds = 0;
  for (const sec of Object.values(stats)) {
    totalSeconds += sec;
  }
  
  // Add active session time to total if applicable (for live feeling)
  if (session && session.domain) {
     // We need to be careful not to double count. 
     // The stats are updated on heartbeat.
     // So we only add (now - lastHeartbeat).
     const delta = Math.floor((Date.now() - session.lastHeartbeat) / 1000);
     if (delta > 0) totalSeconds += delta;
  }

  document.getElementById('today-total').textContent = formatDuration(totalSeconds);
}

document.addEventListener('DOMContentLoaded', () => {
  updateState();
  intervalId = setInterval(updateState, 1000);

  document.getElementById('btn-dashboard').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

window.addEventListener('unload', () => {
  if (intervalId) clearInterval(intervalId);
});
