/**
 * Challenger M1_2 Empirical Stress Test Suite
 * Tests:
 * 1. Papaparse removal & zero orphaned CSV symbols.
 * 2. Storage JSON Backup & Restore (exportFullUserDataJSON & importFullUserDataJSON) with round-trip fidelity, stress payloads, and contract verification.
 * 3. Prayer calculation engine (calculateOfflinePrayerTimes) across 10 cities, 5 dates, methods, madhabs, and high latitude rules.
 * 4. Aladhan API service & local schedule caching contracts.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Set up browser-like environment for storage testing before importing storage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(i) {
    return Object.keys(this.store)[i] || null;
  }
}

const mockStorage = new MockLocalStorage();
globalThis.localStorage = mockStorage;

const dispatchedEvents = [];
globalThis.window = {
  dispatchEvent: (event) => {
    dispatchedEvents.push(event);
    return true;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};

// Now import modules
import * as storage from '../src/services/storage.js';
import * as adhanCalc from '../src/services/adhanCalculator.js';
import * as aladhanApi from '../src/services/aladhanApiService.js';
import * as dataReadiness from '../src/services/dataReadiness.js';
import * as errorLogger from '../src/services/errorLogger.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('================================================================');
console.log('⚡ CHALLENGER M1_2: EMPIRICAL VERIFICATION & STRESS HARNESS');
console.log('================================================================\n');

// ====================================================================
// SUITE 1: PAPAPARSE UNINSTALLATION & DEAD FUNCTION REMOVAL INVARIANTS
// ====================================================================
console.log('--- SUITE 1: Papaparse Elimination & Dead Code Pruning ---');

await test('package.json does not contain papaparse in dependencies or devDependencies', () => {
  const pkgJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  assert.equal(pkgJson.dependencies?.papaparse, undefined, 'papaparse must not be in dependencies');
  assert.equal(pkgJson.devDependencies?.papaparse, undefined, 'papaparse must not be in devDependencies');
});

await test('Importing papaparse dynamically fails with ERR_MODULE_NOT_FOUND', async () => {
  try {
    await import('papaparse');
    assert.fail('Expected import("papaparse") to throw ERR_MODULE_NOT_FOUND');
  } catch (err) {
    assert.match(err.code || err.message, /ERR_MODULE_NOT_FOUND|Cannot find package|Failed to resolve/);
  }
});

await test('CSV dead functions (exportToCSV, importFromCSV) are strictly non-existent', () => {
  assert.equal(typeof storage.exportToCSV, 'undefined', 'exportToCSV must be removed from storage.js');
  assert.equal(typeof storage.importFromCSV, 'undefined', 'importFromCSV must be removed from storage.js');
});

await test('Dead exported functions from adhanCalculator, errorLogger, and dataReadiness are removed', () => {
  assert.equal(typeof adhanCalc.getPrayerTimesForLocation, 'undefined', 'getPrayerTimesForLocation removed');
  assert.equal(typeof adhanCalc.getSourceScheduleCache, 'undefined', 'getSourceScheduleCache removed from adhanCalc');
  assert.equal(typeof adhanCalc.setSourceScheduleCache, 'undefined', 'setSourceScheduleCache removed from adhanCalc');
  assert.equal(typeof storage.getTimesFromSourceSchedule, 'undefined', 'getTimesFromSourceSchedule removed');
  assert.equal(typeof storage.clearSourceScheduleCache, 'undefined', 'clearSourceScheduleCache removed');
  assert.equal(typeof storage.toggleNaflRecord, 'undefined', 'toggleNaflRecord removed');
  assert.equal(typeof errorLogger.clearLogs, 'undefined', 'clearLogs removed');
  assert.equal(typeof errorLogger.exportLogsAsJson, 'undefined', 'exportLogsAsJson removed');
  assert.equal(typeof dataReadiness.getWeatherDataStatus, 'undefined', 'getWeatherDataStatus removed');
});

// ====================================================================
// SUITE 2: STORAGE JSON BACKUP & RESTORE EMPIRICAL HARNESS
// ====================================================================
console.log('\n--- SUITE 2: Storage JSON Backup & Restore Stress Harness ---');

await test('Default/fresh state exports valid JSON payload with schema structure', () => {
  mockStorage.clear();
  const jsonStr = storage.exportFullUserDataJSON();
  assert.ok(typeof jsonStr === 'string' && jsonStr.length > 0);
  const parsed = JSON.parse(jsonStr);

  assert.equal(parsed.version, 1);
  assert.equal(parsed.app, 'HabitTracker_Salat');
  assert.ok(parsed.exportedAt);
  assert.ok(parsed.settings && typeof parsed.settings === 'object');
  assert.ok(Array.isArray(parsed.records));
  assert.ok(Array.isArray(parsed.naflRecords));
  assert.ok(Array.isArray(parsed.chatSessions));
  assert.ok(typeof parsed.activeSessionId === 'string');
  assert.ok(parsed.cachedTimes && typeof parsed.cachedTimes === 'object');
});

await test('Full User State Round-Trip Fidelity: Backup -> Clear -> Restore preserves 100% of data', () => {
  mockStorage.clear();
  dispatchedEvents.length = 0;

  // 1. Construct rich realistic user state fixture
  const customSettings = {
    geminiApiKey: 'AIzaSyEmpiricalTestKey_987654321',
    tavilyApiKey: 'tvly-secretKey123',
    gracePeriodMinutes: 25,
    city: 'Tunis',
    country: 'Tunisia',
    customBgImages: ['/custom-wall-1.jpg', '/custom-wall-2.jpg', storage.DEFAULT_NATURE_WALLPAPER],
    activeCustomBgImage: '/custom-wall-1.jpg',
    bgMode: 'custom',
    makkahVideoId: 'm9-Umj3aL1I',
    madinahVideoId: 'Rs7St51oDDc',
    timeFormat: '24',
    language: 'ar',
    calculationMethod: '18',
    asrMadhab: 'shafi',
    highLatitudeRule: 'seventhOfTheNight',
    prayerOffsets: {
      Fajr: 3,
      Sunrise: 0,
      Dhuhr: -2,
      Asr: 1,
      Maghrib: 4,
      Isha: -1,
    },
  };

  const recordsFixture = [
    { date: '2026-11-01', prayer_name: 'Fajr', adhan_time: '05:12', performed_time: '05:20', delay_minutes: 8, status: 'on_time' },
    { date: '2026-11-01', prayer_name: 'Dhuhr', adhan_time: '12:05', performed_time: '12:15', delay_minutes: 10, status: 'on_time' },
    { date: '2026-11-01', prayer_name: 'Asr', adhan_time: '15:10', performed_time: '15:40', delay_minutes: 30, status: 'late' },
    { date: '2026-11-01', prayer_name: 'Maghrib', adhan_time: '17:25', performed_time: '17:28', delay_minutes: 3, status: 'on_time' },
    { date: '2026-11-01', prayer_name: 'Isha', adhan_time: '18:50', performed_time: '21:00', delay_minutes: 130, status: 'qada' },
    { date: '2026-11-02', prayer_name: 'Fajr', adhan_time: '05:13', performed_time: '', delay_minutes: 0, status: 'missed' },
  ];

  const naflFixture = [
    { date: '2026-11-01', nafl_id: 'duha', status: 'completed', timestamp: '09:30' },
    { date: '2026-11-01', nafl_id: 'witr', status: 'completed', timestamp: '22:15' },
    { date: '2026-11-02', nafl_id: 'tahajjud', status: 'completed', timestamp: '04:15' },
  ];

  const chatSessionsFixture = [
    {
      id: 'session_alpha',
      title: 'أحكام صلاة المسافر',
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:05:00Z',
      messages: [
        { id: 'msg_1', sender: 'user', text: 'كيف أقصر الصلاة في السفر؟', timestamp: '10:00', usedSearch: false },
        { id: 'msg_2', sender: 'assistant', text: 'تقصر الصلوات الرباعية (الظهر والعصر والعشاء) إلى ركعتين.', timestamp: '10:01', usedSearch: true },
      ],
    },
    {
      id: 'session_beta',
      title: 'سؤال عن الزكاة',
      createdAt: '2026-11-02T14:00:00Z',
      updatedAt: '2026-11-02T14:10:00Z',
      messages: [
        { id: 'msg_3', sender: 'user', text: 'ما هو نصاب الذهب؟', timestamp: '14:00', usedSearch: false },
        { id: 'msg_4', sender: 'assistant', text: 'نصاب الذهب 85 غراماً من الذهب الخالص.', timestamp: '14:01', usedSearch: false },
      ],
    },
  ];

  const activeSessionIdFixture = 'session_alpha';

  const cachedTimesFixture = {
    Fajr: '05:13',
    Sunrise: '06:42',
    Dhuhr: '12:05',
    Asr: '15:09',
    Maghrib: '17:24',
    Isha: '18:49',
    Midnight: '23:33',
    Lastthird: '01:36',
  };

  // Populate mock storage
  storage.saveSettings(customSettings);
  storage.saveRecords(recordsFixture);
  storage.saveNaflRecords(naflFixture);
  storage.saveChatSessions(chatSessionsFixture);
  storage.saveActiveSessionId(activeSessionIdFixture);
  storage.savePrayerTimesCache(cachedTimesFixture);

  // 2. Export full backup
  const exportedJson = storage.exportFullUserDataJSON();
  assert.ok(exportedJson.length > 500);

  // 3. Clear all data
  storage.clearEntireAppData();
  assert.equal(storage.getRecords().length, 0);
  assert.equal(storage.getNaflRecords().length, 0);
  assert.equal(storage.getChatSessions()[0].title, 'محادثة رئيسية'); // default reset session

  // 4. Restore from backup
  dispatchedEvents.length = 0;
  const importResult = storage.importFullUserDataJSON(exportedJson);
  assert.ok(importResult === true || importResult?.success === true, 'Import must report success');

  // 5. Verify 100% data fidelity after restore
  const restoredSettings = storage.getSettings();
  assert.equal(restoredSettings.geminiApiKey, customSettings.geminiApiKey);
  assert.equal(restoredSettings.city, customSettings.city);
  assert.equal(restoredSettings.country, customSettings.country);
  assert.equal(restoredSettings.calculationMethod, customSettings.calculationMethod);
  assert.deepEqual(restoredSettings.prayerOffsets, customSettings.prayerOffsets);

  const restoredRecords = storage.getRecords();
  assert.equal(restoredRecords.length, recordsFixture.length);
  assert.deepEqual(restoredRecords, recordsFixture);

  const restoredNafl = storage.getNaflRecords();
  assert.equal(restoredNafl.length, naflFixture.length);
  assert.deepEqual(restoredNafl, naflFixture);

  const restoredSessions = storage.getChatSessions();
  assert.equal(restoredSessions.length, 2);
  assert.equal(restoredSessions[0].id, 'session_alpha');
  assert.equal(restoredSessions[0].messages.length, 2);
  assert.equal(restoredSessions[1].id, 'session_beta');

  const restoredActiveId = storage.getActiveSessionId();
  assert.equal(restoredActiveId, activeSessionIdFixture);

  const restoredCachedTimes = storage.getPrayerTimesCache();
  assert.deepEqual(restoredCachedTimes, cachedTimesFixture);

  // 6. Verify event dispatching
  const eventTypes = dispatchedEvents.map((e) => e.type);
  assert.ok(eventTypes.includes('records-updated'), 'dispatches records-updated');
  assert.ok(eventTypes.includes('nafl-records-updated'), 'dispatches nafl-records-updated');
  assert.ok(eventTypes.includes('settings-updated'), 'dispatches settings-updated');
  assert.ok(eventTypes.includes('prayer-times-updated'), 'dispatches prayer-times-updated');
});

await test('Adversarial inputs to importFullUserDataJSON throw appropriate errors', () => {
  assert.throws(() => storage.importFullUserDataJSON(''), /ملف النسخة الاحتياطية فارغ أو غير صالح/);
  assert.throws(() => storage.importFullUserDataJSON(null), /ملف النسخة الاحتياطية فارغ أو غير صالح/);
  assert.throws(() => storage.importFullUserDataJSON(undefined), /ملف النسخة الاحتياطية فارغ أو غير صالح/);
  assert.throws(() => storage.importFullUserDataJSON('{ bad: syntax ]'), SyntaxError);
  assert.throws(() => storage.importFullUserDataJSON('"just a string"'), /تنسيق النسخة الاحتياطية غير متوافق/);
  assert.throws(() => storage.importFullUserDataJSON('12345'), /تنسيق النسخة الاحتياطية غير متوافق/);
  assert.throws(() => storage.importFullUserDataJSON('null'), /تنسيق النسخة الاحتياطية غير متوافق/);
});

await test('Partial backup payloads restore available keys gracefully without crash', () => {
  mockStorage.clear();
  // Backup only containing settings
  storage.importFullUserDataJSON(JSON.stringify({
    version: 1,
    settings: { city: 'Alexandria', country: 'Egypt' },
  }));
  assert.equal(storage.getSettings().city, 'Alexandria');
  assert.equal(storage.getSettings().country, 'Egypt');

  // Backup only containing records
  storage.importFullUserDataJSON(JSON.stringify({
    version: 1,
    records: [{ date: '2026-11-05', prayer_name: 'Fajr', status: 'on_time' }],
  }));
  assert.equal(storage.getRecords().length, 1);
  // Existing settings preserved
  assert.equal(storage.getSettings().city, 'Alexandria');
});

await test('High-volume stress test: 1,000 records backup and restore executes within <100ms', () => {
  mockStorage.clear();
  const bulkRecords = [];
  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  for (let i = 0; i < 200; i++) {
    const d = new Date(2026, 0, 1 + i);
    const dateStr = d.toISOString().slice(0, 10);
    for (const p of prayers) {
      bulkRecords.push({
        date: dateStr,
        prayer_name: p,
        adhan_time: '12:00',
        performed_time: '12:10',
        delay_minutes: 10,
        status: 'on_time',
      });
    }
  }
  assert.equal(bulkRecords.length, 1000);

  storage.saveRecords(bulkRecords);
  const t0 = performance.now();
  const exported = storage.exportFullUserDataJSON();
  const tExport = performance.now() - t0;

  storage.clearEntireAppData();

  const t1 = performance.now();
  storage.importFullUserDataJSON(exported);
  const tImport = performance.now() - t1;

  assert.equal(storage.getRecords().length, 1000);
  assert.ok(tExport < 100, `Export took ${tExport}ms (< 100ms)`);
  assert.ok(tImport < 100, `Import took ${tImport}ms (< 100ms)`);
});

// ====================================================================
// SUITE 3: PRAYER CALCULATION ENGINE STRESS HARNESS
// ====================================================================
console.log('\n--- SUITE 3: Prayer Calculation Engine Stress Harness ---');

const TEST_CITIES = [
  { name: 'Makkah, Saudi Arabia', lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh', country: 'Saudi Arabia', method: '4' },
  { name: 'Tunis, Tunisia', lat: 36.8065, lng: 10.1815, tz: 'Africa/Tunis', country: 'Tunisia', method: '18' },
  { name: 'Cairo, Egypt', lat: 30.0444, lng: 31.2357, tz: 'Africa/Cairo', country: 'Egypt', method: '5' },
  { name: 'Istanbul, Turkey', lat: 41.0082, lng: 28.9784, tz: 'Europe/Istanbul', country: 'Turkey', method: '13' },
  { name: 'Karachi, Pakistan', lat: 24.8607, lng: 67.0011, tz: 'Asia/Karachi', country: 'Pakistan', method: '1' },
  { name: 'London, UK (High Lat)', lat: 51.5074, lng: -0.1278, tz: 'Europe/London', country: 'United Kingdom', method: '3' },
  { name: 'New York, USA', lat: 40.7128, lng: -74.0060, tz: 'America/New_York', country: 'United States', method: '2' },
  { name: 'Jakarta, Indonesia (Equator)', lat: -6.2088, lng: 106.8456, tz: 'Asia/Jakarta', country: 'Indonesia', method: '20' },
  { name: 'Sydney, Australia (Southern Hem)', lat: -33.8688, lng: 151.2093, tz: 'Australia/Sydney', country: 'Australia', method: '3' },
  { name: 'Oslo, Norway (Extreme High Lat)', lat: 59.9139, lng: 10.7522, tz: 'Europe/Oslo', country: 'Norway', method: '3' },
];

const TEST_DATES = [
  new Date(2026, 2, 20), // Spring Equinox
  new Date(2026, 5, 21), // Summer Solstice
  new Date(2026, 8, 22), // Autumn Equinox
  new Date(2026, 11, 21), // Winter Solstice
  new Date(2028, 1, 29), // Leap Year Day
];

await test('Offline prayer calculation across 10 global cities and 5 astronomical dates', () => {
  for (const city of TEST_CITIES) {
    for (const dt of TEST_DATES) {
      const res = adhanCalc.calculateOfflinePrayerTimes(city.lat, city.lng, dt, {
        calculationMethod: city.method,
        timezone: city.tz,
        countryName: city.country,
        asrMadhab: 'shafi',
        highLatitudeRule: 'middleOfTheNight',
      });

      assert.ok(res, `Result must exist for ${city.name} on ${dt.toISOString()}`);
      assert.equal(res.success, true);
      assert.ok(res.times.Fajr && dataReadiness.isValidTimeString(res.times.Fajr));
      assert.ok(res.times.Sunrise && dataReadiness.isValidTimeString(res.times.Sunrise));
      assert.ok(res.times.Dhuhr && dataReadiness.isValidTimeString(res.times.Dhuhr));
      assert.ok(res.times.Asr && dataReadiness.isValidTimeString(res.times.Asr));
      assert.ok(res.times.Maghrib && dataReadiness.isValidTimeString(res.times.Maghrib));
      assert.ok(res.times.Isha && dataReadiness.isValidTimeString(res.times.Isha));

      // Assert chronological ordering: Fajr < Sunrise < Dhuhr < Asr < Maghrib < Isha
      const fajrM = storage.timeToMinutes(res.times.Fajr);
      const sunM = storage.timeToMinutes(res.times.Sunrise);
      const dhuhrM = storage.timeToMinutes(res.times.Dhuhr);
      const asrM = storage.timeToMinutes(res.times.Asr);
      const maghribM = storage.timeToMinutes(res.times.Maghrib);
      const ishaM = storage.timeToMinutes(res.times.Isha);

      const effectiveIsha = ishaM < maghribM ? ishaM + 1440 : ishaM;
      assert.ok(fajrM < sunM, `Fajr (${res.times.Fajr}) < Sunrise (${res.times.Sunrise}) in ${city.name}`);
      assert.ok(sunM < dhuhrM, `Sunrise (${res.times.Sunrise}) < Dhuhr (${res.times.Dhuhr}) in ${city.name}`);
      assert.ok(dhuhrM < asrM, `Dhuhr (${res.times.Dhuhr}) < Asr (${res.times.Asr}) in ${city.name}`);
      assert.ok(asrM < maghribM, `Asr (${res.times.Asr}) < Maghrib (${res.times.Maghrib}) in ${city.name}`);
      assert.ok(maghribM < effectiveIsha, `Maghrib (${res.times.Maghrib}) < effective Isha (${res.times.Isha}) in ${city.name}`);

      // Check sunnah times format
      assert.ok(dataReadiness.isValidTimeString(res.sunnah.middleOfTheNight));
      assert.ok(dataReadiness.isValidTimeString(res.sunnah.lastThirdOfTheNight));

      // Check Qibla bearing
      assert.ok(res.qiblaDirection >= 0 && res.qiblaDirection <= 360);
    }
  }
});

await test('Hanafi Asr is strictly later than Shafi Asr across all cities', () => {
  const dt = new Date(2026, 3, 15);
  for (const city of TEST_CITIES) {
    const shafiRes = adhanCalc.calculateOfflinePrayerTimes(city.lat, city.lng, dt, {
      calculationMethod: city.method,
      timezone: city.tz,
      countryName: city.country,
      asrMadhab: 'shafi',
    });

    const hanafiRes = adhanCalc.calculateOfflinePrayerTimes(city.lat, city.lng, dt, {
      calculationMethod: city.method,
      timezone: city.tz,
      countryName: city.country,
      asrMadhab: 'hanafi',
    });

    const shafiAsr = storage.timeToMinutes(shafiRes.times.Asr);
    const hanafiAsr = storage.timeToMinutes(hanafiRes.times.Asr);

    assert.ok(
      hanafiAsr >= shafiAsr + 30,
      `Hanafi Asr (${hanafiRes.times.Asr}) must be >= 30 mins after Shafi Asr (${shafiRes.times.Asr}) in ${city.name}`
    );
  }
});

await test('High Latitude Rules produce valid timings in Oslo during Summer Solstice', () => {
  const summerSolstice = new Date(2026, 5, 21); // June 21, midnight sun near Arctic
  const oslo = TEST_CITIES.find((c) => c.name.includes('Oslo'));

  for (const rule of ['middleOfTheNight', 'seventhOfTheNight', 'twilightAngle']) {
    const res = adhanCalc.calculateOfflinePrayerTimes(oslo.lat, oslo.lng, summerSolstice, {
      calculationMethod: '3',
      timezone: oslo.tz,
      highLatitudeRule: rule,
    });

    assert.ok(res && res.success, `Rule ${rule} should succeed in Oslo`);
    assert.ok(dataReadiness.isValidTimeString(res.times.Fajr));
    assert.ok(dataReadiness.isValidTimeString(res.times.Isha));
  }
});

await test('Adversarial inputs to calculateOfflinePrayerTimes return null safely without exception', () => {
  assert.equal(adhanCalc.calculateOfflinePrayerTimes('not_a_number', 45), null);
  assert.equal(adhanCalc.calculateOfflinePrayerTimes(undefined, 45), null);
  assert.equal(adhanCalc.calculateOfflinePrayerTimes(25, undefined), null);
  assert.equal(adhanCalc.calculateOfflinePrayerTimes(NaN, NaN), null);
  assert.equal(adhanCalc.calculateOfflinePrayerTimes({}, 45), null);

  // Type coercion caveat: Number(null) is 0, so calculateOfflinePrayerTimes(null, 45) calculates for lat 0
  const nullLatRes = adhanCalc.calculateOfflinePrayerTimes(null, 45);
  assert.ok(nullLatRes && nullLatRes.success, 'Type coercion: null evaluates to 0 in Number(null)');
});

// ====================================================================
// SUITE 4: ALADHAN REST API & SCHEDULE CACHING HARNESS
// ====================================================================
console.log('\n--- SUITE 4: Aladhan API Service & Schedule Caching ---');

await test('cleanAladhanTime strips timezone identifiers and preserves clean 24h time', () => {
  assert.equal(aladhanApi.cleanAladhanTime('04:07 (CET)'), '04:07');
  assert.equal(aladhanApi.cleanAladhanTime('18:22 (+03)'), '18:22');
  assert.equal(aladhanApi.cleanAladhanTime('12:30 (EEST)'), '12:30');
  assert.equal(aladhanApi.cleanAladhanTime('05:45'), '05:45');
  assert.equal(aladhanApi.cleanAladhanTime(''), '');
  assert.equal(aladhanApi.cleanAladhanTime(null), '');
  assert.equal(aladhanApi.cleanAladhanTime(undefined), '');
});

await test('formatAladhanDateToISO converts DD-MM-YYYY to YYYY-MM-DD correctly', () => {
  assert.equal(aladhanApi.formatAladhanDateToISO({ gregorian: { date: '18-08-2026' } }), '2026-08-18');
  assert.equal(aladhanApi.formatAladhanDateToISO({ gregorian: { date: '01-01-2027' } }), '2027-01-01');
  assert.equal(aladhanApi.formatAladhanDateToISO(null), '');
  assert.equal(aladhanApi.formatAladhanDateToISO({}), '');
});

await test('Schedule cache: saveSourceScheduleCache & getSourceScheduleCache store and retrieve correctly', () => {
  mockStorage.clear();
  const scheduleData = {
    city: 'Tunis',
    country: 'Tunisia',
    timezone: 'Africa/Tunis',
    schedule: {
      '2026-11-08': {
        Fajr: '05:15',
        Sunrise: '06:45',
        Dhuhr: '12:05',
        Asr: '15:05',
        Maghrib: '17:22',
        Isha: '18:48',
      },
    },
  };

  storage.saveSourceScheduleCache(scheduleData);
  const retrieved = storage.getSourceScheduleCache();
  assert.deepEqual(retrieved, scheduleData);
});

await test('fetchAladhanPrayerTimesForLocation hits local source cache and returns zero-latency data without network', async () => {
  mockStorage.clear();
  const targetDate = '2026-11-08';
  const scheduleData = {
    city: 'Tunis',
    country: 'Tunisia',
    timezone: 'Africa/Tunis',
    schedule: {
      [targetDate]: {
        Fajr: '05:15',
        Sunrise: '06:45',
        Dhuhr: '12:05',
        Asr: '15:05',
        Maghrib: '17:22',
        Isha: '18:48',
      },
    },
  };
  storage.saveSourceScheduleCache(scheduleData);

  // Call API function with matching city & country
  const res = await aladhanApi.fetchAladhanPrayerTimesForLocation('Tunis', 'Tunisia', targetDate);

  assert.equal(res.success, true);
  assert.equal(res.source, 'جدول مواقيت Aladhan المحفوظ محلياً');
  assert.deepEqual(res.times, scheduleData.schedule[targetDate]);
  assert.equal(res.city, 'Tunis');
  assert.equal(res.country, 'Tunisia');
});

// ====================================================================
// SUITE 5: SETTINGSVIEW IMPORT CONTRACT ANOMALY EMPIRICAL PROOF
// ====================================================================
console.log('\n--- SUITE 5: SettingsView Import Contract Empirical Proof ---');

await test('Contract Verification: importFullUserDataJSON returns boolean `true`, whereas SettingsView checks `if (result.success)`', () => {
  mockStorage.clear();
  const validJson = storage.exportFullUserDataJSON();
  const result = storage.importFullUserDataJSON(validJson);

  // In storage.js, return value is boolean true
  assert.equal(result, true, 'importFullUserDataJSON returns boolean true');

  // In JavaScript: (true).success is undefined
  assert.equal(result.success, undefined, 'true.success evaluates to undefined');

  // SettingsView.jsx:328 executes `if (result.success)`
  const settingsViewCheck = Boolean(result.success);
  assert.equal(settingsViewCheck, false, 'SettingsView if(result.success) evaluates to FALSE for a valid import!');

  console.log('    ℹ EMPIRICAL FINDING CONFIRMED:');
  console.log('      storage.js returns boolean `true`');
  console.log('      SettingsView.jsx:328 expects `{ success: true }`');
  console.log('      Result in UI: Valid imports erroneously display failure alert unless result is handled as boolean or object.');
});

// ====================================================================
// SUMMARY & VERDICT
// ====================================================================
console.log('\n================================================================');
console.log(`🏁 CHALLENGER M1_2 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
  process.exitCode = 1;
}
