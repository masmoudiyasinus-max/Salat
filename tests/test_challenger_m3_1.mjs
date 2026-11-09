/**
 * Challenger M3_1 Empirical Stress & Adversarial Test Harness
 *
 * Verifies Milestone 3 Invariants:
 * 1. Dynamic/Static import resolution & circular dependency absence for geminiApi.js & muneerSignalService.js.
 * 2. Native execution of node tests/regression_suite.mjs across diverse working directories & environments.
 * 3. Bundle chunk integrity: asserts vendor and pdfjs chunks exist in dist/ and app chunk sizes are < 500 kB.
 * 4. Local-first privacy hygiene & full data reset in backupStorage.js (IndexedDB + localStorage purge).
 */

import { register } from 'node:module';
register('./loader.mjs', import.meta.url);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('======================================================================');
console.log('🔥 CHALLENGER M3_1: EMPIRICAL STRESS & ADVERSARIAL TEST HARNESS');
console.log('======================================================================\n');

// ----------------------------------------------------------------------------
// HIGH-FIDELITY MOCK ENVIRONMENT SETUP
// ----------------------------------------------------------------------------
class MockStorage {
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this, key) ? this[key] : null;
  }
  setItem(key, value) {
    this[key] = String(value);
  }
  removeItem(key) {
    delete this[key];
  }
  clear() {
    for (const key of Object.keys(this)) {
      if (typeof this[key] !== 'function' && key !== 'length') {
        delete this[key];
      }
    }
  }
}

const mockStorage = new MockStorage();
globalThis.localStorage = mockStorage;

const dispatchedEvents = [];
class MockCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}
globalThis.CustomEvent = MockCustomEvent;

const deletedIndexedDatabases = [];
const mockIndexedDB = {
  deleteDatabase(name) {
    deletedIndexedDatabases.push(name);
    return {
      onsuccess: null,
      onerror: null,
      onblocked: null,
    };
  },
  open(name, version) {
    const req = {
      onsuccess: null,
      onerror: null,
      result: {
        transaction() {
          return {
            objectStore() {
              return {
                getAll() {
                  const getReq = { onsuccess: null, onerror: null, result: [] };
                  setTimeout(() => { if (getReq.onsuccess) getReq.onsuccess({ target: getReq }); }, 0);
                  return getReq;
                },
              };
            },
          };
        },
      },
    };
    setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
    return req;
  },
};
globalThis.indexedDB = mockIndexedDB;

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    localStorage: mockStorage,
    indexedDB: mockIndexedDB,
    dispatchEvent(event) {
      dispatchedEvents.push(event);
      return true;
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

let passCount = 0;
let failCount = 0;
const failureDetails = [];

async function challenge(testName, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    console.log(`  ✓ PASS: ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${testName}`);
    console.error(`    Error: ${err.message}`);
    failureDetails.push({ testName, error: err });
    failCount++;
  }
}

// ----------------------------------------------------------------------------
// SUITE 1: MODULE GRAPH & CIRCULAR DEPENDENCY ABSENCE
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 1: Module Graph & Circular Dependency Absence ---');

