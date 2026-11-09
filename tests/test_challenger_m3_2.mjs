/**
 * Challenger M3_2: Empirical Stress & Adversarial Test Harness
 * 
 * Empirically stress-tests:
 * 1. `clearEntireAppData()` and `clearAllUserData()` in `backupStorage.js` with simulated IndexedDB and localStorage environments.
 * 2. Asserts `indexedDB.deleteDatabase` is called for 'HabitTracker_BooksDB' and 'HabitTracker_AudioDB'.
 * 3. Asserts full localStorage purge and CustomEvent dispatches.
 * 4. Asserts tri-state data readiness (`DATA_STATUS`).
 * 5. Adversarial probes & edge cases: single try/catch vulnerability, unpurged keys analysis, SSR/Node safety, corrupted states.
 */

import { register } from 'node:module';
register('./loader.mjs', import.meta.url);

import assert from 'node:assert/strict';

import {
  clearEntireAppData,
  clearAllUserData,
  exportFullUserDataJSON,
  importFullUserDataJSON,
} from '../src/services/storage/backupStorage.js';

import { KEYS } from '../src/services/storage/storageKeys.js';
import { getSettings, DEFAULT_SETTINGS } from '../src/services/storage/settingsStorage.js';
import { getRecords } from '../src/services/storage/historyStorage.js';
import { getPrayerTimesCache, savePrayerTimesCache, DEFAULT_PRAYER_TIMES } from '../src/services/storage/scheduleCacheStorage.js';
import { saveRecords } from '../src/services/storage/historyStorage.js';
import { APP_EVENTS, OBLIGATORY_PRAYER_IDS } from '../src/services/prayerConstants.js';
import { DATA_STATUS, isValidTimeString, getPrayerTimesStatus, getRecordsStatus } from '../src/services/dataReadiness.js';

console.log('======================================================================');
console.log('🔥 CHALLENGER M3_2: EMPIRICAL STRESS & ADVERSARIAL TEST HARNESS');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;
const failureReports = [];

