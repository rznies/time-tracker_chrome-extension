import { formatDuration, getDateKey, sanitizeForCsv } from '../utils.js';

// --- State ---
let currentTab = 'overview';

// --- Navigation ---
document.querySelectorAll('.nav-links li').forEach(item => {
  item.addEventListener('click', () => {
    // UI Update
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    item.classList.add('active');
    
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    const tabId = item.getAttribute('data-tab');
    document.getElementById(tabId).classList.add('active');
    currentTab = tabId;

    loadTabContent(tabId);
  });
});

async function loadTabContent(tabId) {
  if (tabId === 'overview') loadOverview();
  else if (tabId === 'breakdown') loadBreakdown();
  else if (tabId === 'limits') loadLimits();
  else if (tabId === 'export') { /* Static mostly */ }
  else if (tabId === 'settings') loadSettings();
}

// --- Overview ---
async function loadOverview() {
  const now = new Date();
  const dateKey = getDateKey(now.getTime());
  
  // 1. Today's Total
  const todayData = await chrome.storage.local.get(`stats_${dateKey}`);
  const todayStats = todayData[`stats_${dateKey}`] || {};
  let todaySeconds = Object.values(todayStats).reduce((a, b) => a + b, 0);
  
  document.getElementById('overview-today').textContent = formatDuration(todaySeconds);

  // 2. Weekly & Chart
  const allData = await chrome.storage.local.get(null);
  let weekSeconds = 0;
  const chartData = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = getDateKey(d.getTime());
    
    const dayStats = allData[`stats_${k}`] || {};
    const dayTotal = Object.values(dayStats).reduce((a, b) => a + b, 0);
    
    weekSeconds += dayTotal;
    chartData.push({ date: k, total: dayTotal, label: i === 0 ? 'Today' : k.slice(5) });
  }

  document.getElementById('overview-week').textContent = formatDuration(weekSeconds);
  renderChart(chartData);
}

function renderChart(data) {
  const container = document.getElementById('activity-chart');
  container.innerHTML = '';
  
  const max = Math.max(...data.map(d => d.total), 3600); // Min scale 1h

  data.forEach(item => {
    const group = document.createElement('div');
    group.className = 'chart-bar-group';
    
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    const pct = (item.total / max) * 100;
    bar.style.height = `${pct}%`;
    bar.title = `${item.date}: ${formatDuration(item.total)}`;
    
    const label = document.createElement('div');
    label.className = 'chart-label';
    label.textContent = item.label;

    group.appendChild(bar);
    group.appendChild(label);
    container.appendChild(group);
  });
}

// --- Breakdown ---
async function loadBreakdown() {
  const picker = document.getElementById('breakdown-date');
  if (!picker.value) {
    picker.valueAsDate = new Date(); // Default today
  }
  
  const dateKey = picker.value;
  const statsKey = `stats_${dateKey}`;
  const pathsKey = `paths_${dateKey}`;
  
  const data = await chrome.storage.local.get([statsKey, pathsKey]);
  const stats = data[statsKey] || {};
  const paths = data[pathsKey] || {};
  
  const tbody = document.querySelector('#breakdown-table tbody');
  tbody.innerHTML = '';
  
  const totalDaySeconds = Object.values(stats).reduce((a, b) => a + b, 0);
  
  // Sort by duration desc
  const sortedDomains = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  
  sortedDomains.forEach(([domain, seconds]) => {
    const tr = document.createElement('tr');
    
    const pct = totalDaySeconds ? ((seconds / totalDaySeconds) * 100).toFixed(1) : 0;
    
    // Domain Cell
    const tdDomain = document.createElement('td');
    const spanDomain = document.createElement('span');
    spanDomain.style.fontWeight = '500';
    spanDomain.textContent = domain;
    tdDomain.appendChild(spanDomain);
    
    // Time Cell
    const tdTime = document.createElement('td');
    tdTime.textContent = formatDuration(seconds);
    
    // Percent Cell
    const tdPct = document.createElement('td');
    tdPct.textContent = `${pct}%`;
    
    // Actions Cell
    const tdActions = document.createElement('td');
    const btnExpand = document.createElement('button');
    btnExpand.className = 'btn-expand';
    btnExpand.dataset.domain = domain;
    btnExpand.textContent = 'Expand';
    tdActions.appendChild(btnExpand);
    
    tr.appendChild(tdDomain);
    tr.appendChild(tdTime);
    tr.appendChild(tdPct);
    tr.appendChild(tdActions);
    
    tbody.appendChild(tr);

    // Expand logic
    btnExpand.addEventListener('click', (e) => {
      if (btnExpand.textContent === 'Expand') {
        renderPathRows(tr, domain, paths[domain]);
        btnExpand.textContent = 'Collapse';
      } else {
        removePathRows(tr);
        btnExpand.textContent = 'Expand';
      }
    });
  });

  if (sortedDomains.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.style.textAlign = 'center';
    td.textContent = 'No data for this date.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

function renderPathRows(parentTr, domain, domainPaths) {
  if (!domainPaths) return; 
  
  const sortedPaths = Object.entries(domainPaths).sort((a, b) => b[1] - a[1]);
  
  // Insert after parentTr
  let refNode = parentTr;
  
  sortedPaths.forEach(([path, seconds]) => {
    const tr = document.createElement('tr');
    tr.className = 'path-row expanded-row';
    tr.setAttribute('data-parent', domain);
    
    const tdPath = document.createElement('td');
    tdPath.textContent = path;
    
    const tdTime = document.createElement('td');
    tdTime.textContent = formatDuration(seconds);
    
    const tdEmpty = document.createElement('td');
    tdEmpty.colSpan = 2;
    
    tr.appendChild(tdPath);
    tr.appendChild(tdTime);
    tr.appendChild(tdEmpty);
    
    refNode.parentNode.insertBefore(tr, refNode.nextSibling);
    refNode = tr;
  });
}

function removePathRows(parentTr) {
  const domain = parentTr.querySelector('.btn-expand').dataset.domain;
  const rows = document.querySelectorAll(`.path-row[data-parent="${domain}"]`);
  rows.forEach(r => r.remove());
}

document.getElementById('breakdown-date').addEventListener('change', loadBreakdown);

// --- Limits ---
async function loadLimits() {
  const data = await chrome.storage.local.get('limits');
  const limits = data.limits || {};
  
  const list = document.getElementById('limits-list');
  list.innerHTML = '';
  
  Object.entries(limits).forEach(([domain, limitSeconds]) => {
    const div = document.createElement('div');
    div.className = 'stat-card'; // Reuse style
    div.style.marginBottom = '10px';
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.alignItems = 'center';
    
    const textDiv = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = domain;
    textDiv.appendChild(strong);
    textDiv.append(`: ${limitSeconds / 60} minutes`);
    
    const btn = document.createElement('button');
    btn.className = 'danger btn-del-limit';
    btn.dataset.domain = domain;
    btn.textContent = 'Delete';
    
    div.appendChild(textDiv);
    div.appendChild(btn);
    list.appendChild(div);
  });

  document.querySelectorAll('.btn-del-limit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const d = e.target.dataset.domain;
      delete limits[d];
      await chrome.storage.local.set({ limits });
      loadLimits();
    });
  });
}