await challenge('1.1: muneerSignalService.js uses static import for sendMuneerSignalPrompt from geminiApi.js', () => {
  const filePath = path.join(ROOT_DIR, 'src', 'services', 'muneerSignalService.js');
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify static import statement at top
  const staticImportRegex = /import\s*\{\s*sendMuneerSignalPrompt\s*\}\s*from\s*['"]\.\/geminiApi(?:\.js)?['"]/;
  assert.ok(staticImportRegex.test(content), 'muneerSignalService.js must have static import for sendMuneerSignalPrompt');

  // Verify dynamic import await import('./geminiApi.js') is REMOVED
  const dynamicImportRegex = /await\s+import\s*\(\s*['"]\.\/geminiApi(?:\.js)?['"]\s*\)/;
  assert.ok(!dynamicImportRegex.test(content), 'Dynamic import of geminiApi.js should be eliminated to avoid Vite warnings');
});

await challenge('1.2: geminiApi.js does not import muneerSignalService.js directly or dynamically', () => {
  const filePath = path.join(ROOT_DIR, 'src', 'services', 'geminiApi.js');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.ok(!content.includes('muneerSignalService'), 'geminiApi.js must NOT reference muneerSignalService to prevent cycles');
  assert.ok(!content.includes('muneerSignal'), 'geminiApi.js must not import muneerSignal modules');
});

await challenge('1.3: Directed Acyclic Graph (DAG) cycle detection across all services', () => {
  const servicesDir = path.join(ROOT_DIR, 'src', 'services');

  function getJsFiles(dir) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(getJsFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx'))) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const allServiceFiles = getJsFiles(servicesDir);
  const adj = new Map();

  for (const file of allServiceFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const imports = [];
    const importRegex = /(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('.')) {
        const resolved = path.resolve(path.dirname(file), importPath);
        const resolvedWithExt = fs.existsSync(resolved) ? resolved :
          fs.existsSync(resolved + '.js') ? resolved + '.js' :
          fs.existsSync(resolved + '.jsx') ? resolved + '.jsx' : null;
        if (resolvedWithExt && resolvedWithExt.startsWith(servicesDir)) {
          imports.push(resolvedWithExt);
        }
      }
    }
    adj.set(file, imports);
  }

  // Tarjan's cycle detection
  const visited = new Set();
  const recursionStack = new Set();
  const cyclesFound = [];

  function detectCycle(node, currentPath) {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        detectCycle(neighbor, [...currentPath, neighbor]);
      } else if (recursionStack.has(neighbor)) {
        cyclesFound.push([...currentPath, neighbor].map(f => path.basename(f)).join(' -> '));
      }
    }

    recursionStack.delete(node);
  }

  for (const file of allServiceFiles) {
    if (!visited.has(file)) {
      detectCycle(file, [file]);
    }
  }

  assert.equal(cyclesFound.length, 0, `Circular dependencies detected in src/services: ${cyclesFound.join('; ')}`);
});

await challenge('1.4: Dynamic ESM import evaluation of muneerSignalService.js & geminiApi.js', async () => {
  const geminiModule = await import('../src/services/geminiApi.js');
  const signalModule = await import('../src/services/muneerSignalService.js');

  assert.equal(typeof geminiModule.sendMuneerSignalPrompt, 'function', 'sendMuneerSignalPrompt must be an exported function');
  assert.equal(typeof geminiModule.fetchAvailableGeminiModels, 'function', 'fetchAvailableGeminiModels must be an exported function');
  assert.equal(typeof signalModule.dispatchMuneerSignal, 'function', 'dispatchMuneerSignal must be an exported function');
  assert.ok(signalModule.MUNEER_SIGNALS && typeof signalModule.MUNEER_SIGNALS === 'object', 'MUNEER_SIGNALS object must be exported');
  assert.ok(signalModule.SPEED_SIGNALS instanceof Set, 'SPEED_SIGNALS must be an exported Set');
});

await challenge('1.5: Temporal Dead Zone (TDZ) reverse import order test', async () => {
  const [sigMod, gemMod] = await Promise.all([
    import('../src/services/muneerSignalService.js'),
    import('../src/services/geminiApi.js'),
  ]);
  assert.ok(sigMod.MUNEER_SIGNALS.PRAYER_EXPIRY_RISK);
  assert.ok(gemMod.sendMuneerSignalPrompt);
});

// ----------------------------------------------------------------------------
// SUITE 2: BEHAVIORAL & OPERATIONAL INVARIANTS
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Behavioral & Operational Invariants ---');

const { sendMuneerSignalPrompt } = await import('../src/services/geminiApi.js');
const {
  dispatchMuneerSignal,
  MUNEER_SIGNALS,
  SPEED_SIGNALS,
  getStoredSpeedAlertDate,
} = await import('../src/services/muneerSignalService.js');
const { KEYS } = await import('../src/services/storage/storageKeys.js');

await challenge('2.1: sendMuneerSignalPrompt gracefully rejects missing/empty API key', async () => {
  const resNull = await sendMuneerSignalPrompt(null, 'Test cue');
  assert.equal(resNull.success, false);
  assert.ok(resNull.error.includes('missing') || resNull.error.includes('Gemini API Key'));

  const resEmpty = await sendMuneerSignalPrompt('   ', 'Test cue');
  assert.equal(resEmpty.success, false);
});

await challenge('2.2: sendMuneerSignalPrompt succeeds with valid mock response', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (url.includes('models?key=')) {
        return {
          ok: true,
          json: async () => ({
            models: [{ name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] }],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'يا بني، احرص على صلاتك في وقتها ففيها البركة والسكينة.' }],
              },
            },
          ],
        }),
      };
    };

    const res = await sendMuneerSignalPrompt('dummy-api-key', 'الصلاة قاربت على الانتهاء');
    assert.equal(res.success, true);
    assert.ok(res.text.includes('يا بني'));
    assert.equal(res.modelUsed, 'gemini-2.0-flash');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await challenge('2.3: sendMuneerSignalPrompt falls back gracefully when all models fail', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (url.includes('models?key=')) {
        return {
          ok: true,
          json: async () => ({
            models: [{ name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] }],
          }),
        };
      }
      return { ok: false, status: 500 };
    };

    const res = await sendMuneerSignalPrompt('dummy-key', 'Test prompt');
    assert.equal(res.success, false);
    assert.equal(res.error, 'All models failed to generate response');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await challenge('2.4: dispatchMuneerSignal skips speed signals when already alerted today', async () => {
  mockStorage.clear();
  const todayStr = new Date().toISOString().slice(0, 10);
  mockStorage.setItem('muneer_last_speed_alert_date', todayStr);

  assert.equal(getStoredSpeedAlertDate(), todayStr);

  // Dispatch a speed signal on the same date
  const result = await dispatchMuneerSignal(MUNEER_SIGNALS.RAPID_TAB_NAVIGATION, { count: 5 });

  // Must be rejected with reason 'daily_speed_limit_reached'
  assert.equal(result.success, false);
  assert.equal(result.reason, 'daily_speed_limit_reached');
});

