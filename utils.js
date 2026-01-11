// utils.js - Shared helper functions

export const BLOCK_LIST = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'file://'
];

/**
 * Extract and normalize domain from URL
 * @param {string} urlString 
 * @returns {string|null} Normalized domain or null if blocked/invalid
 */
export function normalizeDomain(urlString) {
  if (!urlString) return null;

  // Check blocklist
  for (const block of BLOCK_LIST) {
    if (urlString.startsWith(block)) return null;
  }

  try {
    const url = new URL(urlString);
    let hostname = url.hostname.toLowerCase();
    
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    
    return hostname;
  } catch (e) {
    return null;
  }
}

/**
 * Extract path without query params or hash
 * @param {string} urlString 
 * @returns {string} Normalized path or '/'
 */
export function normalizePath(urlString) {
  if (!urlString) return '/';

  try {
    const url = new URL(urlString);
    return url.pathname || '/';
  } catch (e) {
    return '/';
  }
}

/**
 * Get YYYY-MM-DD date key from timestamp
 * @param {number} timestamp 
 * @returns {string}
 */
export function getDateKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format duration in seconds to "1h 4m 7s"
 * @param {number} seconds 
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (!seconds) return '0s';
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  
  return parts.join(' ');
}

/**
 * Sanitize cell content for CSV to prevent formula injection
 * @param {string} content 
 * @returns {string}
 */
export function sanitizeForCsv(content) {
  const str = String(content);
  if (/^[=+\-@]/.test(str)) {
    return "'" + str;
  }
  return str;
}

/**
 * Get start of day timestamp
 * @param {number} timestamp 
 * @returns {number}
 */
export function getStartOfDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Get end of day timestamp
 * @param {number} timestamp 
 * @returns {number}
 */
export function getEndOfDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

/**
 * Check if domain matches limit pattern
 * @param {string} domain 
 * @param {string} pattern 
 * @returns {boolean}
 */
export function matchesDomain(domain, pattern) {
  if (domain === pattern) return true;
  if (domain.endsWith('.' + pattern)) return true;
  return false;
}