document.getElementById('btn-add-limit').addEventListener('click', async () => {
  const domainInput = document.getElementById('limit-domain');
  const minutesInput = document.getElementById('limit-minutes');
  
  const domain = domainInput.value.trim();
  const mins = parseInt(minutesInput.value);
  
  if (domain && mins > 0) {
    const data = await chrome.storage.local.get('limits');
    const limits = data.limits || {};
    limits[domain] = mins * 60;
    await chrome.storage.local.set({ limits });
    
    domainInput.value = '';
    minutesInput.value = '';
    loadLimits();
  }
});

// --- Export ---
document.getElementById('btn-export-csv').addEventListener('click', async () => {
  const allData = await chrome.storage.local.get(null);
  let csvContent = "Date,Domain,Duration (seconds),Duration (formatted),Percentage of Day\n";
  
  // Get all date keys sorted
  const keys = Object.keys(allData).filter(k => k.startsWith('stats_')).sort();
  
  keys.forEach(key => {
    const date = key.replace('stats_', '');
    const stats = allData[key];
    const totalDay = Object.values(stats).reduce((a,b)=>a+b,0);
    
    Object.entries(stats).forEach(([domain, seconds]) => {
      const pct = totalDay ? ((seconds / totalDay) * 100).toFixed(2) + '%' : '0%';
      // Formula Injection Prevention
      const safeDomain = sanitizeForCsv(domain);
      const row = `"${date}","${safeDomain}","${seconds}","${formatDuration(seconds)}","${pct}"`;
      csvContent += row + "\n";
    });
  });
  
  downloadFile(csvContent, 'tracker_export.csv', 'text/csv');
});

document.getElementById('btn-export-json').addEventListener('click', async () => {
  const allData = await chrome.storage.local.get(null);
  const exportObj = {
    exportDate: new Date().toISOString(),
    data: []
  };

  const keys = Object.keys(allData).filter(k => k.startsWith('stats_')).sort();
  
  keys.forEach(key => {
    const date = key.replace('stats_', '');
    const stats = allData[key];
    const paths = allData[`paths_${date}`] || {};
    
    Object.entries(stats).forEach(([domain, seconds]) => {
      exportObj.data.push({
        date,
        domain,
        durationSeconds: seconds,
        paths: paths[domain] || {}
      });
    });
  });

  downloadFile(JSON.stringify(exportObj, null, 2), 'tracker_export.json', 'application/json');
});

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Settings ---
async function loadSettings() {
  const data = await chrome.storage.local.get('settings');
  const settings = data.settings || { retentionDays: 7 };
  document.getElementById('setting-retention').value = settings.retentionDays;
}

document.getElementById('setting-retention').addEventListener('change', async (e) => {
  const days = parseInt(e.target.value);
  const data = await chrome.storage.local.get('settings');
  const settings = data.settings || {};
  settings.retentionDays = days;
  await chrome.storage.local.set({ settings });
});

document.getElementById('btn-clear-data').addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear ALL tracking data? This cannot be undone.')) {
    await chrome.storage.local.clear();
    alert('Data cleared.');
    loadOverview();
  }
});

// Init
document.addEventListener('DOMContentLoaded', () => loadTabContent('overview'));