await challenge('2.5: dispatchMuneerSignal enforces cooldown timer for prayer expiry risk', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'حفظك الله يا بني، لا تنس صلاتك.' }] } }],
      }),
    });

    mockStorage.setItem(KEYS.SETTINGS, JSON.stringify({ geminiApiKey: 'test-key-valid' }));

    const res1 = await dispatchMuneerSignal(MUNEER_SIGNALS.PRAYER_EXPIRY_RISK, {
      prayerNameAr: 'العصر',
      remainingMinutes: 10,
    });
    assert.ok(res1 !== null && res1.success);
    assert.ok(res1.message?.text);

    // Immediate second call should be blocked by the 15-min cooldown
    const res2 = await dispatchMuneerSignal(MUNEER_SIGNALS.PRAYER_EXPIRY_RISK, {
      prayerNameAr: 'العصر',
      remainingMinutes: 10,
    });
    assert.equal(res2.success, false);
    assert.equal(res2.reason, 'on_cooldown');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ----------------------------------------------------------------------------
// SUITE 3: NATIVE EXECUTION OF TESTS/REGRESSION_SUITE.MJS ACROSS CONTEXTS
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Native Execution of tests/regression_suite.mjs Across Contexts ---');

await challenge('3.1: Native execution from project root (node tests/regression_suite.mjs)', () => {
  const output = execSync('node tests/regression_suite.mjs', {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  assert.ok(output.includes('REGRESSION SUITE COMPLETE: 62/62 TESTS PASSED'), 'Root invocation must pass 62/62');
  assert.ok(output.includes('ALL SUITES PASSED CLEANLY WITH ZERO REGRESSIONS'), 'Root invocation must report clean pass');
});

await challenge('3.2: Native execution from tests/ subfolder (node regression_suite.mjs)', () => {
  const testsDir = path.join(ROOT_DIR, 'tests');
  const output = execSync('node regression_suite.mjs', {
    cwd: testsDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  assert.ok(output.includes('REGRESSION SUITE COMPLETE: 62/62 TESTS PASSED'), 'Subfolder invocation must pass 62/62');
});

await challenge('3.3: Native execution from parent directory with relative path', () => {
  const parentDir = path.dirname(ROOT_DIR);
  const baseName = path.basename(ROOT_DIR);
  const cmd = `node "${path.join(baseName, 'tests', 'regression_suite.mjs')}"`;
  const output = execSync(cmd, {
    cwd: parentDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  assert.ok(output.includes('REGRESSION SUITE COMPLETE: 62/62 TESTS PASSED'), 'Parent directory invocation must pass 62/62');
});

await challenge('3.4: tests/loader.mjs resolves and loads .md?raw with high fidelity', async () => {
  const loader = await import('./loader.mjs');
  assert.equal(typeof loader.resolve, 'function', 'loader must export resolve hook');
  assert.equal(typeof loader.load, 'function', 'loader must export load hook');

  // Verify resolve hook recognizes .md?raw
  const resolved = await loader.resolve('../../muneer.md?raw', {
    parentURL: `file:///${ROOT_DIR.replace(/\\/g, '/')}/src/services/geminiApi.js`,
  }, () => ({ url: 'fallback' }));

  assert.equal(resolved.format, 'module');
  assert.equal(resolved.shortCircuit, true);
  assert.ok(resolved.url.includes('muneer.md'));

  // Verify load hook reads file content
  const loaded = await loader.load(resolved.url, {}, () => ({ source: 'fallback' }));
  assert.equal(loaded.format, 'module');
  assert.equal(loaded.shortCircuit, true);
  assert.ok(loaded.source.startsWith('export default '));
  assert.ok(loaded.source.includes('الشيخ منير') || loaded.source.includes('مُنير'));
});

// ----------------------------------------------------------------------------
// SUITE 4: BUNDLE CHUNK INTEGRITY, MANUAL CHUNKING & SIZE INVARIANTS
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Bundle Chunk Integrity & Size Invariants ---');

await challenge('4.1: vite.config.js manualChunks is a Rolldown-compatible function', async () => {
  const configPath = path.join(ROOT_DIR, 'vite.config.js');
  const content = fs.readFileSync(configPath, 'utf8');

  // Rolldown strictly requires function syntax, not object
  assert.ok(/manualChunks\s*\(\s*id\s*\)/.test(content), 'manualChunks must be defined as a function for Rolldown');
  assert.ok(content.includes("'pdfjs'"), "manualChunks must isolate pdfjs");
  assert.ok(content.includes("'vendor'"), "manualChunks must isolate vendor");
});

await challenge('4.2: vite.config.js manualChunks logic unit test', async () => {
  const viteConfigModule = await import('../vite.config.js');
  const manualChunks = viteConfigModule.default?.build?.rollupOptions?.output?.manualChunks;
  assert.equal(typeof manualChunks, 'function', 'manualChunks must be exported function in build output');

  assert.equal(manualChunks('/path/to/node_modules/pdfjs-dist/build/pdf.js'), 'pdfjs');
  assert.equal(manualChunks('/path/to/node_modules/react/index.js'), 'vendor');
  assert.equal(manualChunks('/path/to/node_modules/react-dom/client.js'), 'vendor');
  assert.equal(manualChunks('/path/to/src/App.jsx'), undefined);
});

await challenge('4.3: Production build assets exist in dist/assets and build/', () => {
  const distAssetsDir = path.join(ROOT_DIR, 'dist', 'assets');
  assert.ok(fs.existsSync(distAssetsDir), 'dist/assets directory must exist');

  const files = fs.readdirSync(distAssetsDir);

  const vendorChunk = files.find(f => f.startsWith('vendor-') && f.endsWith('.js'));
  const pdfjsChunk = files.find(f => f.startsWith('pdfjs-') && f.endsWith('.js'));
  const indexChunk = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
  const rolldownChunk = files.find(f => f.startsWith('rolldown-runtime-') && f.endsWith('.js'));

  assert.ok(vendorChunk, 'vendor chunk must exist in dist/assets');
  assert.ok(pdfjsChunk, 'pdfjs chunk must exist in dist/assets');
  assert.ok(indexChunk, 'index chunk must exist in dist/assets');
  assert.ok(rolldownChunk, 'rolldown-runtime chunk must exist in dist/assets');
});

await challenge('4.4: All production JavaScript chunks are strictly under 500 kB', () => {
  const distAssetsDir = path.join(ROOT_DIR, 'dist', 'assets');
  const files = fs.readdirSync(distAssetsDir);

  const MAX_CHUNK_BYTES = 500 * 1024; // 512,000 bytes (500 KiB)
  const chunkSizes = {};

  for (const file of files) {
    if (file.endsWith('.js')) {
      const filePath = path.join(distAssetsDir, file);
      const stat = fs.statSync(filePath);
      chunkSizes[file] = stat.size;

      assert.ok(
        stat.size < MAX_CHUNK_BYTES,
        `Chunk ${file} is ${stat.size} bytes, which exceeds 500 kB limit (${MAX_CHUNK_BYTES} bytes)`
      );
    }
  }

  console.log(`    Chunk sizes verified:`);
  for (const [name, bytes] of Object.entries(chunkSizes)) {
    console.log(`      • ${name}: ${(bytes / 1024).toFixed(2)} kB`);
  }
});

await challenge('4.5: dist/index.html links chunks and modulepreloads with zero corruption', () => {
  const htmlPath = path.join(ROOT_DIR, 'dist', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('<script type="module" crossorigin src="/assets/index-'), 'index.html must include index script tag');
  assert.ok(html.includes('href="/assets/vendor-'), 'index.html must preload vendor chunk');
  assert.ok(html.includes('href="/assets/pdfjs-'), 'index.html must preload pdfjs chunk');
  assert.ok(html.includes('href="/assets/rolldown-runtime-'), 'index.html must preload rolldown runtime');
});

await challenge('4.6: npm run build produces 0 INEFFECTIVE_DYNAMIC_IMPORT warnings and 0 chunk warnings', () => {
  const output = execSync('npm run build', {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  assert.ok(!output.includes('[INEFFECTIVE_DYNAMIC_IMPORT]'), 'Build output must have 0 INEFFECTIVE_DYNAMIC_IMPORT warnings');
  assert.ok(!output.includes('Some chunks are larger than 500 kB'), 'Build output must have 0 chunk size warnings');
  assert.ok(output.includes('built in'), 'Build must complete successfully');
});

// ----------------------------------------------------------------------------
// SUITE 5: LOCAL-FIRST PRIVACY RESET INVARIANTS (backupStorage.js)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Local-First Privacy Reset Invariants (backupStorage.js) ---');

const backupStorage = await import('../src/services/storage/backupStorage.js');
const { APP_EVENTS } = await import('../src/services/prayerConstants.js');

await challenge('5.1: backupStorage exports both clearEntireAppData and clearAllUserData', () => {
  assert.equal(typeof backupStorage.clearEntireAppData, 'function', 'clearEntireAppData must be exported');
  assert.equal(typeof backupStorage.clearAllUserData, 'function', 'clearAllUserData alias must be exported');
});

await challenge('5.2: clearEntireAppData purges localStorage keys and wildcards', () => {
  mockStorage.clear();
  mockStorage.setItem(KEYS.SETTINGS, '{"test":1}');
  mockStorage.setItem(KEYS.TIMES, '{"fajr":"05:00"}');
  mockStorage.setItem(KEYS.CHAT_SESSIONS, '[]');
  mockStorage.setItem(KEYS.ACTIVE_SESSION_ID, 'sess-123');
  mockStorage.setItem(KEYS.RE_TOGGLE_HISTORY, '[]');
  mockStorage.setItem('bg_rejected_imgs_123', '["bad.jpg"]');
  mockStorage.setItem('active_bg_custom', 'custom.jpg');
  mockStorage.setItem(KEYS.RECORDS, '[]');

  backupStorage.clearEntireAppData();

  assert.equal(mockStorage.getItem(KEYS.SETTINGS), null);
  assert.equal(mockStorage.getItem(KEYS.TIMES), null);
  assert.equal(mockStorage.getItem(KEYS.CHAT_SESSIONS), null);
  assert.equal(mockStorage.getItem(KEYS.ACTIVE_SESSION_ID), null);
  assert.equal(mockStorage.getItem(KEYS.RE_TOGGLE_HISTORY), null);
  assert.equal(mockStorage.getItem('bg_rejected_imgs_123'), null);
  assert.equal(mockStorage.getItem('active_bg_custom'), null);
  assert.equal(mockStorage.getItem(KEYS.RECORDS), null);
});

await challenge('5.3: clearEntireAppData triggers IndexedDB purge for Books and Audio DBs', () => {
  deletedIndexedDatabases.length = 0;
  backupStorage.clearEntireAppData();

  assert.ok(deletedIndexedDatabases.includes('HabitTracker_BooksDB'), 'HabitTracker_BooksDB must be purged');
  assert.ok(deletedIndexedDatabases.includes('HabitTracker_AudioDB'), 'HabitTracker_AudioDB must be purged');
});

await challenge('5.4: clearEntireAppData dispatches all 4 application update events', () => {
  dispatchedEvents.length = 0;
  backupStorage.clearAllUserData();

  const eventTypes = dispatchedEvents.map(e => e.type);
  assert.ok(eventTypes.includes(APP_EVENTS.RECORDS_UPDATED), 'records-updated event must be dispatched');
  assert.ok(eventTypes.includes(APP_EVENTS.NAFL_RECORDS_UPDATED), 'nafl-records-updated event must be dispatched');
  assert.ok(eventTypes.includes(APP_EVENTS.SETTINGS_UPDATED), 'settings-updated event must be dispatched');
  assert.ok(eventTypes.includes(APP_EVENTS.PRAYER_TIMES_UPDATED), 'prayer-times-updated event must be dispatched');
});

await challenge('5.5: clearEntireAppData survives environments where indexedDB throws', () => {
  const faultyIndexedDB = {
    deleteDatabase() {
      throw new Error('Sandbox SecurityError: IndexedDB not allowed');
    },
  };
  globalThis.indexedDB = faultyIndexedDB;
  if (globalThis.window) globalThis.window.indexedDB = faultyIndexedDB;

  try {
    // Must NOT throw
    assert.doesNotThrow(() => {
      backupStorage.clearEntireAppData();
    }, 'clearEntireAppData must gracefully handle throwing indexedDB');
  } finally {
    globalThis.indexedDB = mockIndexedDB;
    if (globalThis.window) globalThis.window.indexedDB = mockIndexedDB;
  }
});

// ----------------------------------------------------------------------------
// FINAL SUMMARY
// ----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`🏁 CHALLENGER M3_1 SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('======================================================================\n');

if (failCount > 0) {
  console.error('❌ FAILURES ENCOUNTERED:');
  for (const f of failureDetails) {
    console.error(` - ${f.testName}: ${f.error.message}`);
  }
  process.exit(1);
} else {
  console.log(`🎉 ALL ${passCount} EMPIRICAL CHALLENGE TESTS PASSED CLEANLY WITH ZERO REGRESSIONS.`);
  process.exit(0);
}
