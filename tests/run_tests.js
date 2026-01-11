
import assert from 'assert';
import * as utils from '../utils.js';

// --- Global Mocks Setup ---
const store = {
  local: {},
  session: {}
};

global.chrome = {
  storage: {
    local: {
      get: async (key) => {
        if (key === null) return store.local; // Get all
        if (Array.isArray(key)) {
          const res = {};
          key.forEach(k => res[k] = store.local[k]);
          return res;
        }
        return { [key]: store.local[key] };
      },
      set: async (obj) => {
        Object.assign(store.local, obj);
      },
      remove: async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(k => delete store.local[k]);
      },
      clear: async () => { store.local = {}; }
    },
    session: {
      get: async (key) => {
        return { [key]: store.session[key] };
      },
      set: async (obj) => {
        Object.assign(store.session, obj);
      }
    }
  }
};

global.navigator = {
  locks: {
    request: async (name, callback) => {
      // Simple mock: just execute immediately
      return await callback();
    }
  }
};

// Import storage AFTER mocks are set
const storage = await import('../storage.js');

// --- Helpers ---
const LOG_PASS = (msg) => console.log(`✅ PASS: ${msg}`);
const LOG_FAIL = (msg, err) => console.error(`❌ FAIL: ${msg}`, err);

async function runTests() {
  console.log('🚀 Starting Automated Logic Tests...\n');
  
  try {
    testNormalization();
    testCsvSanitization();
    await testIncrementalCommit();
    await testMidnightCrossover();
    await testPathCapping();
    await testRetentionCleanup();
    
    console.log('\n✨ All Logic Tests Passed Successfully!');
  } catch (e) {
    console.error('\n💥 Test Suite Failed:', e);
  }
}

// --- Test Cases ---

function testNormalization() {
  // Domain Normalization
  assert.strictEqual(utils.normalizeDomain('https://www.github.com/foo'), 'github.com', 'Should strip www');
  assert.strictEqual(utils.normalizeDomain('http://localhost:8080'), 'localhost', 'Should handle localhost');
  assert.strictEqual(utils.normalizeDomain('chrome://settings'), null, 'Should block chrome://');
  assert.strictEqual(utils.normalizeDomain('about:blank'), null, 'Should block about:');
  
  // Path Normalization
  assert.strictEqual(utils.normalizePath('https://github.com/foo?q=1#top'), '/foo', 'Should strip query and hash');
  assert.strictEqual(utils.normalizePath('https://github.com/'), '/', 'Should default to /');
  
  LOG_PASS('URL Normalization');
}

function testCsvSanitization() {
  assert.strictEqual(utils.sanitizeForCsv('=SUM(1+1)'), "'=SUM(1+1)", 'Should escape =');
  assert.strictEqual(utils.sanitizeForCsv('+123'), "'+123", 'Should escape +');
  assert.strictEqual(utils.sanitizeForCsv('Normal Text'), "Normal Text", 'Should leave normal text');
  
  LOG_PASS('Security: CSV Formula Injection');
}

async function testIncrementalCommit() {
  store.local = {}; // Reset
  const now = 1700000000000; // Arbitrary time
  const lastHeartbeat = now - 60000; // 60s ago
  
  const session = {
    domain: 'test.com',
    currentPath: '/work',
    lastHeartbeat: lastHeartbeat
  };
  
  const dateKey = utils.getDateKey(now);
  
  // Commit 60s
  await storage.updateStats(session, now, true);
  
  const stats = store.local[`stats_${dateKey}`];
  const paths = store.local[`paths_${dateKey}`];
  
  assert.strictEqual(stats['test.com'], 60, 'Domain stats should have 60s');
  assert.strictEqual(paths['test.com']['/work'], 60, 'Path stats should have 60s');
  
  LOG_PASS('Incremental Commit (Basic)');
}

async function testMidnightCrossover() {
  store.local = {}; // Reset
  
  // Setup: 23:59:30 -> 00:00:30 (60s total, split 30/30)
  // Date 1: 2026-01-01
  // Date 2: 2026-01-02
  const date1 = '2026-01-01';
  const date2 = '2026-01-02';
  
  const endOfDay1 = new Date(`${date1}T23:59:59.999Z`).getTime(); 
  // Adjust for local time assumption in code (utils uses getFullYear etc which are local)
  // To verify logic accurately without timezone pain, we rely on the utils helper
  
  // Let's rely on the module's own date logic
  const now = new Date('2026-01-02T00:00:30').getTime();
  const lastHeartbeat = new Date('2026-01-01T23:59:30').getTime();
  
  const session = {
    domain: 'split.com',
    currentPath: '/party',
    lastHeartbeat: lastHeartbeat
  };
  
  await storage.updateStats(session, now, true);
  
  const stats1 = store.local[`stats_${date1}`];
  const stats2 = store.local[`stats_${date2}`];
  
  // Should be roughly 30s each (+/- 1s due to ms rounding)
  // 23:59:30 to 23:59:59.999 is ~29.999s -> 29s or 30s depending on floor
  // 00:00:00 to 00:00:30 is 30s
  
  assert.ok(stats1['split.com'] >= 29 && stats1['split.com'] <= 31, `Day 1 should have ~30s, got ${stats1?.['split.com']}`);
  assert.ok(stats2['split.com'] >= 29 && stats2['split.com'] <= 31, `Day 2 should have ~30s, got ${stats2?.['split.com']}`);
  
  LOG_PASS('Critical: Midnight Crossover Split');
}

async function testPathCapping() {
  store.local = {};
  const now = Date.now();
  const dateKey = utils.getDateKey(now);
  
  const session = {
    domain: 'spam.com',
    currentPath: '', // will change
    lastHeartbeat: now - 1000
  };
  
  // Add 50 unique paths
  for (let i = 0; i < 50; i++) {
    session.currentPath = `/path-${i}`;
    await storage.updateStats(session, now, true);
  }
  
  // Add 51st path
  session.currentPath = '/overflow-path';
  await storage.updateStats(session, now, true);
  
  const paths = store.local[`paths_${dateKey}`]['spam.com'];
  const keys = Object.keys(paths);
  
  assert.strictEqual(keys.length, 51, 'Should have 50 paths + 1 overflow key');
  assert.ok(paths['(other)'] > 0, 'Overflow bucket should contain data');
  assert.strictEqual(paths['/overflow-path'], undefined, 'New path should not exist explicitly');
  
  LOG_PASS('Storage: Path Capping (Max 50)');
}

async function testRetentionCleanup() {
  store.local = {};
  
  // Create old data (10 days ago)
  const oldDate = '2020-01-01';
  store.local[`stats_${oldDate}`] = { 'old.com': 100 };
  
  // Create new data (Today)
  const today = utils.getDateKey(Date.now());
  store.local[`stats_${today}`] = { 'new.com': 100 };
  
  // Run cleanup (keep 7 days)
  await storage.cleanupOldData(7);
  
  assert.strictEqual(store.local[`stats_${oldDate}`], undefined, 'Old data should be deleted');
  assert.ok(store.local[`stats_${today}`], 'New data should be kept');
  
  LOG_PASS('Data Management: Retention Cleanup');
}

runTests();
