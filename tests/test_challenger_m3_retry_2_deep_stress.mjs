/**
 * Challenger M3 Retry 2: Deep Empirical Stress & Adversarial Test Harness
 * 
 * Tests:
 * 1. Isolated Error Boundaries in IndexedDB (BooksDB, AudioDB, reverse throw order, both throwing, invalid idb).
 * 2. Prefix Purge Hygiene:
 *    - All APP_STORAGE_PREFIXES ('bg_rejected_imgs_', 'active_bg_', 'prayer_tracker_', 'habit_tracker_', 'muneer_', 'prayer_')
 *    - Non-app keys survival (exact preservation)
 *    - Arabic/Unicode keys under app prefixes
 *    - Resilience when storage.removeItem throws on individual keys
 * 3. High-Load Stress: 1,000 keys (500 purged + 500 preserved) execution duration & accuracy.
 * 4. Adversarial Edge Cases in isValidTimeString & DATA_STATUS.
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
import { DATA_STATUS, isValidTimeString, getPrayerTimesStatus, getRecordsStatus } from '../src/services/dataReadiness.js';
import { APP_EVENTS, OBLIGATORY_PRAYER_IDS } from '../src/services/prayerConstants.js';

console.log('======================================================================');
console.log('⚡ CHALLENGER M3 RETRY 2: DEEP ADVERSARIAL STRESS HARNESS');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;
const failures = [];

async function testCase(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
    failCount++;
    failures.push({ name, error: err.message });
  }
}

function createMockStorage() {
  const map = new Map();
  const target = {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
    key(i) { return Array.from(map.keys())[i] || null; },
    get length() { return map.size; },
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
// SUITE A: Thorough IndexedDB Error Boundary Stress
// ----------------------------------------------------------------------------
console.log('--- SUITE A: IndexedDB Independent Error Boundaries ---');

await testCase('A.1 If AudioDB throws, BooksDB has executed cleanly beforehand', () => {
  const storage = createMockStorage();
  const attempted = [];
  const failingAudioIdb = {
    deleteDatabase(name) {
      attempted.push(name);
      if (name === 'HabitTracker_AudioDB') {
        throw new Error('AudioDB disk write failure');
      }
    },
  };
  globalThis.window = createMockWindow(storage, failingAudioIdb);
  globalThis.localStorage = storage;

  assert.doesNotThrow(() => {
    clearEntireAppData();
  });
  assert.deepEqual(attempted, ['HabitTracker_BooksDB', 'HabitTracker_AudioDB']);
});

await testCase('A.2 If BooksDB throws, AudioDB is still attempted and executed', () => {
  const storage = createMockStorage();
  const attempted = [];
  const failingBooksIdb = {
    deleteDatabase(name) {
      attempted.push(name);
      if (name === 'HabitTracker_BooksDB') {
        throw new Error('BooksDB database locked');
      }
    },
  };
  globalThis.window = createMockWindow(storage, failingBooksIdb);
  globalThis.localStorage = storage;

  assert.doesNotThrow(() => {
    clearEntireAppData();
  });
  assert.deepEqual(attempted, ['HabitTracker_BooksDB', 'HabitTracker_AudioDB']);
});

await testCase('A.3 If BOTH BooksDB and AudioDB throw, clearEntireAppData does not crash', () => {
  const storage = createMockStorage();
  const attempted = [];
  const bothFailingIdb = {
    deleteDatabase(name) {
      attempted.push(name);
      throw new Error(`Catastrophic failure on ${name}`);
    },
  };
  globalThis.window = createMockWindow(storage, bothFailingIdb);
  globalThis.localStorage = storage;

  assert.doesNotThrow(() => {
    clearEntireAppData();
  });
  assert.equal(attempted.length, 2);
});

await testCase('A.4 Fallback when window is undefined and globalThis.indexedDB is present', () => {
  const storage = createMockStorage();
  const attempted = [];
  const nodeGlobalIdb = {
    deleteDatabase(name) {
      attempted.push(name);
    },
  };
  delete globalThis.window;
  globalThis.indexedDB = nodeGlobalIdb;
  globalThis.localStorage = storage;

  clearEntireAppData();
  assert.deepEqual(attempted, ['HabitTracker_BooksDB', 'HabitTracker_AudioDB']);
  delete globalThis.indexedDB;
});

// ----------------------------------------------------------------------------
// SUITE B: Prefix Purge Hygiene & Preserved Boundary Stress
// ----------------------------------------------------------------------------
console.log('\n--- SUITE B: Storage Prefix Purge Hygiene & Boundary Integrity ---');

await testCase('B.1 Purges all specified prefixes including habit_tracker_, muneer_, prayer_', () => {
  const storage = createMockStorage();
  globalThis.window = createMockWindow(storage, null);
  globalThis.localStorage = storage;

  // Set representative keys for all prefixes
  storage.setItem('habit_tracker_reading_habit_state_v1', 'habit1');
  storage.setItem('habit_tracker_active_book_id', 'book1');
  storage.setItem('habit_tracker_reading_theme', 'dark');
  storage.setItem('muneer_last_speed_alert_date', '2026-11-09');
  storage.setItem('muneer_active_signal_cooldown', '123456');
  storage.setItem('prayer_tracker_audio_player_state_v1', 'audio1');
  storage.setItem('prayer_tracker_tasbeeh_v1', 'tasbeeh1');
  storage.setItem('prayer_re_toggle_history', 'history1');
  storage.setItem('bg_rejected_imgs_nature', 'rejected1');
  storage.setItem('active_bg_custom', 'bg1');

  // External keys that MUST NOT be touched
  storage.setItem('external_token', 'secret_jwt');
  storage.setItem('theme_preference', 'light');
  storage.setItem('user_profile_name', 'Ahmed');
  storage.setItem('habit_unrelated_prefix', 'keep_me');

  clearEntireAppData();

  // Verify all app keys deleted
  assert.equal(storage.getItem('habit_tracker_reading_habit_state_v1'), null);
  assert.equal(storage.getItem('habit_tracker_active_book_id'), null);
  assert.equal(storage.getItem('habit_tracker_reading_theme'), null);
  assert.equal(storage.getItem('muneer_last_speed_alert_date'), null);
  assert.equal(storage.getItem('muneer_active_signal_cooldown'), null);
  assert.equal(storage.getItem('prayer_tracker_audio_player_state_v1'), null);
  assert.equal(storage.getItem('prayer_tracker_tasbeeh_v1'), null);
  assert.equal(storage.getItem('prayer_re_toggle_history'), null);
  assert.equal(storage.getItem('bg_rejected_imgs_nature'), null);
  assert.equal(storage.getItem('active_bg_custom'), null);

  // Verify external keys remain intact
  assert.equal(storage.getItem('external_token'), 'secret_jwt');
  assert.equal(storage.getItem('theme_preference'), 'light');
  assert.equal(storage.getItem('user_profile_name'), 'Ahmed');
  assert.equal(storage.getItem('habit_unrelated_prefix'), 'keep_me');
  assert.equal(storage.length, 4);
});

await testCase('B.2 Unicode / Arabic keys under app prefixes are purged safely', () => {
  const storage = createMockStorage();
  globalThis.window = createMockWindow(storage, null);
  globalThis.localStorage = storage;

  storage.setItem('habit_tracker_كتاب_تفسير', 'محتوى_1');
  storage.setItem('muneer_أذكار_مسائية', 'محتوى_2');
  storage.setItem('prayer_tracker_صلوات_قضاء', 'محتوى_3');
  storage.setItem('بيانات_خارجية', 'تحفظ');

  clearEntireAppData();

  assert.equal(storage.getItem('habit_tracker_كتاب_تفسير'), null);
  assert.equal(storage.getItem('muneer_أذكار_مسائية'), null);
  assert.equal(storage.getItem('prayer_tracker_صلوات_قضاء'), null);
  assert.equal(storage.getItem('بيانات_خارجية'), 'تحفظ');
});

await testCase('B.3 Fault tolerance: individual storage.removeItem exception does not stop remaining purges', () => {
  const storage = createMockStorage();
  storage.setItem('habit_tracker_key1', 'v1');
  storage.setItem('habit_tracker_failing', 'v2');
  storage.setItem('habit_tracker_key3', 'v3');
  storage.setItem('muneer_key4', 'v4');

  // Wrap storage to throw on 'habit_tracker_failing'
  const realRemoveItem = storage.removeItem.bind(storage);
  storage.removeItem = (key) => {
    if (key === 'habit_tracker_failing') {
      throw new Error('Disk error on failing key');
    }
    realRemoveItem(key);
  };

  globalThis.window = createMockWindow(storage, null);
  globalThis.localStorage = storage;

  assert.doesNotThrow(() => {
    clearEntireAppData();
  });

  // Remaining keys must have been removed despite the exception
  assert.equal(storage.getItem('habit_tracker_key1'), null);
  assert.equal(storage.getItem('habit_tracker_key3'), null);
  assert.equal(storage.getItem('muneer_key4'), null);
});

// ----------------------------------------------------------------------------
// SUITE C: High-Load 1,000 Key Stress & Execution Speed Benchmark
// ----------------------------------------------------------------------------
console.log('\n--- SUITE C: High-Load 1,000 Key Purge & Benchmark ---');

await testCase('C.1 1,000 keys (500 app keys + 500 external keys) purged in <50ms', () => {
  const storage = createMockStorage();
  globalThis.window = createMockWindow(storage, null);
  globalThis.localStorage = storage;

  const prefixes = ['bg_rejected_imgs_', 'active_bg_', 'prayer_tracker_', 'habit_tracker_', 'muneer_', 'prayer_'];

  // Seed 500 app keys
  for (let i = 0; i < 500; i++) {
    const prefix = prefixes[i % prefixes.length];
    storage.setItem(`${prefix}item_${i}`, `data_${i}`);
  }

  // Seed 500 external keys
  for (let i = 0; i < 500; i++) {
    storage.setItem(`external_site_state_${i}`, `val_${i}`);
  }

  assert.equal(storage.length, 1000);

  const start = performance.now();
  clearEntireAppData();
  const elapsed = performance.now() - start;

  console.log(`    -> Purged 500 app keys out of 1000 in ${elapsed.toFixed(2)}ms`);

  // Assert elapsed time is well within high-performance budget (<50ms)
  assert.ok(elapsed < 50, `Purge duration was ${elapsed}ms, exceeding 50ms threshold`);

  // Assert exactly 500 external keys remain
  assert.equal(storage.length, 500);

  // Assert sample external keys are untouched
  assert.equal(storage.getItem('external_site_state_0'), 'val_0');
  assert.equal(storage.getItem('external_site_state_499'), 'val_499');

  // Assert sample app keys are completely purged
  assert.equal(storage.getItem('habit_tracker_item_0'), null);
  assert.equal(storage.getItem('muneer_item_1'), null);
});

// ----------------------------------------------------------------------------
// SUITE D: Adversarial Invariants on isValidTimeString & DATA_STATUS
// ----------------------------------------------------------------------------
console.log('\n--- SUITE D: Adversarial Invariants on isValidTimeString & DATA_STATUS ---');

await testCase('D.1 Comprehensive adversarial matrix for isValidTimeString', () => {
  // Must return false
  const adversarialFalsy = [
    ':', '::', ':::', '1:', ':1', '12:', ':30', '  :  ', ' 12: ', ' :30 ',
    '24:00', '25:00', '12:60', '12:99', '99:99', '-01:00', '12:-05',
    '00:000', '000:00', '1:2', '12:1', '1:1', '12:00:00', '12.00', '12,00',
    '12:\n00', '12:\t00', '12: 00', '12:0 ', '12:00a', '12:00pm', '+12:00',
    '', ' ', '   ', null, undefined, 0, 1200, true, false, {}, [], () => {},
  ];

  for (const input of adversarialFalsy) {
    const res = isValidTimeString(input);
    assert.equal(res, false, `Expected isValidTimeString(${JSON.stringify(input)}) to be false, got ${res}`);
  }

  // Must return true
  const validTruthy = [
    '00:00', '0:00', '05:15', '5:15', '12:00', '12:30', '19:45', '23:59',
    ' 04:30 ', ' 23:59 ', '  00:00  ',
  ];

  for (const input of validTruthy) {
    const res = isValidTimeString(input);
    assert.equal(res, true, `Expected isValidTimeString(${JSON.stringify(input)}) to be true, got ${res}`);
  }
});

await testCase('D.2 getPrayerTimesStatus never returns READY on partial, colon-only, or malformed data', () => {
  const malformedSet1 = { Fajr: ':', Dhuhr: '12:15', Asr: '15:30', Maghrib: '18:00', Isha: '19:30' };
  assert.equal(getPrayerTimesStatus(malformedSet1), DATA_STATUS.UNAVAILABLE);

  const malformedSet2 = { Fajr: '05:00', Dhuhr: '12:', Asr: '15:30', Maghrib: '18:00', Isha: '19:30' };
  assert.equal(getPrayerTimesStatus(malformedSet2), DATA_STATUS.UNAVAILABLE);

  const malformedSet3 = { Fajr: '05:00', Dhuhr: '12:15', Asr: ':30', Maghrib: '18:00', Isha: '19:30' };
  assert.equal(getPrayerTimesStatus(malformedSet3), DATA_STATUS.UNAVAILABLE);

  const malformedSet4 = { Fajr: '05:00', Dhuhr: '12:15', Asr: '15:30', Maghrib: '24:00', Isha: '19:30' };
  assert.equal(getPrayerTimesStatus(malformedSet4), DATA_STATUS.UNAVAILABLE);
});

console.log('\n======================================================================');
console.log(`🏁 DEEP ADVERSARIAL STRESS COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
console.log('======================================================================');

if (failures.length > 0) {
  process.exit(1);
}