async function challenge(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    Details: ${err.message}`);
    failCount++;
    failureReports.push({ test: name, error: err.message });
  }
}

/**
 * Creates a compliant HTML5 Web Storage mock proxy.
 * Reflects stored keys on Object.keys(storage) just like real browser localStorage.
 */
function createMockStorage() {
  const map = new Map();
  const target = {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
    clear() {
      map.clear();
    },
    key(i) {
      return Array.from(map.keys())[i] || null;
    },
    get length() {
      return map.size;
    },
  };

  return new Proxy(target, {
    get(t, prop, receiver) {
      if (prop in t || typeof prop === 'symbol') {
        return Reflect.get(t, prop, receiver);
      }
      return t.getItem(prop);
    },
    set(t, prop, value, receiver) {
      if (prop in t) {
        return Reflect.set(t, prop, value, receiver);
      }
      t.setItem(prop, value);
      return true;
    },
    deleteProperty(t, prop) {
      if (prop in t) {
        return Reflect.deleteProperty(t, prop);
      }
      t.removeItem(prop);
      return true;
    },
    ownKeys() {
      return Array.from(map.keys());
    },
    getOwnPropertyDescriptor(t, prop) {
      if (map.has(prop)) {
        return {
          value: map.get(prop),
          writable: true,
          enumerable: true,
          configurable: true,
        };
      }
      return Reflect.getOwnPropertyDescriptor(t, prop);
    },
  });
}

/**
 * Creates a mock IndexedDB factory for capturing deleteDatabase calls.
 */
function createMockIndexedDB() {
  const deletedDatabases = [];
  return {
    deletedDatabases,
    deleteDatabase(name) {
      deletedDatabases.push(name);
      return {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
    },
  };
}

/**
 * Creates a mock window environment supporting CustomEvents and EventListeners.
 */
function createMockWindow(storage, idb) {
  const listeners = new Map();
  const dispatchedEvents = [];

  return {
    localStorage: storage,
    indexedDB: idb,
    dispatchedEvents,
    addEventListener(type, cb) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(cb);
    },
    removeEventListener(type, cb) {
      if (!listeners.has(type)) return;
      listeners.set(type, listeners.get(type).filter((fn) => fn !== cb));
    },
    dispatchEvent(evt) {
      dispatchedEvents.push(evt);
      if (listeners.has(evt.type)) {
        for (const cb of listeners.get(evt.type)) {
          cb(evt);
        }
      }
      return true;
    },
  };
}

// ----------------------------------------------------------------------------
// SUITE 1: IndexedDB Reset Invariants & Resilience
// ----------------------------------------------------------------------------
console.log('--- SUITE 1: IndexedDB Deletion Invariants & Resilience ---');

await challenge('1.1 clearEntireAppData calls indexedDB.deleteDatabase for BooksDB and AudioDB', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  clearEntireAppData();

  assert.equal(mockIdb.deletedDatabases.length, 2);
  assert.equal(mockIdb.deletedDatabases[0], 'HabitTracker_BooksDB');
  assert.equal(mockIdb.deletedDatabases[1], 'HabitTracker_AudioDB');
});

await challenge('1.2 clearAllUserData alias invokes identical IndexedDB database purges', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  clearAllUserData();

  assert.equal(mockIdb.deletedDatabases.length, 2);
  assert.equal(mockIdb.deletedDatabases[0], 'HabitTracker_BooksDB');
  assert.equal(mockIdb.deletedDatabases[1], 'HabitTracker_AudioDB');
});

await challenge('1.3 Fallback to globalThis.indexedDB when window is undefined or lacks indexedDB', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();

  delete globalThis.window;
  globalThis.indexedDB = mockIdb;
  globalThis.localStorage = mockStorage;

  clearEntireAppData();

  assert.equal(mockIdb.deletedDatabases.length, 2);
  assert.equal(mockIdb.deletedDatabases[0], 'HabitTracker_BooksDB');
  assert.equal(mockIdb.deletedDatabases[1], 'HabitTracker_AudioDB');

  delete globalThis.indexedDB;
});

await challenge('1.4 Graceful resilience when indexedDB is undefined or null', () => {
  const mockStorage = createMockStorage();
  const mockWin = createMockWindow(mockStorage, null);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;
  delete globalThis.indexedDB;

  assert.doesNotThrow(() => {
    clearEntireAppData();
  });
});

await challenge('1.5 Graceful resilience when indexedDB.deleteDatabase is not a function', () => {
  const mockStorage = createMockStorage();
  const mockWin = createMockWindow(mockStorage, { deleteDatabase: 'NOT_A_FUNCTION' });

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  assert.doesNotThrow(() => {
    clearEntireAppData();
  });
});

await challenge('1.6 Resilience against deleteDatabase throwing synchronously (sandboxed iframe / SecurityError)', () => {
  const mockStorage = createMockStorage();
  const throwingIdb = {
    deleteDatabase() {
      throw new Error('SecurityError: The operation is insecure in sandboxed context.');
    },
  };
  const mockWin = createMockWindow(mockStorage, throwingIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  assert.doesNotThrow(() => {
    clearEntireAppData();
  });
});

await challenge('1.7 Adversarial Invariant: Independent error boundaries for BooksDB and AudioDB deletion', () => {
  // If BooksDB deletion throws an error (e.g. database in use or locked), AudioDB deletion must still be attempted
  const mockStorage = createMockStorage();
  const attemptedCalls = [];
  const partiallyFailingIdb = {
    deleteDatabase(name) {
      attemptedCalls.push(name);
      if (name === 'HabitTracker_BooksDB') {
        throw new Error('Database locked by active connection');
      }
    },
  };
  const mockWin = createMockWindow(mockStorage, partiallyFailingIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  clearEntireAppData();

  assert.ok(
    attemptedCalls.includes('HabitTracker_AudioDB'),
    `AudioDB deletion was skipped because BooksDB threw an error (single try-catch block vulnerability). Attempted calls: ${JSON.stringify(attemptedCalls)}`
  );
});

// ----------------------------------------------------------------------------
// SUITE 2: Full LocalStorage Purge & Pattern-Based Hygiene
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Full LocalStorage Purge & Pattern-Based Hygiene ---');

await challenge('2.1 Purges all core keys explicitly defined in storageKeys.js', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  // Pre-seed core keys
  mockStorage.setItem(KEYS.SETTINGS, JSON.stringify({ city: 'Makkah' }));
  mockStorage.setItem(KEYS.TIMES, JSON.stringify({ Fajr: '05:00' }));
  mockStorage.setItem(KEYS.CHAT_SESSIONS, JSON.stringify([{ id: 'sess_1', messages: [] }]));
  mockStorage.setItem(KEYS.ACTIVE_SESSION_ID, 'sess_1');
  mockStorage.setItem(KEYS.RE_TOGGLE_HISTORY, JSON.stringify({ 1: true }));
  mockStorage.setItem(KEYS.ERROR_LOGS, JSON.stringify(['error 1']));
  mockStorage.setItem(KEYS.SOURCE_SCHEDULE, JSON.stringify({ source: 'manual' }));
  mockStorage.setItem(KEYS.DAILY_SUGGESTIONS, JSON.stringify({ date: '2026-11-09' }));

  clearEntireAppData();

  assert.equal(mockStorage.getItem(KEYS.SETTINGS), null);
  assert.equal(mockStorage.getItem(KEYS.TIMES), null);
  assert.equal(mockStorage.getItem(KEYS.CHAT_SESSIONS), null);
  assert.equal(mockStorage.getItem(KEYS.ACTIVE_SESSION_ID), null);
  assert.equal(mockStorage.getItem(KEYS.RE_TOGGLE_HISTORY), null);
  assert.equal(mockStorage.getItem(KEYS.ERROR_LOGS), null);
  assert.equal(mockStorage.getItem(KEYS.SOURCE_SCHEDULE), null);
  assert.equal(mockStorage.getItem(KEYS.DAILY_SUGGESTIONS), null);
});

await challenge('2.2 Purges records keys via clearAllRecords (RECORDS and NAFL_RECORDS)', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  mockStorage.setItem(KEYS.RECORDS, JSON.stringify([{ date: '2026-11-09', prayer_name: 'Fajr', status: 'on_time' }]));
  mockStorage.setItem(KEYS.NAFL_RECORDS, JSON.stringify([{ date: '2026-11-09', prayer_name: 'Duha', count: 2 }]));

  clearEntireAppData();

  assert.equal(mockStorage.getItem(KEYS.RECORDS), null);
  assert.equal(mockStorage.getItem(KEYS.NAFL_RECORDS), null);
});

await challenge('2.3 Dynamic prefix purge: purges all keys starting with bg_rejected_imgs_', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  for (let i = 0; i < 30; i++) {
    mockStorage.setItem(`bg_rejected_imgs_nature_${i}`, JSON.stringify([`img_${i}.jpg`]));
  }

  clearEntireAppData();

  for (let i = 0; i < 30; i++) {
    assert.equal(mockStorage.getItem(`bg_rejected_imgs_nature_${i}`), null);
  }
});

await challenge('2.4 Dynamic prefix purge: purges all keys starting with active_bg_', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  mockStorage.setItem('active_bg_makkah', 'bg_1.jpg');
  mockStorage.setItem('active_bg_madinah', 'bg_2.jpg');
  mockStorage.setItem('active_bg_custom', 'bg_3.jpg');

  clearEntireAppData();

  assert.equal(mockStorage.getItem('active_bg_makkah'), null);
  assert.equal(mockStorage.getItem('active_bg_madinah'), null);
  assert.equal(mockStorage.getItem('active_bg_custom'), null);
});

await challenge('2.5 Dynamic prefix purge: purges all service keys starting with prayer_tracker_', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  const dynamicKeys = [
    'prayer_tracker_audio_player_state_v1',
    'prayer_tracker_city_coords_cache',
    'prayer_tracker_tasbeeh_v1',
    'prayer_tracker_tasbeeh_sidebar_expanded',
    'prayer_tracker_last_left_chat_time',
  ];

  for (const k of dynamicKeys) {
    mockStorage.setItem(k, 'some_payload');
  }

  clearEntireAppData();

  for (const k of dynamicKeys) {
    assert.equal(mockStorage.getItem(k), null);
  }
});

await challenge('2.6 Preservation invariant: preserves non-app unrelated localStorage keys', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  mockStorage.setItem('prayer_tracker_test', 'to_delete');
  mockStorage.setItem('external_auth_token', 'preserve_me');
  mockStorage.setItem('user_site_theme', 'dark');

  clearEntireAppData();

  assert.equal(mockStorage.getItem('prayer_tracker_test'), null);
  assert.equal(mockStorage.getItem('external_auth_token'), 'preserve_me');
  assert.equal(mockStorage.getItem('user_site_theme'), 'dark');
});

await challenge('2.7 Full App Reset Invariant: Purges habit_tracker_* and muneer_* persistent user state', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  // Book reader habit state, active book, and muneer speed alert cooldown
  mockStorage.setItem('habit_tracker_reading_habit_state_v1', JSON.stringify({ activeLevel: 2, completedDays: 14 }));
  mockStorage.setItem('habit_tracker_active_book_id', 'book_abc');
  mockStorage.setItem('habit_tracker_reading_theme', 'sepia');
  mockStorage.setItem('muneer_last_speed_alert_date', '2026-11-09');

  clearEntireAppData();

  const habitState = mockStorage.getItem('habit_tracker_reading_habit_state_v1');
  const activeBook = mockStorage.getItem('habit_tracker_active_book_id');
  const speedAlert = mockStorage.getItem('muneer_last_speed_alert_date');

  const leaked = [];
  if (habitState !== null) leaked.push('habit_tracker_reading_habit_state_v1');
  if (activeBook !== null) leaked.push('habit_tracker_active_book_id');
  if (speedAlert !== null) leaked.push('muneer_last_speed_alert_date');

  assert.equal(
    leaked.length,
    0,
    `Residual user state leaked across full app reset: ${leaked.join(', ')}`
  );
});

await challenge('2.8 Idempotency: multiple successive invocations execute cleanly', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  assert.doesNotThrow(() => {
    clearEntireAppData();
    clearEntireAppData();
    clearAllUserData();
  });
});

// ----------------------------------------------------------------------------
// SUITE 3: CustomEvent Dispatches & Payload Invariants
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 3: CustomEvent Dispatches & Payload Invariants ---');

await challenge('3.1 Dispatches APP_EVENTS.RECORDS_UPDATED with empty array detail', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  let capturedEvent = null;
  mockWin.addEventListener(APP_EVENTS.RECORDS_UPDATED, (e) => {
    capturedEvent = e;
  });

  clearEntireAppData();

  assert.ok(capturedEvent);
  assert.equal(capturedEvent.type, APP_EVENTS.RECORDS_UPDATED);
  assert.ok(Array.isArray(capturedEvent.detail));
  assert.equal(capturedEvent.detail.length, 0);
});

await challenge('3.2 Dispatches APP_EVENTS.NAFL_RECORDS_UPDATED with empty array detail', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  let capturedEvent = null;
  mockWin.addEventListener(APP_EVENTS.NAFL_RECORDS_UPDATED, (e) => {
    capturedEvent = e;
  });

  clearEntireAppData();

  assert.ok(capturedEvent);
  assert.equal(capturedEvent.type, APP_EVENTS.NAFL_RECORDS_UPDATED);
  assert.ok(Array.isArray(capturedEvent.detail));
  assert.equal(capturedEvent.detail.length, 0);
});

await challenge('3.3 Dispatches APP_EVENTS.SETTINGS_UPDATED with clean default settings detail', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  let capturedEvent = null;
  mockWin.addEventListener(APP_EVENTS.SETTINGS_UPDATED, (e) => {
    capturedEvent = e;
  });

  clearEntireAppData();

  assert.ok(capturedEvent);
  assert.equal(capturedEvent.type, APP_EVENTS.SETTINGS_UPDATED);
  assert.ok(typeof capturedEvent.detail === 'object');
  assert.equal(capturedEvent.detail.geminiApiKey, '');
  assert.equal(capturedEvent.detail.calculationMethod, 'auto');
  assert.ok(Array.isArray(capturedEvent.detail.customBgImages));
  assert.ok(capturedEvent.detail.customBgImages.includes('/nature-meadow.jpg'));
});

await challenge('3.4 Dispatches APP_EVENTS.PRAYER_TIMES_UPDATED with clean default times cache detail', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  let capturedEvent = null;
  mockWin.addEventListener(APP_EVENTS.PRAYER_TIMES_UPDATED, (e) => {
    capturedEvent = e;
  });

  clearEntireAppData();

  assert.ok(capturedEvent);
  assert.equal(capturedEvent.type, APP_EVENTS.PRAYER_TIMES_UPDATED);
  assert.deepEqual(capturedEvent.detail, DEFAULT_PRAYER_TIMES);
});

await challenge('3.5 SSR / Node safety: does not throw ReferenceError when window is undefined', () => {
  const mockStorage = createMockStorage();
  delete globalThis.window;
  globalThis.localStorage = mockStorage;

  assert.doesNotThrow(() => {
    clearEntireAppData();
  });
});

// ----------------------------------------------------------------------------
// SUITE 4: AGENTS.md Rule 5 Tri-State Data Readiness (DATA_STATUS)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 4: AGENTS.md Rule 5 Tri-State Data Readiness (DATA_STATUS) ---');

await challenge('4.1 DATA_STATUS defines strict tri-state constants (LOADING, UNAVAILABLE, READY)', () => {
  assert.equal(DATA_STATUS.LOADING, 'loading');
  assert.equal(DATA_STATUS.UNAVAILABLE, 'unavailable');
  assert.equal(DATA_STATUS.READY, 'ready');
  assert.equal(Object.keys(DATA_STATUS).length, 3);
});

await challenge('4.2 isValidTimeString handles valid 24h formats and strictly rejects empty parts/colons', () => {
  // Valid 24h times
  assert.equal(isValidTimeString('00:00'), true);
  assert.equal(isValidTimeString('05:15'), true);
  assert.equal(isValidTimeString('12:00'), true);
  assert.equal(isValidTimeString('23:59'), true);
  assert.equal(isValidTimeString(' 04:30 '), true);

  // Invalid out-of-range hours / minutes
  assert.equal(isValidTimeString('24:00'), false);
  assert.equal(isValidTimeString('25:00'), false);
  assert.equal(isValidTimeString('12:60'), false);
  assert.equal(isValidTimeString('-01:30'), false);
  assert.equal(isValidTimeString('12:-05'), false);

  // Invalid non-string / empty types
  assert.equal(isValidTimeString(''), false);
  assert.equal(isValidTimeString('   '), false);
  assert.equal(isValidTimeString(null), false);
  assert.equal(isValidTimeString(undefined), false);
  assert.equal(isValidTimeString(1234), false);
  assert.equal(isValidTimeString({}), false);
  assert.equal(isValidTimeString([]), false);
  assert.equal(isValidTimeString('ab:cd'), false);

  // Incomplete / colon placeholders (Rule 5 invariant: no fake readiness)
  assert.equal(isValidTimeString(':'), false, 'Standalone colon ":" must not evaluate to valid time 00:00');
  assert.equal(isValidTimeString('12:'), false, 'Trailing colon "12:" must not evaluate to valid time 12:00');
  assert.equal(isValidTimeString(':30'), false, 'Leading colon ":30" must not evaluate to valid time 00:30');
  assert.equal(isValidTimeString('  :  '), false, 'Whitespace colon "  :  " must not evaluate to valid time');
});

await challenge('4.3 getPrayerTimesStatus strictly requires all 5 obligatory prayers to be present and valid', () => {
  const validTimes = {
    Fajr: '05:10',
    Sunrise: '06:30',
    Dhuhr: '12:15',
    Asr: '15:30',
    Maghrib: '18:00',
    Isha: '19:30',
  };

  // Full valid set
  assert.equal(getPrayerTimesStatus(validTimes), DATA_STATUS.READY);

  // Missing one obligatory prayer at a time
  for (const prayerId of OBLIGATORY_PRAYER_IDS) {
    const missingOne = { ...validTimes };
    delete missingOne[prayerId];
    assert.equal(
      getPrayerTimesStatus(missingOne),
      DATA_STATUS.UNAVAILABLE,
      `Should be UNAVAILABLE when ${prayerId} is missing`
    );

    const emptyOne = { ...validTimes, [prayerId]: '' };
    assert.equal(
      getPrayerTimesStatus(emptyOne),
      DATA_STATUS.UNAVAILABLE,
      `Should be UNAVAILABLE when ${prayerId} is empty string`
    );

    const invalidOne = { ...validTimes, [prayerId]: '99:99' };
    assert.equal(
      getPrayerTimesStatus(invalidOne),
      DATA_STATUS.UNAVAILABLE,
      `Should be UNAVAILABLE when ${prayerId} is invalid format`
    );
  }

  // Sunrise missing should NOT prevent READY because it is not obligatory
  const missingSunrise = { ...validTimes };
  delete missingSunrise.Sunrise;
  assert.equal(getPrayerTimesStatus(missingSunrise), DATA_STATUS.READY);

  // Corrupted inputs
  assert.equal(getPrayerTimesStatus(null), DATA_STATUS.UNAVAILABLE);
  assert.equal(getPrayerTimesStatus(undefined), DATA_STATUS.UNAVAILABLE);
  assert.equal(getPrayerTimesStatus({}), DATA_STATUS.UNAVAILABLE);
  assert.equal(getPrayerTimesStatus('not an object'), DATA_STATUS.UNAVAILABLE);
  assert.equal(getPrayerTimesStatus([]), DATA_STATUS.UNAVAILABLE);
});

await challenge('4.4 getRecordsStatus evaluates user history array readiness state', () => {
  assert.equal(getRecordsStatus([{ date: '2026-11-09', prayer_name: 'Fajr', status: 'on_time' }]), DATA_STATUS.READY);
  assert.equal(getRecordsStatus([]), DATA_STATUS.UNAVAILABLE);
  assert.equal(getRecordsStatus(null), DATA_STATUS.UNAVAILABLE);
  assert.equal(getRecordsStatus(undefined), DATA_STATUS.UNAVAILABLE);
  assert.equal(getRecordsStatus({}), DATA_STATUS.UNAVAILABLE);
  assert.equal(getRecordsStatus('string'), DATA_STATUS.UNAVAILABLE);
});

await challenge('4.5 Lifecycle Integration: Data Readiness transitions across Pre-Reset, Post-Reset, and Post-Import', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  // 1. Pre-reset: Valid loaded state
  savePrayerTimesCache({
    Fajr: '05:10',
    Dhuhr: '12:15',
    Asr: '15:30',
    Maghrib: '18:00',
    Isha: '19:30',
  });
  saveRecords([{ date: '2026-11-09', prayer_name: 'Fajr', status: 'on_time' }]);

  assert.equal(getPrayerTimesStatus(getPrayerTimesCache()), DATA_STATUS.READY);
  assert.equal(getRecordsStatus(getRecords()), DATA_STATUS.READY);

  // 2. Full App Reset
  clearEntireAppData();

  // 3. Post-reset: Both must evaluate strictly to UNAVAILABLE
  const postResetTimes = getPrayerTimesCache();
  const postResetRecords = getRecords();

  assert.equal(
    getPrayerTimesStatus(postResetTimes),
    DATA_STATUS.UNAVAILABLE,
    'Post-reset prayer times cache must be UNAVAILABLE'
  );
  assert.equal(
    getRecordsStatus(postResetRecords),
    DATA_STATUS.UNAVAILABLE,
    'Post-reset user records must be UNAVAILABLE'
  );

  // 4. Import Backup: State restores to READY
  const backupJSON = JSON.stringify({
    version: 1,
    app: 'HabitTracker_Salat',
    exportedAt: new Date().toISOString(),
    settings: DEFAULT_SETTINGS,
    records: [{ date: '2026-11-09', prayer_name: 'Dhuhr', status: 'on_time' }],
    naflRecords: [],
    chatSessions: [],
    activeSessionId: 'sess_1',
    cachedTimes: {
      Fajr: '05:15',
      Dhuhr: '12:20',
      Asr: '15:35',
      Maghrib: '18:05',
      Isha: '19:35',
    },
  });

  importFullUserDataJSON(backupJSON);

  assert.equal(getPrayerTimesStatus(getPrayerTimesCache()), DATA_STATUS.READY);
  assert.equal(getRecordsStatus(getRecords()), DATA_STATUS.READY);
});

// ----------------------------------------------------------------------------
// SUITE 5: High-Load Stress & Adversarial Edge Cases
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 5: High-Load Stress & Adversarial Edge Cases ---');

await challenge('5.1 High-Volume Key Purge: 300+ keys purged under 50ms', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  for (let i = 0; i < 100; i++) {
    mockStorage.setItem(`bg_rejected_imgs_${i}`, 'img');
    mockStorage.setItem(`active_bg_${i}`, 'bg');
    mockStorage.setItem(`prayer_tracker_item_${i}`, 'pt');
  }
  mockStorage.setItem('unrelated_user_key', 'keep');

  const start = performance.now();
  clearEntireAppData();
  const duration = performance.now() - start;

  assert.ok(duration < 50, `Purge took ${duration}ms (must be < 50ms)`);
  assert.equal(mockStorage.length, 1);
  assert.equal(mockStorage.getItem('unrelated_user_key'), 'keep');
});

await challenge('5.2 Corrupted JSON in storage keys prior to clear does not crash clearEntireAppData', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  mockStorage.setItem(KEYS.SETTINGS, '{invalid_json:::');
  mockStorage.setItem(KEYS.TIMES, '<<<NOT_JSON>>>');
  mockStorage.setItem(KEYS.RECORDS, 'undefined');
  mockStorage.setItem(KEYS.CHAT_SESSIONS, '[corrupt');

  assert.doesNotThrow(() => {
    clearEntireAppData();
  });

  // State after clear must return defaults
  assert.deepEqual(getSettings(), DEFAULT_SETTINGS);
  assert.deepEqual(getPrayerTimesCache(), DEFAULT_PRAYER_TIMES);
  assert.deepEqual(getRecords(), []);
});

await challenge('5.3 exportFullUserDataJSON immediately after clear produces valid JSON with default structure', () => {
  const mockStorage = createMockStorage();
  const mockIdb = createMockIndexedDB();
  const mockWin = createMockWindow(mockStorage, mockIdb);

  globalThis.window = mockWin;
  globalThis.localStorage = mockStorage;

  clearEntireAppData();

  const exported = exportFullUserDataJSON();
  assert.ok(typeof exported === 'string');

  const parsed = JSON.parse(exported);
  assert.equal(parsed.app, 'HabitTracker_Salat');
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.records, []);
  assert.deepEqual(parsed.naflRecords, []);
  assert.equal(parsed.settings.geminiApiKey, '');
  assert.deepEqual(parsed.cachedTimes, DEFAULT_PRAYER_TIMES);
});

console.log('\n======================================================================');
console.log(`🏁 CHALLENGER M3_2 COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
console.log('======================================================================');

if (failureReports.length > 0) {
  console.log('\n🚨 ADVERSARIAL CHALLENGER FINDINGS & FAILURE REPORT:');
  failureReports.forEach((f, idx) => {
    console.log(`  ${idx + 1}. [${f.test}]:`);
    console.log(`     ${f.error}`);
  });
}

if (failCount > 0) {
  process.exit(1);
}
