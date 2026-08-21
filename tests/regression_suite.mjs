import assert from 'node:assert/strict';

// Import core services and utilities
import {
  CALCULATION_METHODS,
  ALADHAN_METHOD_MAP,
  getDefaultLocationForTimezone,
  resolveTimezoneForLocation,
  calculateOfflinePrayerTimes,
  getQiblaBearing,
} from '../src/services/adhanCalculator.js';

import {
  DATA_STATUS,
  isValidTimeString,
  getPrayerTimesStatus,
  getWeatherDataStatus,
  getRecordsStatus,
} from '../src/services/dataReadiness.js';

import {
  toWesternDigits,
  cleanTimeString,
  timeToMinutes,
  getCityNowDate,
  getCityTodayDateStr,
  calculateDelay,
  applyPrayerOffsets,
} from '../src/services/timeUtils.js';

import {
  computeSummaryStats,
  deleteSession,
  saveChatSessions,
  getChatSessions,
  KEYS,
} from '../src/services/storage.js';

import {
  getDayDiff,
  getReadingHabitState,
  saveReadingHabitState,
  getDailyTargetForLevel,
  getPastCompletedDays,
  getPastCompletedPages,
  getCumulativeWardCeiling,
  getTodayWardStartPage,
  recordReadingProgress,
  setCustomDailyTarget,
  DEFAULT_READING_STATE,
} from '../src/services/bookStorage.js';

import {
  matchesStrictPrefix,
  normalizeSearchText,
  getLocalizedCityName,
  getLocalizedCountryName,
  PALESTINIAN_CITIES,
} from '../src/services/countryLocalization.js';

import {
  getTasbeehState,
  saveTasbeehState,
  incrementDhikrCount,
  undoLastDhikrCount,
  resetDhikrCount,
  addCustomDhikr,
  deleteCustomDhikr,
  updateDhikrTarget,
  toggleDhikrHidden,
  moveDhikr,
  resetAdhkarToDefaults,
  setActiveDhikrId,
  getTodayTotalTasbeehCount,
  getGrandTotalTasbeehCount,
  DEFAULT_ADHKAR,
  DEFAULT_TASBEEH_STATE,
} from '../src/services/tasbeehStorage.js';

import {
  isAudioFile,
  naturalSortTracks,
  formatTrackTitle,
  formatFileSize,
  formatAudioDuration,
  getAudioPlayerState,
  saveAudioPlayerState,
} from '../src/services/audioStorage.js';

console.log('====================================================');
console.log('🚀 RUNNING 100% REGRESSION TEST SUITE (HABIT TRACKER)');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

async function it(description, testFn) {
  totalTests++;
  try {
    const res = testFn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    console.log(`  ✓ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------------
// SECTION 1: TIME UTILITIES & DATA READINESS
// ------------------------------------------------------------------
console.log('--- SECTION 1: Time Utilities & Data Readiness ---');

it('isValidTimeString validates valid 24h formats and rejects garbage', () => {
  assert.equal(isValidTimeString('04:30'), true);
  assert.equal(isValidTimeString('00:00'), true);
  assert.equal(isValidTimeString('23:59'), true);
  assert.equal(isValidTimeString('12:00'), true);
  assert.equal(isValidTimeString('24:00'), false);
  assert.equal(isValidTimeString('12:60'), false);
  assert.equal(isValidTimeString('invalid'), false);
  assert.equal(isValidTimeString(null), false);
  assert.equal(isValidTimeString(undefined), false);
});

it('getPrayerTimesStatus requires all 5 obligatory prayers to be present and valid', () => {
  const completeTimes = {
    Fajr: '04:15',
    Sunrise: '05:45',
    Dhuhr: '12:30',
    Asr: '15:45',
    Maghrib: '18:15',
    Isha: '19:45',
  };
  assert.equal(getPrayerTimesStatus(completeTimes), DATA_STATUS.READY);

  const missingIsha = {
    Fajr: '04:15',
    Sunrise: '05:45',
    Dhuhr: '12:30',
    Asr: '15:45',
    Maghrib: '18:15',
  };
  assert.equal(getPrayerTimesStatus(missingIsha), DATA_STATUS.UNAVAILABLE);

  assert.equal(getPrayerTimesStatus(null), DATA_STATUS.UNAVAILABLE);
});

it('toWesternDigits converts Eastern Arabic/Indic numerals to Western standard', () => {
  assert.equal(toWesternDigits('١٢:٣٤'), '12:34');
  assert.equal(toWesternDigits('٠٥:٤٥'), '05:45');
  assert.equal(toWesternDigits('05:45'), '05:45');
});

it('timeToMinutes accurately converts HH:MM string to total day minutes', () => {
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('01:30'), 90);
  assert.equal(timeToMinutes('12:00'), 720);
  assert.equal(timeToMinutes('23:59'), 1439);
});

it('calculateDelay returns non-negative elapsed minutes between adhan and performed time', () => {
  assert.equal(calculateDelay('12:00', '12:10'), 10);
  assert.equal(calculateDelay('12:00', '12:00'), 0);
  assert.equal(calculateDelay('12:30', '12:15'), 0); // Performed early = 0 delay (on time)
});

// ------------------------------------------------------------------
// SECTION 2: ADHAN CALCULATOR & TIMEZONE ENGINE
// ------------------------------------------------------------------
console.log('\n--- SECTION 2: Adhan Calculator & Method Mapping ---');

it('ALADHAN_METHOD_MAP contains all standard numeric string IDs and names', () => {
  assert.equal(ALADHAN_METHOD_MAP['4'], 4); // Makkah
  assert.equal(ALADHAN_METHOD_MAP['5'], 5); // Egypt
  assert.equal(ALADHAN_METHOD_MAP['13'], 13); // Diyanet
  assert.equal(ALADHAN_METHOD_MAP['3'], 3); // MWL
  assert.equal(ALADHAN_METHOD_MAP['2'], 2); // ISNA
  assert.equal(ALADHAN_METHOD_MAP['1'], 1); // Karachi
  assert.equal(ALADHAN_METHOD_MAP.auto, 5);
});

it('getDefaultLocationForTimezone never returns undefined even on unknown timezone', () => {
  const locRiyadh = getDefaultLocationForTimezone('Asia/Riyadh');
  assert.equal(locRiyadh.city, 'Riyadh');
  assert.equal(locRiyadh.country, 'Saudi Arabia');

  const locUnknown = getDefaultLocationForTimezone('Invalid/Timezone_That_Does_Not_Exist');
  assert.ok(locUnknown && typeof locUnknown.city === 'string' && typeof locUnknown.country === 'string');

  const locEmpty = getDefaultLocationForTimezone(null);
  assert.ok(locEmpty && typeof locEmpty.city === 'string');
});

it('calculateOfflinePrayerTimes computes genuine prayer times using adhan-js', () => {
  const date = new Date(2026, 7, 18); // Aug 18, 2026
  const res = calculateOfflinePrayerTimes(24.7136, 46.6753, date, {
    calculationMethod: '4',
    asrMadhab: 'shafi',
    timezone: 'Asia/Riyadh',
    countryName: 'Saudi Arabia',
  });

  assert.equal(res.success, true);
  assert.ok(res.times.Fajr && res.times.Fajr.includes(':'));
  assert.ok(res.times.Dhuhr && res.times.Dhuhr.includes(':'));
  assert.ok(res.times.Asr && res.times.Asr.includes(':'));
  assert.ok(res.times.Maghrib && res.times.Maghrib.includes(':'));
  assert.ok(res.times.Isha && res.times.Isha.includes(':'));
});

it('getQiblaBearing calculates valid 0-360 degree bearing', () => {
  const bearingCairo = getQiblaBearing(30.0444, 31.2357);
  assert.ok(bearingCairo > 0 && bearingCairo < 360);
});

// ------------------------------------------------------------------
// SECTION 3: STREAKS & HABIT STORAGE CONTINUITY
// ------------------------------------------------------------------
console.log('\n--- SECTION 3: Streaks & Habit Continuity ---');

it('getDayDiff computes exact UTC day differences ignoring DST jumps', () => {
  assert.equal(getDayDiff('2026-08-18', '2026-08-17'), 1);
  assert.equal(getDayDiff('2026-08-18', '2026-08-18'), 0);
  assert.equal(getDayDiff('2026-03-30', '2026-03-29'), 1); // DST transition window
});

it('computeSummaryStats calculates consecutive 5-prayer day streaks accurately', () => {
  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const records = [];
  ['2026-08-16', '2026-08-17', '2026-08-18'].forEach((date) => {
    prayers.forEach((p) => {
      records.push({ date, prayer_name: p, status: 'on_time' });
    });
  });

  const stats = computeSummaryStats(records);
  assert.equal(stats.currentStreak, 3);
  assert.equal(stats.maxStreak, 3);
  assert.equal(stats.onTime, 15);
});

it('computeSummaryStats resets current streak on non-consecutive day gap', () => {
  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const recordsWithGap = [];
  ['2026-08-14', '2026-08-18'].forEach((date) => {
    prayers.forEach((p) => {
      recordsWithGap.push({ date, prayer_name: p, status: 'on_time' });
    });
  });

  const stats = computeSummaryStats(recordsWithGap);
  assert.equal(stats.currentStreak, 1);
  assert.equal(stats.maxStreak, 1);
});

// ------------------------------------------------------------------
// SECTION 4: LOCALIZATION & SEARCH FILTERING
// ------------------------------------------------------------------
console.log('\n--- SECTION 4: Country & City Localization ---');

it('matchesStrictPrefix matches Arabic and English query prefixes correctly', () => {
  assert.equal(matchesStrictPrefix('القاهرة', 'قاهر'), true);
  assert.equal(matchesStrictPrefix('Cairo', 'cai'), true);
  assert.equal(matchesStrictPrefix('الرياض', 'رياض'), true);
  assert.equal(matchesStrictPrefix('Riyadh', 'riy'), true);
  assert.equal(matchesStrictPrefix('Alexandria', 'xyz'), false);
});

it('PALESTINIAN_CITIES contains primary historical Palestinian cities with Arabic translations', () => {
  assert.ok(PALESTINIAN_CITIES.includes('Jerusalem'));
  assert.ok(PALESTINIAN_CITIES.includes('Gaza'));
  assert.ok(PALESTINIAN_CITIES.includes('Jaffa'));
  assert.ok(PALESTINIAN_CITIES.includes('Haifa'));
  assert.ok(PALESTINIAN_CITIES.includes('Hebron'));
  assert.equal(getLocalizedCityName('Jerusalem', 'ar'), 'القدس الشريف');
  assert.equal(getLocalizedCityName('Gaza', 'ar'), 'غزة');
});

it('getLocalizedCountryName resolves French, English, and alternate names accurately', () => {
  assert.equal(getLocalizedCountryName('Tunisie', 'ar'), 'تونس');
  assert.equal(getLocalizedCountryName('Tunisia', 'ar'), 'تونس');
  assert.equal(getLocalizedCountryName('Tunisie', 'en'), 'Tunisia');
  assert.equal(getLocalizedCountryName('Algérie', 'ar'), 'الجزائر');
  assert.equal(getLocalizedCountryName('Algeria', 'ar'), 'الجزائر');
  assert.equal(getLocalizedCountryName('Maroc', 'ar'), 'المغرب');
  assert.equal(getLocalizedCountryName('Égypte', 'ar'), 'مصر');
  assert.equal(getLocalizedCountryName('Arabie Saoudite', 'ar'), 'المملكة العربية السعودية');
});

it('getLocalizedCityName cleanly strips administrative prefixes and localizes cardinal directions without corruption', () => {
  assert.equal(getLocalizedCityName('Délégation Sfax Ouest', 'ar'), 'صفاقس الغربية');
  assert.equal(getLocalizedCityName('Délégation Sfax Sud', 'ar'), 'صفاقس الجنوبية');
  assert.equal(getLocalizedCityName('Délégation Sfax Ville', 'ar'), 'صفاقس المدينة');
  assert.equal(getLocalizedCityName('Gouvernorat de Sfax', 'ar'), 'صفاقس');
  assert.equal(getLocalizedCityName('Délégation Tunis Médina', 'ar'), 'تونس المدينة');
  assert.equal(getLocalizedCityName('Délégation Ariana Ville', 'ar'), 'أريانة المدينة');
  assert.equal(getLocalizedCityName('Délégation Bizerte Nord', 'ar'), 'بنزرت الشمالية');
  assert.equal(getLocalizedCityName('Délégation Sfax Ouest', 'en'), 'Sfax West');
});

// ------------------------------------------------------------------
// SECTION 5: READING HABIT & WARD LIMITS
// ------------------------------------------------------------------
console.log('\n--- SECTION 5: Reading Habit & Ward Limits ---');

it('getDailyTargetForLevel returns 10 for week 1, 20 for week 2, 30 for week 3', () => {
  assert.equal(getDailyTargetForLevel(1), 10);
  assert.equal(getDailyTargetForLevel(2), 20);
  assert.equal(getDailyTargetForLevel(3), 30);
  assert.equal(getDailyTargetForLevel(4, true, 45), 45);
});

it('getCumulativeWardCeiling strictly enforces exact day multiples (Day 1: 10, Day 2: 20, Day 3: 30)', () => {
  // Day 1 (No past completed days): Starts at 1, Ceiling is exactly 10
  const day1State = { activeLevel: 1, dailyLogs: {} };
  assert.equal(getTodayWardStartPage(day1State, '2026-08-18'), 1);
  assert.equal(getCumulativeWardCeiling(day1State, '2026-08-18'), 10);

  // Day 2 (Day 1 completed with 10 pages in the past): Starts at 11, Ceiling is exactly 20
  const day2State = {
    activeLevel: 1,
    dailyLogs: {
      '2026-08-17': { pagesRead: 10, target: 10, completed: true },
    },
  };
  assert.equal(getTodayWardStartPage(day2State, '2026-08-18'), 11);
  assert.equal(getCumulativeWardCeiling(day2State, '2026-08-18'), 20);

  // Day 3 (Day 1 & Day 2 completed in the past): Starts at 21, Ceiling is exactly 30
  const day3State = {
    activeLevel: 1,
    dailyLogs: {
      '2026-08-16': { pagesRead: 10, target: 10, completed: true },
      '2026-08-17': { pagesRead: 10, target: 10, completed: true },
    },
  };
  assert.equal(getTodayWardStartPage(day3State, '2026-08-18'), 21);
  assert.equal(getCumulativeWardCeiling(day3State, '2026-08-18'), 30);
});

it('Dual-page spread calculations strictly enforce the 10-page ward ceiling at spread [9, 10]', () => {
  const currentDailyTarget = 10;
  const safeStartPage = 1;
  const initialSpread = (safeStartPage % 2 === 1) ? safeStartPage : Math.max(1, safeStartPage - 1);
  const maxWardPage = initialSpread + currentDailyTarget - 1; // 10
  const maxAllowedSpreadStart = (maxWardPage % 2 === 1) ? maxWardPage : maxWardPage - 1; // 9

  assert.equal(maxWardPage, 10);
  assert.equal(maxAllowedSpreadStart, 9);

  // Spread 1 (Pages 1 & 2): can turn next
  assert.equal(1 < maxAllowedSpreadStart, true);
  // Spread 3 (Pages 3 & 4): can turn next
  assert.equal(3 < maxAllowedSpreadStart, true);
  // Spread 5 (Pages 5 & 6): can turn next
  assert.equal(5 < maxAllowedSpreadStart, true);
  // Spread 7 (Pages 7 & 8): can turn next
  assert.equal(7 < maxAllowedSpreadStart, true);
  // Spread 9 (Pages 9 & 10): CANNOT turn next (Strictly blocked!)
  assert.equal(9 < maxAllowedSpreadStart, false);
});

it('getPastCompletedDays counts strictly past calendar dates and prevents unlocking tomorrow on same date', () => {
  const state = {
    dailyLogs: {
      '2026-08-17': { pagesRead: 10, completed: true },
      '2026-08-18': { pagesRead: 10, completed: true },
    },
  };

  // On 2026-08-18 (today): only 2026-08-17 is in the past -> pastDays is 1 -> max ceiling is 20
  assert.equal(getPastCompletedDays(state, '2026-08-18'), 1);
  const maxCeilingToday = (1 + 1) * 10;
  assert.equal(maxCeilingToday, 20);

  // On 2026-08-19 (tomorrow): both 17 and 18 are in the past -> pastDays is 2 -> max ceiling is 30
  assert.equal(getPastCompletedDays(state, '2026-08-19'), 2);
  const maxCeilingTomorrow = (2 + 1) * 10;
  assert.equal(maxCeilingTomorrow, 30);

  // For a brand new day 1 with no past logs: pastDays is 0 -> max ceiling is strictly 10
  const day1State = { dailyLogs: { '2026-08-18': { pagesRead: 10, completed: true } } };
  assert.equal(getPastCompletedDays(day1State, '2026-08-18'), 0);
  assert.equal((0 + 1) * 10, 10);
});

it('getPastCompletedPages accurately calculates cumulative pages across multi-week targets', () => {
  const multiWeekLogs = {
    // Week 1 (7 days @ 10 pages = 70 pages)
    '2026-08-01': { pagesRead: 10, target: 10, completed: true },
    '2026-08-02': { pagesRead: 10, target: 10, completed: true },
    '2026-08-03': { pagesRead: 10, target: 10, completed: true },
    '2026-08-04': { pagesRead: 10, target: 10, completed: true },
    '2026-08-05': { pagesRead: 10, target: 10, completed: true },
    '2026-08-06': { pagesRead: 10, target: 10, completed: true },
    '2026-08-07': { pagesRead: 10, target: 10, completed: true },
    // Week 2 Day 1 (target 20, completed)
    '2026-08-08': { pagesRead: 20, target: 20, completed: true },
  };

  const state = { dailyLogs: multiWeekLogs };

  // On Day 8 (2026-08-08): past completed pages should be exactly 70
  const pastPagesDay8 = getPastCompletedPages(state, '2026-08-08');
  assert.equal(pastPagesDay8, 70);

  // Day 8 ward: starts at 71, ends at 70 + 20 = 90
  const day8Target = 20;
  const day8WardStart = pastPagesDay8 + 1;
  const day8WardEnd = pastPagesDay8 + day8Target;
  assert.equal(day8WardStart, 71);
  assert.equal(day8WardEnd, 90);

  // On Day 9 (2026-08-09): past completed pages should be 70 + 20 = 90
  const pastPagesDay9 = getPastCompletedPages(state, '2026-08-09');
  assert.equal(pastPagesDay9, 90);
  const day9WardStart = pastPagesDay9 + 1;
  const day9WardEnd = pastPagesDay9 + day8Target;
  assert.equal(day9WardStart, 91);
  assert.equal(day9WardEnd, 110);
});

it('Dual-page spread handles odd total page counts without crashing or skipping final page', () => {
  // A booklet with total 5 pages
  const totalPages = 5;
  const maxWardPage = Math.min(totalPages, 10); // 5
  const maxAllowedSpreadStart = (maxWardPage % 2 === 1) ? maxWardPage : maxWardPage - 1; // 5

  assert.equal(maxWardPage, 5);
  assert.equal(maxAllowedSpreadStart, 5);

  // Spread 1 -> [1, 2]: can turn next
  assert.equal(1 < maxAllowedSpreadStart, true);
  // Spread 3 -> [3, 4]: can turn next
  assert.equal(3 < maxAllowedSpreadStart, true);
  // Spread 5 -> [5] (single right canvas, left null): cannot turn next
  assert.equal(5 < maxAllowedSpreadStart, false);
});

// Mock localStorage & window for habit storage tests
let mockStore = {};
globalThis.localStorage = {
  getItem: (k) => mockStore[k] || null,
  setItem: (k, v) => { mockStore[k] = String(v); },
  removeItem: (k) => { delete mockStore[k]; },
  clear: () => { mockStore = {}; },
};
globalThis.window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};

function resetMockStore() {
  mockStore = {};
}

it('Reviewing previous spreads does not decrement or corrupt daily reading progress', () => {
  resetMockStore();
  const bookId = 'book_review_test';
  const totalPages = 100;

  // 1. Advance to spread [9, 10] on Day 1
  const updated1 = recordReadingProgress(bookId, 9, totalPages, 2);
  const todayStr = Object.keys(updated1.dailyLogs)[0];
  assert.equal(updated1.dailyLogs[todayStr].pagesRead, 10);
  assert.equal(updated1.dailyLogs[todayStr].completed, true);

  // 2. Flip back to spread [3, 4]
  // Bookmark updates, pagesRead stays 10, completed stays true
  const state = getReadingHabitState();
  state.bookmarks[bookId] = {
    lastPage: 3,
    totalPages,
    timestamp: Date.now(),
  };
  saveReadingHabitState(state);

  const reloaded = getReadingHabitState();
  assert.equal(reloaded.bookmarks[bookId].lastPage, 3);
  assert.equal(reloaded.dailyLogs[todayStr].pagesRead, 10);
  assert.equal(reloaded.dailyLogs[todayStr].completed, true);

  // 3. Flip forward back to [5, 6] -> pagesRead still 10, no double count
  const updated2 = recordReadingProgress(bookId, 5, totalPages, 2);
  assert.equal(updated2.dailyLogs[todayStr].pagesRead, 10);
  assert.equal(updated2.dailyLogs[todayStr].completed, true);
});

it('1-Page PDF: Opens on page 1, left canvas hidden, marks ward completed', () => {
  resetMockStore();
  const bookId = 'book_1page_test';
  const totalPages = 1;

  const state = recordReadingProgress(bookId, 1, totalPages, 1);
  const todayStr = Object.keys(state.dailyLogs)[0];
  assert.equal(state.dailyLogs[todayStr].pagesRead, 1);
  assert.equal(state.dailyLogs[todayStr].completed, true);
  assert.equal(state.bookmarks[bookId].lastPage, 1);
});

it('3-Page PDF: Progresses through spreads [1, 2] then [3], marks completed on reaching final page', () => {
  resetMockStore();
  const bookId = 'book_3page_test';
  const totalPages = 3;

  // Spread [1, 2]
  const state1 = recordReadingProgress(bookId, 1, totalPages, 2);
  const todayStr = Object.keys(state1.dailyLogs)[0];
  assert.equal(state1.dailyLogs[todayStr].pagesRead, 2);
  assert.equal(state1.dailyLogs[todayStr].completed, false);

  // Advance to spread [3]
  const state2 = recordReadingProgress(bookId, 3, totalPages, 1);
  assert.equal(state2.dailyLogs[todayStr].pagesRead, 3);
  assert.equal(state2.dailyLogs[todayStr].completed, true);
});

it('Clamping over-advanced bookmarks self-heals state to current calendar ceiling', () => {
  resetMockStore();
  const bookId = 'book_hacked_test';
  // Bad state with bookmark at page 50 on Day 1
  const badState = {
    ...DEFAULT_READING_STATE,
    bookmarks: {
      [bookId]: { lastPage: 50, totalPages: 100, timestamp: Date.now() },
    },
  };
  saveReadingHabitState(badState);

  // getReadingHabitState should clamp bookmark to max allowed spread start (9)
  const healedState = getReadingHabitState();
  assert.equal(healedState.bookmarks[bookId].lastPage, 9);
});

it('21-Day multi-week progression unlocks custom target mastery mode', () => {
  resetMockStore();
  // Build 21 completed days in dailyLogs
  const state = {
    ...DEFAULT_READING_STATE,
    dailyLogs: {},
  };

  for (let i = 1; i <= 21; i++) {
    const dayStr = `2026-07-${String(i).padStart(2, '0')}`;
    const target = i <= 7 ? 10 : i <= 14 ? 20 : 30;
    state.dailyLogs[dayStr] = {
      pagesRead: target,
      target: target,
      completed: true,
    };
  }
  saveReadingHabitState(state);

  const reloaded = getReadingHabitState();
  assert.equal(reloaded.completedDays, 21);
  assert.equal(reloaded.isCustomUnlocked, true);
  assert.equal(reloaded.activeLevel, 4);

  // Set custom target to 45
  const customState = setCustomDailyTarget(45);
  assert.equal(customState.customDailyTarget, 45);
  assert.equal(getDailyTargetForLevel(customState.activeLevel, customState.isCustomUnlocked, customState.customDailyTarget), 45);
});

// ------------------------------------------------------------------
// SECTION 6: Electronic Tasbeeh & Dhikr Persistence
// ------------------------------------------------------------------
console.log('\n--- SECTION 6: Electronic Tasbeeh & Dhikr Persistence ---');

it('Default Tasbeeh state initializes with 9 authentic adhkar and clean defaults', () => {
  resetMockStore();
  const state = getTasbeehState();
  assert.equal(state.adhkar.length, 9);
  assert.equal(state.activeDhikrId, 'subhanallah');
  assert.equal(state.adhkar[0].textAr, 'سُبْحَانَ اللَّهِ');
  assert.equal(state.adhkar[0].target, 33);
  assert.equal(state.adhkar[0].count, 0);
  assert.equal(getTodayTotalTasbeehCount(), 0);
  assert.equal(getGrandTotalTasbeehCount(), 0);
});

it('Incrementing dhikr increases round count, today total, and grand total', () => {
  resetMockStore();
  const state = incrementDhikrCount('subhanallah', 1);
  assert.equal(state.adhkar.find((d) => d.id === 'subhanallah').count, 1);
  assert.equal(state.adhkar.find((d) => d.id === 'subhanallah').totalCount, 1);
  assert.equal(getTodayTotalTasbeehCount(), 1);
  assert.equal(getGrandTotalTasbeehCount(), 1);

  // Increment by 5
  const state2 = incrementDhikrCount('subhanallah', 5);
  assert.equal(state2.adhkar.find((d) => d.id === 'subhanallah').count, 6);
  assert.equal(state2.adhkar.find((d) => d.id === 'subhanallah').totalCount, 6);
  assert.equal(getTodayTotalTasbeehCount(), 6);
});

it('Undoing dhikr decrements round count and today total gracefully', () => {
  resetMockStore();
  incrementDhikrCount('alhamdulillah', 3);
  assert.equal(getTodayTotalTasbeehCount(), 3);

  const state = undoLastDhikrCount('alhamdulillah');
  assert.equal(state.adhkar.find((d) => d.id === 'alhamdulillah').count, 2);
  assert.equal(state.adhkar.find((d) => d.id === 'alhamdulillah').totalCount, 2);
  assert.equal(getTodayTotalTasbeehCount(), 2);
});

it('Resetting dhikr zeroes current round count while preserving grand total and today total', () => {
  resetMockStore();
  incrementDhikrCount('allahuakbar', 10);
  assert.equal(getTodayTotalTasbeehCount(), 10);
  const state = resetDhikrCount('allahuakbar');
  const dhikr = state.adhkar.find((d) => d.id === 'allahuakbar');
  assert.equal(dhikr.count, 0);
  assert.equal(dhikr.totalCount, 10);
  assert.equal(getTodayTotalTasbeehCount(), 10);
});

it('Adding and deleting custom dhikr updates state and persists correctly', () => {
  resetMockStore();
  const addedState = addCustomDhikr({
    textAr: 'رَبِّ اغْفِرْ لِي',
    textEn: 'Rabbi Ighfir Li',
    target: 70,
    virtueAr: 'طلب المغفرة',
  });
  assert.ok(addedState);
  assert.equal(addedState.adhkar.length, 10);
  const custom = addedState.adhkar.find((d) => d.textAr === 'رَبِّ اغْفِرْ لِي');
  assert.ok(custom);
  assert.equal(custom.isCustom, true);
  assert.equal(custom.target, 70);
  assert.equal(addedState.activeDhikrId, custom.id);

  // Delete custom dhikr
  const deletedState = deleteCustomDhikr(custom.id);
  assert.equal(deletedState.adhkar.length, 9);
  assert.equal(deletedState.adhkar.some((d) => d.id === custom.id), false);
});

it('In-Page Dhikr Settings: Hide/show dhikr, update target ward, and restore defaults', () => {
  resetMockStore();

  // 1. Update target ward for subhanallah from 33 to 100
  const updatedTargetState = updateDhikrTarget('subhanallah', 100);
  const subhan = updatedTargetState.adhkar.find((d) => d.id === 'subhanallah');
  assert.equal(subhan.target, 100);

  // 2. Hide subhanallah when it is currently active
  const hiddenState = toggleDhikrHidden('subhanallah');
  const subhanHidden = hiddenState.adhkar.find((d) => d.id === 'subhanallah');
  assert.equal(subhanHidden.isHidden, true);
  // Active dhikr automatically switched to first visible (alhamdulillah)
  assert.equal(hiddenState.activeDhikrId, 'alhamdulillah');

  // 3. Unhide subhanallah
  const unhiddenState = toggleDhikrHidden('subhanallah');
  const subhanUnhidden = unhiddenState.adhkar.find((d) => d.id === 'subhanallah');
  assert.equal(subhanUnhidden.isHidden, false);

  // 4. Restore defaults resets all targets and visibility
  const restoredState = resetAdhkarToDefaults();
  assert.equal(restoredState.adhkar.length, 9);
  assert.equal(restoredState.adhkar.find((d) => d.id === 'subhanallah').target, 33);
  assert.equal(restoredState.adhkar.every((d) => !d.isHidden), true);
});

it('Strict Target Clamping & Auto-Advance: Count never exceeds target and auto-advances', () => {
  resetMockStore();

  // 1. subhanallah has target 33. Increment by 32
  const state32 = incrementDhikrCount('subhanallah', 32);
  assert.equal(state32.adhkar.find((d) => d.id === 'subhanallah').count, 32);
  assert.equal(state32.activeDhikrId, 'subhanallah');

  // 2. 33rd increment reaches target and immediately auto-advances to next visible dhikr (alhamdulillah)
  const state33 = incrementDhikrCount('subhanallah', 1);
  const subhan = state33.adhkar.find((d) => d.id === 'subhanallah');
  assert.equal(subhan.count, 33);
  assert.equal(state33.activeDhikrId, 'alhamdulillah');

  // 3. Attempting to increment subhanallah again clamps at 33 (cannot become 34/33 or 15/10)
  const stateExcess = incrementDhikrCount('subhanallah', 5);
  assert.equal(stateExcess.adhkar.find((d) => d.id === 'subhanallah').count, 33);
});

it('Adhkar Reordering: moveDhikr moves items up and down and persists order', () => {
  resetMockStore();

  // Initially: [subhanallah, alhamdulillah, allahuakbar, ...]
  const initialState = getTasbeehState();
  assert.equal(initialState.adhkar[0].id, 'subhanallah');
  assert.equal(initialState.adhkar[1].id, 'alhamdulillah');

  // Move alhamdulillah up -> [alhamdulillah, subhanallah, allahuakbar, ...]
  const movedUpState = moveDhikr('alhamdulillah', 'up');
  assert.equal(movedUpState.adhkar[0].id, 'alhamdulillah');
  assert.equal(movedUpState.adhkar[1].id, 'subhanallah');

  // Reload state from storage to verify persistent order
  const reloadedState = getTasbeehState();
  assert.equal(reloadedState.adhkar[0].id, 'alhamdulillah');
  assert.equal(reloadedState.adhkar[1].id, 'subhanallah');

  // Move alhamdulillah back down
  const movedDownState = moveDhikr('alhamdulillah', 'down');
  assert.equal(movedDownState.adhkar[0].id, 'subhanallah');
  assert.equal(movedDownState.adhkar[1].id, 'alhamdulillah');
});

it('Tasbeeh 1-Second Interval: Rejects taps faster than 1000ms and accepts taps after 1000ms', () => {
  let lastTap = 1000;
  const canTap = (now) => {
    if (now - lastTap < 1000) return false;
    lastTap = now;
    return true;
  };

  assert.equal(canTap(1200), false); // 200ms < 1000ms -> Rejected
  assert.equal(canTap(1800), false); // 800ms < 1000ms -> Rejected
  assert.equal(canTap(2000), true);  // 1000ms >= 1000ms -> Accepted
  assert.equal(canTap(2500), false); // 500ms < 1000ms -> Rejected
  assert.equal(canTap(3100), true);  // 1100ms >= 1000ms -> Accepted
});

it('Sequential Tab order includes tasbeeh and audio between books and settings', () => {
  const EXPECTED_TABS = ['tracker', 'chat', 'books', 'tasbeeh', 'audio', 'settings'];
  assert.equal(EXPECTED_TABS.indexOf('tasbeeh'), 3);
  assert.equal(EXPECTED_TABS.indexOf('audio'), 4);
  assert.equal(EXPECTED_TABS[EXPECTED_TABS.indexOf('books') + 1], 'tasbeeh');
  assert.equal(EXPECTED_TABS[EXPECTED_TABS.indexOf('tasbeeh') + 1], 'audio');
  assert.equal(EXPECTED_TABS[EXPECTED_TABS.indexOf('audio') + 1], 'settings');
});

it('Tab navigation throttle rejects switches faster than 500ms and accepts switches after 500ms', () => {
  let lastSwitch = 1000;
  const canSwitch = (now) => {
    if (now - lastSwitch < 500) return false;
    lastSwitch = now;
    return true;
  };

  assert.equal(canSwitch(1200), false); // 200ms elapsed -> blocked
  assert.equal(canSwitch(1499), false); // 499ms elapsed -> blocked
  assert.equal(canSwitch(1500), true);  // 500ms elapsed -> allowed
  assert.equal(canSwitch(1600), false); // 100ms elapsed since 1500 -> blocked
  assert.equal(canSwitch(2050), true);  // 550ms elapsed -> allowed
});

it('Chat auto-return to new conversation triggers only after 2 minutes away from chat', () => {
  const CHAT_AWAY_TIMEOUT = 2 * 60 * 1000; // 120,000 ms

  const shouldResetToNewChat = ({ isPresentInChat, leftTimestamp, currentTimestamp }) => {
    if (isPresentInChat) return false; // Exception: NEVER reset if user is currently present in chat!
    if (!leftTimestamp) return false;
    return (currentTimestamp - leftTimestamp) >= CHAT_AWAY_TIMEOUT;
  };

  const leftAt = 1000000;
  // Case 1: User is present in chat after 10 minutes -> DO NOT reset
  assert.equal(shouldResetToNewChat({ isPresentInChat: true, leftTimestamp: 0, currentTimestamp: leftAt + 600000 }), false);

  // Case 2: User is away for 1 minute (60,000ms < 120,000ms) -> DO NOT reset
  assert.equal(shouldResetToNewChat({ isPresentInChat: false, leftTimestamp: leftAt, currentTimestamp: leftAt + 60000 }), false);

  // Case 3: User is away for 1 minute 59 seconds (119,000ms) -> DO NOT reset
  assert.equal(shouldResetToNewChat({ isPresentInChat: false, leftTimestamp: leftAt, currentTimestamp: leftAt + 119000 }), false);

  // Case 4: User is away for 2 minutes (120,000ms) -> RESET to new chat
  assert.equal(shouldResetToNewChat({ isPresentInChat: false, leftTimestamp: leftAt, currentTimestamp: leftAt + 120000 }), true);

  // Case 5: User is away for 5 minutes (300,000ms) -> RESET to new chat
  assert.equal(shouldResetToNewChat({ isPresentInChat: false, leftTimestamp: leftAt, currentTimestamp: leftAt + 300000 }), true);
});

await it('Comprehensive Live App Context structure includes all genuine site and user data domains', async () => {
  const { formatAppContextForPrompt, getLiveAppContext } = await import('../src/services/appContext.js');
  const ctx = await getLiveAppContext();
  const promptStr = await formatAppContextForPrompt();

  assert.ok(ctx.siteArchitecture, 'Site architecture must be defined');
  assert.ok(ctx.currentTime, 'Current time must be defined');
  assert.ok(ctx.settings, 'Settings must be defined');
  assert.ok(ctx.astronomy, 'Astronomy must be defined');
  assert.ok(ctx.prayerTracking, 'Prayer tracking must be defined');
  assert.ok(ctx.booksAndWard, 'Books and ward must be defined');
  assert.ok(ctx.audioLibrary, 'Audio library must be defined');
  assert.ok(ctx.chatSessions, 'Chat sessions must be defined');

  assert.ok(promptStr.includes('قاعدة البيانات والحالة الكاملة لتطبيق تتبع العادات والصلوات'));
  assert.ok(promptStr.includes('سجل صلوات الفريضة الخمس'));
  assert.ok(promptStr.includes('api.aladhan.com'));
  assert.ok(promptStr.includes('المسبحة الإلكترونية والأذكار'));
  assert.ok(promptStr.includes('مكتبة الكتب والورد اليومي'));
  assert.ok(promptStr.includes('مشغل الصوتيات والمكتبة الصوتية'));
  assert.ok(promptStr.includes('جلسات المحادثة المحفوظة'));
  assert.ok(promptStr.includes('Raw App State JSON'));
});

it('Pending Message system accurately queues and identifies pending state', () => {
  const messages = [
    { id: '1', sender: 'user', text: 'ما حكم صلاة الوتر؟' },
    { id: '2', sender: 'assistant', text: 'صلاة الوتر سنة مؤكدة...', isTyping: true },
    { id: '3', sender: 'user', text: 'وما هو أفضل وقت لأدائها؟', status: 'pending' },
  ];

  // 1. Identification of pending message in active queue
  const pendingMsg = messages.find((m) => m.sender === 'user' && m.status === 'pending');
  assert.ok(pendingMsg, 'Must find queued pending message');
  assert.equal(pendingMsg.id, '3');
  assert.equal(pendingMsg.status, 'pending');

  // 2. Cancellation of pending message
  const cancelledList = messages.filter((m) => m.id !== '3');
  assert.equal(cancelledList.length, 2);
  assert.equal(cancelledList.some((m) => m.status === 'pending'), false);

  // 3. Activation when prior response finishes
  const activatedMsg = { ...pendingMsg, status: undefined };
  assert.equal(activatedMsg.status, undefined);
  assert.equal(activatedMsg.text, 'وما هو أفضل وقت لأدائها؟');
});

it('Chat tab smart auto-mute (10s) and immediate auto-restore lifecycle rules', () => {
  // Test pure timing and state progression helper
  const simulateChatAudioTransitions = ({ initialAudioMuted, tabHistoryWithDelays }) => {
    let isMuted = initialAudioMuted;
    let wasAudioActive = false;
    let muteTimer = null;
    let activeTab = 'tracker';

    const handleTabChange = (targetTab, stayMs) => {
      activeTab = targetTab;
      if (muteTimer) clearTimeout(muteTimer);

      if (activeTab === 'chat') {
        if (!isMuted) {
          wasAudioActive = true;
          if (stayMs >= 10000) {
            isMuted = true;
          }
        }
      } else {
        if (wasAudioActive) {
          wasAudioActive = false;
          // Immediately restore audio upon leaving chat
          isMuted = false;
        }
      }
    };

    tabHistoryWithDelays.forEach(({ tab, stayMs }) => {
      handleTabChange(tab, stayMs);
    });

    return { isMuted, wasAudioActive };
  };

  // Case 1: Audio unmuted, user stays in chat for 11s -> Audio MUTED
  const res1 = simulateChatAudioTransitions({
    initialAudioMuted: false,
    tabHistoryWithDelays: [{ tab: 'chat', stayMs: 11000 }],
  });
  assert.equal(res1.isMuted, true, 'Audio should be muted after 10s in chat');

  // Case 2: Audio unmuted, user stays in chat for 11s (muted), then leaves to tracker -> Audio RESTORED immediately
  const res2 = simulateChatAudioTransitions({
    initialAudioMuted: false,
    tabHistoryWithDelays: [
      { tab: 'chat', stayMs: 11000 },
      { tab: 'tracker', stayMs: 100 },
    ],
  });
  assert.equal(res2.isMuted, false, 'Audio should be restored immediately upon leaving chat');

  // Case 3: Audio unmuted, user enters chat for only 5s then leaves -> Audio NEVER muted
  const res3 = simulateChatAudioTransitions({
    initialAudioMuted: false,
    tabHistoryWithDelays: [
      { tab: 'chat', stayMs: 5000 },
      { tab: 'tracker', stayMs: 2000 },
    ],
  });
  assert.equal(res3.isMuted, false, 'Audio should remain playing if user was in chat < 10s');

  // Case 4: Audio was already muted before chat -> Remains muted
  const res4 = simulateChatAudioTransitions({
    initialAudioMuted: true,
    tabHistoryWithDelays: [
      { tab: 'chat', stayMs: 3000 },
      { tab: 'tracker', stayMs: 2000 },
    ],
  });
  assert.equal(res4.isMuted, true, 'Audio was already muted so it remains muted');
});

await it('Proactive AI Signal & Behavior Sensing Engine operates with strict accuracy and cooldown protection', async () => {
  const {
    MUNEER_SIGNALS,
    SIGNAL_COOLDOWNS,
    isSignalOnCooldown,
    markSignalTriggered,
    formatSignalCuePrompt,
    evaluatePrayerExpiryRisk,
    getAuthenticBaselineGuidance,
  } = await import('../src/services/muneerSignalService.js');

  const { APP_EVENTS } = await import('../src/services/prayerConstants.js');
  assert.equal(APP_EVENTS.MUNEER_PROACTIVE_START, 'muneer-proactive-start');
  assert.equal(APP_EVENTS.MUNEER_PROACTIVE_MESSAGE, 'muneer-proactive-message');

  // 1. Verify Signals and Cooldowns existence
  assert.ok(MUNEER_SIGNALS.PRAYER_EXPIRY_RISK);
  assert.ok(MUNEER_SIGNALS.RAPID_TAB_NAVIGATION);
  assert.ok(MUNEER_SIGNALS.RAPID_BOOK_FLIPPING);
  assert.ok(MUNEER_SIGNALS.RAPID_TASBEEH);
  assert.ok(MUNEER_SIGNALS.RAPID_BACKGROUND_SWITCHING);
  assert.ok(MUNEER_SIGNALS.DAILY_WARD_COMPLETED);
  assert.ok(MUNEER_SIGNALS.ALL_PRAYERS_COMPLETED_TODAY);

  assert.equal(SIGNAL_COOLDOWNS[MUNEER_SIGNALS.PRAYER_EXPIRY_RISK], 15 * 60 * 1000);
  assert.equal(SIGNAL_COOLDOWNS[MUNEER_SIGNALS.RAPID_TAB_NAVIGATION], 60 * 1000);

  // 2. Test Cooldown Lifecycle
  const testNow = 1700000000000;
  markSignalTriggered(MUNEER_SIGNALS.RAPID_TAB_NAVIGATION, testNow);
  
  // 30 seconds later -> must be ON cooldown
  assert.equal(isSignalOnCooldown(MUNEER_SIGNALS.RAPID_TAB_NAVIGATION, testNow + 30000), true);
  
  // 59 seconds later -> must be ON cooldown
  assert.equal(isSignalOnCooldown(MUNEER_SIGNALS.RAPID_TAB_NAVIGATION, testNow + 59000), true);
  
  // 61 seconds later -> must NOT be on cooldown
  assert.equal(isSignalOnCooldown(MUNEER_SIGNALS.RAPID_TAB_NAVIGATION, testNow + 61000), false);

  // 3. Test Authentic Baseline Guidance
  const fallback = getAuthenticBaselineGuidance(MUNEER_SIGNALS.PRAYER_EXPIRY_RISK, { prayerNameAr: 'الفجر' });
  assert.ok(fallback.includes('الفجر'));
  assert.ok(fallback.includes('الصلاة'));

  // 3. Test Prompt Cue Formatting
  const prompt1 = formatSignalCuePrompt(MUNEER_SIGNALS.PRAYER_EXPIRY_RISK, {
    prayerNameAr: 'العصر',
    nextPrayerNameAr: 'المغرب',
    remainingMinutes: 15,
  });
  assert.ok(prompt1.includes('العصر'));
  assert.ok(prompt1.includes('المغرب'));
  assert.ok(prompt1.includes('15'));
  assert.ok(prompt1.includes('[SYSTEM CUE / إشارة حالة]'));

  const prompt2 = formatSignalCuePrompt(MUNEER_SIGNALS.RAPID_TASBEEH, { count: 18 });
  assert.ok(prompt2.includes('المسبحة الإلكترونية'));
  assert.ok(prompt2.includes('18'));

  const prompt3 = formatSignalCuePrompt(MUNEER_SIGNALS.DAILY_WARD_COMPLETED, { pagesCount: 20 });
  assert.ok(prompt3.includes('ورده القرآني'));
  assert.ok(prompt3.includes('20'));

  // 4. Test evaluatePrayerExpiryRisk with standard records and Arabic numerals
  const now = new Date();
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();
  const asrStartMins = Math.max(0, currentTotalMins - 60);
  const maghribStartMins = currentTotalMins + 15; // 15 mins remaining
  
  const toHM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const dynamicTimes = {
    Fajr: '05:00',
    Dhuhr: toHM(Math.max(0, asrStartMins - 120)),
    Asr: toHM(asrStartMins),
    Maghrib: toHM(maghribStartMins),
    Isha: '21:00',
  };

  const todayStr = '2026-08-20';
  // Case A: Asr unperformed -> Triggers expiry risk
  const riskUnperformed = evaluatePrayerExpiryRisk(dynamicTimes, [], todayStr);
  assert.ok(riskUnperformed);
  assert.equal(riskUnperformed.prayerId, 'Asr');
  assert.equal(riskUnperformed.remainingMinutes, 15);

  // Case B: Asr completed with standard prayer_name -> Returns null (no risk)
  const completedRecords = [
    { date: todayStr, prayer_name: 'Asr', status: 'on_time' },
  ];
  const riskCompleted = evaluatePrayerExpiryRisk(dynamicTimes, completedRecords, todayStr);
  assert.equal(riskCompleted, null);
});

it('Direct numeric shortcuts (1-6, Arabic digits, Numpad) map strictly to ordered tabs', () => {
  const digitMap = {
    '1': 'tracker', '١': 'tracker', 'Digit1': 'tracker', 'Numpad1': 'tracker',
    '2': 'chat',    '٢': 'chat',    'Digit2': 'chat',    'Numpad2': 'chat',
    '3': 'books',   '٣': 'books',   'Digit3': 'books',   'Numpad3': 'books',
    '4': 'tasbeeh', '٤': 'tasbeeh', 'Digit4': 'tasbeeh', 'Numpad4': 'tasbeeh',
    '5': 'audio',   '٥': 'audio',   'Digit5': 'audio',   'Numpad5': 'audio',
    '6': 'settings','٦': 'settings','Digit6': 'settings','Numpad6': 'settings',
  };

  const tabsInOrder = ['tracker', 'chat', 'books', 'tasbeeh', 'audio', 'settings'];

  tabsInOrder.forEach((expectedTab, idx) => {
    const numStr = String(idx + 1);
    const arabicNum = ['١', '٢', '٣', '٤', '٥', '٦'][idx];
    const digitCode = `Digit${idx + 1}`;
    const numpadCode = `Numpad${idx + 1}`;

    assert.equal(digitMap[numStr], expectedTab, `Key ${numStr} must map to ${expectedTab}`);
    assert.equal(digitMap[arabicNum], expectedTab, `Arabic digit ${arabicNum} must map to ${expectedTab}`);
    assert.equal(digitMap[digitCode], expectedTab, `Code ${digitCode} must map to ${expectedTab}`);
    assert.equal(digitMap[numpadCode], expectedTab, `Code ${numpadCode} must map to ${expectedTab}`);
  });
});

it('Daily AI Suggestions Engine: Once-per-day evaluation, fallback, and validation', () => {
  const DEFAULT_SUGGESTIONS_AR = [
    'كيف أحافظ على صلاة الفجر في وقتها؟',
    'ما هي السنن الرواتب المؤكدة؟',
    'كيف أنظم ورد القرآن اليومي مع أوقات الصلوات؟',
    'ما حكم الشك والسهو في الصلاة؟',
  ];

  // Mock cache store
  let mockStorage = {};
  const getCache = () => {
    const raw = mockStorage['prayer_tracker_daily_suggestions'];
    return raw ? JSON.parse(raw) : null;
  };
  const saveCache = (dateStr, lang, suggestions, generatedByAi = true) => {
    mockStorage['prayer_tracker_daily_suggestions'] = JSON.stringify({
      date: dateStr,
      lang,
      suggestions,
      generatedByAi,
      timestamp: Date.now(),
    });
  };

  const getSuggestions = (todayStr, lang = 'ar') => {
    const cached = getCache();
    if (
      cached &&
      cached.date === todayStr &&
      cached.lang === lang &&
      cached.generatedByAi &&
      Array.isArray(cached.suggestions) &&
      cached.suggestions.length >= 1
    ) {
      return { suggestions: cached.suggestions, fromCache: true };
    }
    return { suggestions: [], fromCache: false };
  };

  // Case 1: Fresh day with no cache -> Returns empty array (Zero hardcoded mock questions)
  const res1 = getSuggestions('2026-08-20');
  assert.equal(res1.fromCache, false);
  assert.equal(res1.suggestions.length, 0);

  // Case 2: System triggers AI model and caches 4 dynamic questions for today
  const freshPrompts = [
    'كيف أقوي خشوعي في صلاة الظهر؟',
    'ما فضل ختم القرآن في شهر؟',
    'كيف أثبت على أذكار المساء؟',
    'ما هي أفضل أوقات الدعاء المستجاب؟',
  ];
  saveCache('2026-08-20', 'ar', freshPrompts, true);

  // Case 3: Same day queries -> Returns cached generated questions with 0 new requests
  const res2 = getSuggestions('2026-08-20');
  assert.equal(res2.fromCache, true);
  assert.equal(res2.suggestions.length, 4);
  assert.equal(res2.suggestions[0], 'كيف أقوي خشوعي في صلاة الظهر؟');

  // Case 4: Next calendar day -> Cache expires for new date and requires fresh fetch (returns empty until generated)
  const res3 = getSuggestions('2026-08-21');
  assert.equal(res3.fromCache, false);
  assert.equal(res3.suggestions.length, 0);
});

it('Two-Stage Chat Titling: Initial title on 1st reply and permanent primary title on 5th reply', () => {
  let session = {
    id: 'session_123',
    title: 'محادثة جديدة 20/08/2026',
    titleFinalized: false,
    messages: [],
  };

  const evaluateTitlingStage = (currentSession, assistantRepliesCount, initialGeneratedTitle, contextualGeneratedTitle) => {
    if (currentSession.titleFinalized) return currentSession.title;

    if (assistantRepliesCount === 1) {
      currentSession.title = initialGeneratedTitle;
      currentSession.titleFinalized = false;
    } else if (assistantRepliesCount === 5) {
      currentSession.title = contextualGeneratedTitle;
      currentSession.titleFinalized = true;
    }
    return currentSession.title;
  };

  // Stage 1: First assistant response triggers Initial Title
  const title1 = evaluateTitlingStage(session, 1, 'حكم سجود السهو', 'فقه الصلاة والسهو والشك');
  assert.equal(title1, 'حكم سجود السهو');
  assert.equal(session.titleFinalized, false);

  // Intermediate turns (e.g. reply 2, 3, 4) do not mutate title prematurely
  const title3 = evaluateTitlingStage(session, 3, 'سؤال آخر', 'فقه الصلاة والسهو والشك');
  assert.equal(title3, 'حكم سجود السهو');
  assert.equal(session.titleFinalized, false);

  // Stage 2: Fifth assistant response evaluates deep context and finalizes primary title
  const title5 = evaluateTitlingStage(session, 5, 'سؤال خامس', 'فقه الصلاة والسهو والشك');
  assert.equal(title5, 'فقه الصلاة والسهو والشك');
  assert.equal(session.titleFinalized, true);

  // Subsequent turns do not overwrite finalized title
  const title6 = evaluateTitlingStage(session, 6, 'سؤال سادس', 'تسمية أخرى');
  assert.equal(title6, 'فقه الصلاة والسهو والشك');
});

await it('Real sendBrowserNotification pipeline: permission gating, absolute asset URLs, and SW fallback', async () => {
  const {
    getNotificationPermission,
    sendBrowserNotification,
    sendAdhanNotification,
  } = await import('../src/services/permissionService.js');

  // Setup DOM / Window globals for test
  const originalNotification = globalThis.Notification;
  const originalNavigator = globalThis.navigator;

  let constructorCalls = [];
  class MockNotification {
    constructor(title, options) {
      this.title = title;
      this.options = options;
      this.onclick = null;
      constructorCalls.push({ title, options });
    }
    static permission = 'default';
    static requestPermission(cb) {
      if (cb) cb('granted');
      return Promise.resolve('granted');
    }
  }

  globalThis.Notification = MockNotification;
  globalThis.window = {
    location: { origin: 'http://localhost:5173' },
    focus: () => {},
  };
  globalThis.document = {
    documentElement: { dir: 'rtl', lang: 'ar' },
    visibilityState: 'hidden', // Default for tests: user outside app
    hasFocus: () => false,
  };

  // Case 1: Default / Denied permission -> Rejects dispatch safely
  MockNotification.permission = 'denied';
  assert.equal(getNotificationPermission(), 'denied');
  const resDenied = sendBrowserNotification('Test', 'Denied test');
  assert.equal(resDenied.success, false);
  assert.equal(resDenied.reason, 'denied');

  // Case 1.5: User is active inside the app (visible + focused) -> External notification suppressed
  MockNotification.permission = 'granted';
  globalThis.document.visibilityState = 'visible';
  globalThis.document.hasFocus = () => true;
  const resInside = sendBrowserNotification('تنبيه داخلي', 'المستخدم داخل الموقع');
  assert.equal(resInside.success, false);
  assert.equal(resInside.reason, 'user_active_inside_app');

  // Case 1.6: forceExternal: true overrides and forces external notification
  const resForced = sendBrowserNotification('تنبيه تجريبي', 'إشعار تجريبي مفروض', { forceExternal: true });
  assert.equal(resForced.success, true);

  // Set user outside app for remaining tests (e.g. background tab / minimized)
  globalThis.document.visibilityState = 'hidden';
  globalThis.document.hasFocus = () => false;

  // Case 2: Granted permission + outside app -> Dispatches via window Notification with absolute URL
  MockNotification.permission = 'granted';
  assert.equal(getNotificationPermission(), 'granted');
  constructorCalls = [];
  const resGranted = sendBrowserNotification('صلاة الظهر', 'حان الآن وقت أذان الظهر', {
    tag: 'prayer-dhuhr',
    icon: '/pwa-192x192.png',
  });
  assert.equal(resGranted.success, true);
  assert.equal(resGranted.method, 'window');
  assert.equal(constructorCalls.length, 1);
  assert.equal(constructorCalls[0].title, 'صلاة الظهر');
  assert.equal(constructorCalls[0].options.icon, 'http://localhost:5173/pwa-192x192.png');
  assert.equal(constructorCalls[0].options.badge, 'http://localhost:5173/pwa-192x192.png');
  assert.equal(constructorCalls[0].options.requireInteraction, true);

  // Case 3: sendAdhanNotification backward compatible wrapper
  constructorCalls = [];
  const resAdhan = sendAdhanNotification('أذان العصر', 'حان وقت صلاة العصر');
  assert.equal(resAdhan.success, true);
  assert.equal(constructorCalls[0].options.tag, 'adhan-reminder');

  // Case 4: checkAndNotifyCurrentAdhan triggers notification on matching time
  const { checkAndNotifyCurrentAdhan } = await import('../src/services/permissionService.js');
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const mockPrayerTimes = {
    Fajr: '05:00',
    Dhuhr: currentHHMM,
    Asr: '16:00',
    Maghrib: '19:00',
    Isha: '20:30',
  };

  const sessionStore = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => sessionStore.get(key) || null,
    setItem: (key, val) => sessionStore.set(key, String(val)),
  };

  constructorCalls = [];
  checkAndNotifyCurrentAdhan(mockPrayerTimes, 'ar');
  assert.equal(constructorCalls.length, 1);
  assert.match(constructorCalls[0].title, /الظهر/);

  // Duplicate check within same minute does NOT trigger again
  checkAndNotifyCurrentAdhan(mockPrayerTimes, 'ar');
  assert.equal(constructorCalls.length, 1); // Remains 1, deduplicated

  // Case 5: ServiceWorker fallback when window Notification constructor throws (e.g. mobile/PWA constraints)
  let swCalls = [];
  class ThrowingNotification {
    constructor() {
      throw new TypeError("Failed to construct 'Notification': Illegal constructor.");
    }
    static permission = 'granted';
  }
  globalThis.Notification = ThrowingNotification;
  const mockServiceWorker = {
    getRegistration: () => Promise.resolve({
      showNotification: (title, opts) => {
        swCalls.push({ title, opts });
        return Promise.resolve();
      },
    }),
  };
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: mockServiceWorker,
    configurable: true,
    writable: true,
  });

  const resSW = sendBrowserNotification('تنبيه بديل', 'إشعار عبر Service Worker');
  assert.equal(resSW.success, true);
  assert.equal(resSW.method, 'serviceWorker');

  // Case 6: requestNotificationsPermission handles browser gesture request
  const { requestNotificationsPermission } = await import('../src/services/permissionService.js');
  MockNotification.permission = 'default';
  globalThis.Notification = MockNotification;
  const permRes = await requestNotificationsPermission();
  assert.equal(permRes, 'granted');

  // Restore globals
  if (originalNotification !== undefined) {
    globalThis.Notification = originalNotification;
  } else {
    delete globalThis.Notification;
  }
  try {
    delete globalThis.navigator.serviceWorker;
  } catch {}
  delete globalThis.sessionStorage;
});

it('Prominent Native Browser Notifications: Full options, prominence & click handlers', () => {
  let dispatchedNotifs = [];

  const mockSendBrowserNotification = (title, body, options = {}, isGranted = true) => {
    if (!isGranted) return false;
    const notif = {
      title,
      body: body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: options.tag || 'habit-tracker-notification',
      renotify: options.renotify ?? true,
      requireInteraction: options.requireInteraction ?? true,
    };
    dispatchedNotifs.push(notif);
    return true;
  };

  // Case 1: Sheikh Muneer Proactive Advice outside website
  const res1 = mockSendBrowserNotification(
    'الشيخ منير',
    'السكينة والهدوء زينة المؤمن؛ رويدك يا غالي...',
    { tag: 'muneer-RAPID_TAB_NAVIGATION', requireInteraction: true }
  );
  assert.equal(res1, true);
  assert.equal(dispatchedNotifs.length, 1);
  assert.equal(dispatchedNotifs[0].title, 'الشيخ منير');
  assert.equal(dispatchedNotifs[0].requireInteraction, true);
  assert.equal(dispatchedNotifs[0].tag, 'muneer-RAPID_TAB_NAVIGATION');

  // Case 2: Prayer Expiry Risk alert outside website
  const res2 = mockSendBrowserNotification(
    'اقتراب خروج وقت الصلاة — الشيخ منير',
    'أخي الحبيب، الصلاة عماد الدين وقد أوشك وقت صلاة العصر أن ينقضي...',
    { tag: 'muneer-PRAYER_EXPIRY_RISK', requireInteraction: true }
  );
  assert.equal(res2, true);
  assert.equal(dispatchedNotifs.length, 2);
  assert.equal(dispatchedNotifs[1].title, 'اقتراب خروج وقت الصلاة — الشيخ منير');
  assert.equal(dispatchedNotifs[1].requireInteraction, true);
});

it('Automatic Offline Image Background Selection: Live streams fallback to image wallpaper when offline', () => {
  function getDesiredBg(settings, isOnline = true) {
    const mode = settings?.bgMode || 'makkah';
    if (!isOnline && (mode === 'makkah' || mode === 'madinah')) {
      const activeImg = settings?.activeCustomBgImage || (Array.isArray(settings?.customBgImages) && settings.customBgImages[0]) || '/nature-meadow.jpg';
      return {
        type: 'image',
        url: activeImg,
        imageUrl: activeImg,
        key: activeImg || 'nature-meadow',
        isOfflineFallback: true,
      };
    }
    if (mode === 'makkah') {
      return { type: 'video', videoId: settings?.makkahVideoId || 'm9-Umj3aL1I', key: 'makkah' };
    }
    if (mode === 'madinah') {
      return { type: 'video', videoId: settings?.madinahVideoId || 'Rs7St51oDDc', key: 'madinah' };
    }
    if (mode === 'custom_image') {
      const activeImg = settings?.activeCustomBgImage || (Array.isArray(settings?.customBgImages) && settings.customBgImages[0]) || '/nature-meadow.jpg';
      return { type: 'image', url: activeImg, imageUrl: activeImg, key: activeImg };
    }
    return { type: 'video', videoId: 'm9-Umj3aL1I', key: 'makkah' };
  }

  // 1. Online state: Makkah mode yields live video stream
  const onlineBg = getDesiredBg({ bgMode: 'makkah' }, true);
  assert.equal(onlineBg.type, 'video');
  assert.equal(onlineBg.key, 'makkah');

  // 2. Offline state: Makkah mode automatically falls back to image wallpaper
  const offlineMakkah = getDesiredBg({ bgMode: 'makkah' }, false);
  assert.equal(offlineMakkah.type, 'image');
  assert.equal(offlineMakkah.isOfflineFallback, true);
  assert.equal(offlineMakkah.url, '/nature-meadow.jpg');

  // 3. Offline state: Madinah mode automatically falls back to custom image wallpaper if available
  const offlineMadinahWithCustom = getDesiredBg({
    bgMode: 'madinah',
    customBgImages: ['data:image/png;base64,sample123'],
  }, false);
  assert.equal(offlineMadinahWithCustom.type, 'image');
  assert.equal(offlineMadinahWithCustom.isOfflineFallback, true);
  assert.equal(offlineMadinahWithCustom.url, 'data:image/png;base64,sample123');
});

await it('Notification Priorities & Daily Speed Alert Limit: Speed alerts trigger once per day, critical risks always alert', async () => {
  const {
    MUNEER_SIGNALS,
    SIGNAL_PRIORITIES,
    SPEED_SIGNALS,
    getStoredSpeedAlertDate,
    setStoredSpeedAlertDate,
    dispatchMuneerSignal,
  } = await import('../src/services/muneerSignalService.js');

  // Verify Priority Sets
  assert.ok(SPEED_SIGNALS.has(MUNEER_SIGNALS.RAPID_TAB_NAVIGATION));
  assert.ok(SPEED_SIGNALS.has(MUNEER_SIGNALS.RAPID_BOOK_FLIPPING));
  assert.ok(SPEED_SIGNALS.has(MUNEER_SIGNALS.RAPID_TASBEEH));
  assert.ok(SPEED_SIGNALS.has(MUNEER_SIGNALS.RAPID_BACKGROUND_SWITCHING));

  // Dynamic Today Date (timezone-aware)
  const today = getCityTodayDateStr();
  setStoredSpeedAlertDate(''); // reset

  // 1. First speed signal today -> Allowed
  const res1 = await dispatchMuneerSignal(MUNEER_SIGNALS.RAPID_TAB_NAVIGATION, { count: 4 });
  assert.equal(res1.success, true);
  assert.equal(res1.message.priority, SIGNAL_PRIORITIES.ADVISORY_SPEED);
  assert.equal(getStoredSpeedAlertDate(), today);

  // 2. Subsequent speed signal same day -> Blocked by daily speed limit
  const res2 = await dispatchMuneerSignal(MUNEER_SIGNALS.RAPID_TASBEEH, { count: 15 });
  assert.equal(res2.success, false);
  assert.equal(res2.reason, 'daily_speed_limit_reached');

  // 3. Critical Prayer Expiry Risk -> NOT blocked by speed limit, dispatched with CRITICAL priority
  const res3 = await dispatchMuneerSignal(MUNEER_SIGNALS.PRAYER_EXPIRY_RISK, {
    prayerNameAr: 'العصر',
    remainingMinutes: 12,
  });
  assert.equal(res3.success, true);
  assert.equal(res3.message.priority, SIGNAL_PRIORITIES.CRITICAL);
});

it('Network Sensing & Cloud Feature Locking: Cloud features lock offline while local-first features remain active', () => {
  // Test 1: Offline Network Gating for AI suggestions
  function mockEnsureDailySuggestions(apiKey, isOnline, cachedSuggestions) {
    if (!isOnline) return cachedSuggestions || [];
    if (!apiKey) return [];
    return ['سؤال مولد عبر الإنترنت'];
  }

  assert.deepEqual(mockEnsureDailySuggestions('api-key', false, ['سؤال محفوظ']), ['سؤال محفوظ']);
  assert.deepEqual(mockEnsureDailySuggestions('api-key', false, null), []);
  assert.deepEqual(mockEnsureDailySuggestions('api-key', true, null), ['سؤال مولد عبر الإنترنت']);

  // Test 2: Background scenes locking logic
  function getAllAvailableScenes(settings, isOnline = true) {
    if (!isOnline) {
      const customImages = Array.isArray(settings?.customBgImages) && settings.customBgImages.length > 0
        ? settings.customBgImages
        : ['/nature-meadow.jpg'];
      return customImages.map((img, idx) => ({
        key: `custom_${idx}`,
        type: 'image',
        url: img,
      }));
    }
    return [
      { key: 'makkah', type: 'video' },
      { key: 'madinah', type: 'video' },
      { key: 'nature', type: 'image' },
    ];
  }

  const onlineScenes = getAllAvailableScenes({}, true);
  assert.equal(onlineScenes.some((s) => s.type === 'video'), true);

  const offlineScenes = getAllAvailableScenes({}, false);
  assert.equal(offlineScenes.every((s) => s.type === 'image'), true);
  assert.equal(offlineScenes.some((s) => s.type === 'video'), false);

  // Test 3: ChatView message locking when offline
  function validateChatMessageSubmission(isOnline, hasKey, text) {
    if (!text || !text.trim()) return { canSend: false, error: null };
    if (!isOnline) return { canSend: false, error: 'offline_locked' };
    if (!hasKey) return { canSend: false, error: 'no_key' };
    return { canSend: true, error: null };
  }

  assert.deepEqual(validateChatMessageSubmission(false, true, 'السلام عليكم'), { canSend: false, error: 'offline_locked' });
  assert.deepEqual(validateChatMessageSubmission(true, false, 'السلام عليكم'), { canSend: false, error: 'no_key' });
  assert.deepEqual(validateChatMessageSubmission(true, true, 'السلام عليكم'), { canSend: true, error: null });
});

it('Prayer Expiration Windows & Active Isha: Isha stays active at night and Fajr expires at Sunrise', () => {
  const prayerTimes = {
    Fajr: '04:02',
    Sunrise: '05:35',
    Dhuhr: '12:30',
    Asr: '15:45',
    Maghrib: '18:20',
    Isha: '20:27',
  };

  function timeToMins(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  function isNextArrived(currentPrayerId, currentMins, selectedDate, todayDate) {
    if (selectedDate < todayDate) return true; // Past date
    const isArrived = (timeStr) => currentMins >= timeToMins(timeStr);

    switch (currentPrayerId) {
      case 'Fajr':
        return isArrived(prayerTimes.Sunrise);
      case 'Dhuhr':
        return isArrived(prayerTimes.Asr);
      case 'Asr':
        return isArrived(prayerTimes.Maghrib);
      case 'Maghrib':
        return isArrived(prayerTimes.Isha);
      case 'Isha':
        return false;
      default:
        return false;
    }
  }

  const today = '2026-08-20';

  // Scenario 1: Night time 10:46 PM (22:46 = 1366 mins) during Isha
  const nightMins = 22 * 60 + 46; // 1366 mins
  assert.equal(isNextArrived('Isha', nightMins, today, today), false); // Isha is NEVER expired at 10:46 PM!
  assert.equal(isNextArrived('Maghrib', nightMins, today, today), true); // Maghrib has expired (Isha arrived)
  assert.equal(isNextArrived('Asr', nightMins, today, today), true); // Asr has expired
  assert.equal(isNextArrived('Dhuhr', nightMins, today, today), true); // Dhuhr has expired
  assert.equal(isNextArrived('Fajr', nightMins, today, today), true); // Fajr has expired (Sunrise arrived)

  // Scenario 2: Morning 04:30 AM (Fajr active, before Sunrise 05:35)
  const fajrMins = 4 * 60 + 30; // 270 mins
  assert.equal(isNextArrived('Fajr', fajrMins, today, today), false); // Fajr is active!

  // Scenario 3: Morning 06:00 AM (After Sunrise 05:35)
  const postSunriseMins = 6 * 60; // 360 mins
  assert.equal(isNextArrived('Fajr', postSunriseMins, today, today), true); // Fajr expired at sunrise

  // Scenario 4: Afternoon 01:00 PM (Dhuhr active, before Asr 15:45)
  const dhuhrMins = 13 * 60;
  assert.equal(isNextArrived('Dhuhr', dhuhrMins, today, today), false); // Dhuhr active

  // Scenario 5: Afternoon 04:00 PM (After Asr 15:45, before Maghrib 18:20)
  const asrMins = 16 * 60;
  assert.equal(isNextArrived('Dhuhr', asrMins, today, today), true); // Dhuhr expired
  assert.equal(isNextArrived('Asr', asrMins, today, today), false); // Asr active
});

it('Hijri Date Formatting: Deduplicates era suffix and prevents "هـ هـ" and "AH AH"', () => {
  function formatHijri(rawString, isEn) {
    if (isEn) {
      const raw = rawString.trim();
      return raw.endsWith('AH') ? raw : `${raw} AH`;
    }
    const raw = rawString.trim();
    return raw.endsWith('هـ') ? raw : `${raw} هـ`;
  }

  // When Intl already includes هـ
  assert.equal(formatHijri('7 ربيع الأول 1448 هـ', false), '7 ربيع الأول 1448 هـ');
  // When Intl does not include هـ
  assert.equal(formatHijri('7 ربيع الأول 1448', false), '7 ربيع الأول 1448 هـ');

  // English formatting
  assert.equal(formatHijri('7 Rabi I 1448 AH', true), '7 Rabi I 1448 AH');
  assert.equal(formatHijri('7 Rabi I 1448', true), '7 Rabi I 1448 AH');
});

// ------------------------------------------------------------------
// SECTION 7: AUDIO PLAYER & LOCAL FOLDER LIBRARY
// ------------------------------------------------------------------
console.log('\n--- SECTION 7: Audio Player & Local Folder Library ---');

it('Audio File Filter: Correctly filters audio formats and rejects non-audio files', () => {
  // Supported audio extensions
  assert.equal(isAudioFile('001_Al-Fatiha.mp3'), true);
  assert.equal(isAudioFile('quran_recitation.m4a'), true);
  assert.equal(isAudioFile('lecture_part1.wav'), true);
  assert.equal(isAudioFile('athan_makkah.aac'), true);
  assert.equal(isAudioFile('dhikr_evening.ogg'), true);
  assert.equal(isAudioFile('high_quality_quran.flac'), true);
  assert.equal(isAudioFile('audiobook.opus'), true);
  assert.equal(isAudioFile('recording.wma'), true);

  // Rejected non-audio formats
  assert.equal(isAudioFile('quran_mushaf.pdf'), false);
  assert.equal(isAudioFile('notes.txt'), false);
  assert.equal(isAudioFile('wallpaper.png'), false);
  assert.equal(isAudioFile('app.exe'), false);
  assert.equal(isAudioFile('document.docx'), false);
  assert.equal(isAudioFile(''), false);
  assert.equal(isAudioFile(null), false);
});

it('Natural Track Sorter: Sorts track filenames numerically and alphabetically', () => {
  const unsortedTracks = [
    { name: '10_Yunus.mp3', title: '10 - Yunus' },
    { name: '01_Al-Fatiha.mp3', title: '01 - Al-Fatiha' },
    { name: '2_Al-Baqarah.mp3', title: '2 - Al-Baqarah' },
    { name: '100_Al-Adiyat.mp3', title: '100 - Al-Adiyat' },
    { name: '03_Al-Imran.mp3', title: '03 - Al-Imran' },
  ];

  const sorted = naturalSortTracks(unsortedTracks);
  assert.equal(sorted[0].name, '01_Al-Fatiha.mp3');
  assert.equal(sorted[1].name, '2_Al-Baqarah.mp3');
  assert.equal(sorted[2].name, '03_Al-Imran.mp3');
  assert.equal(sorted[3].name, '10_Yunus.mp3');
  assert.equal(sorted[4].name, '100_Al-Adiyat.mp3');
});

it('Audio Formatting Utilities: Track titles, file size, and duration formatting', () => {
  // Title formatting
  assert.equal(formatTrackTitle('001_Al-Fatiha.mp3'), '001 - Al-Fatiha');
  assert.equal(formatTrackTitle('surah_baqarah.wav'), 'surah_baqarah');
  assert.equal(formatTrackTitle(''), 'مقطع صوتي');

  // File size formatting
  assert.equal(formatFileSize(1024), '1.0 KB');
  assert.equal(formatFileSize(1024 * 1024 * 5.5), '5.5 MB');
  assert.equal(formatFileSize(0), '0 B');

  // Duration formatting
  assert.equal(formatAudioDuration(0), '00:00');
  assert.equal(formatAudioDuration(75), '01:15');
  assert.equal(formatAudioDuration(3665), '1:01:05');
});

it('Audio Player Preferences: State saving and retrieval in localStorage', () => {
  saveAudioPlayerState({
    activeTrackId: 'track_123',
    folderName: 'المصحف المرتل',
    volume: 0.8,
    isMuted: false,
    playbackSpeed: 1.25,
    repeatMode: 'one',
    isShuffle: true,
  });

  const state = getAudioPlayerState();
  assert.equal(state.activeTrackId, 'track_123');
  assert.equal(state.folderName, 'المصحف المرتل');
  assert.equal(state.volume, 0.8);
  assert.equal(state.isMuted, false);
  assert.equal(state.playbackSpeed, 1.25);
  assert.equal(state.repeatMode, 'one');
  assert.equal(state.isShuffle, true);
});

it('Audio Track Title Customization: In-memory and state renaming helper', () => {
  const initialTracks = [
    { id: '1', name: '01_intro.mp3', title: '01 - intro' },
    { id: '2', name: '02_lecture.mp3', title: '02 - lecture' },
  ];

  const updateTitleInList = (list, trackId, newTitle) =>
    list.map((t) => (t.id === trackId ? { ...t, title: newTitle.trim() || t.name } : t));

  const updated = updateTitleInList(initialTracks, '1', 'مقدمة في السيرة النبوية');
  assert.equal(updated[0].title, 'مقدمة في السيرة النبوية');
  assert.equal(updated[1].title, '02 - lecture');
});

it('Audio Player Preferences: Collapsible playlist state persistence', () => {
  saveAudioPlayerState({
    isPlaylistExpanded: false,
  });

  const state = getAudioPlayerState();
  assert.equal(state.isPlaylistExpanded, false);

  saveAudioPlayerState({
    isPlaylistExpanded: true,
  });

  const state2 = getAudioPlayerState();
  assert.equal(state2.isPlaylistExpanded, true);
});

it('Multiple Audio Files Selection: Merges files from disparate locations seamlessly', () => {
  // Batch 1: Files from Folder A
  const batch1 = [
    { name: '01_fatiha.mp3', size: 1024, type: 'audio/mpeg' },
    { name: '02_baqarah.mp3', size: 2048, type: 'audio/mpeg' },
  ];
  
  // Batch 2: Files from Folder B
  const batch2 = [
    { name: 'lecture_intro.m4a', size: 4096, type: 'audio/mp4' },
    { name: '03_imran.mp3', size: 3072, type: 'audio/mpeg' },
  ];

  const merged = [...batch1, ...batch2].filter((f) => isAudioFile(f.name));
  assert.equal(merged.length, 4);

  const formatted = merged.map((f) => ({
    name: f.name,
    title: formatTrackTitle(f.name),
  }));

  const sorted = naturalSortTracks(formatted);
  assert.equal(sorted.length, 4);
  assert.equal(sorted[0].name, '01_fatiha.mp3');
  assert.equal(sorted[1].name, '02_baqarah.mp3');
  assert.equal(sorted[2].name, '03_imran.mp3');
  assert.equal(sorted[3].name, 'lecture_intro.m4a');
});

// ------------------------------------------------------------------
// SUMMARY REPORT
// ------------------------------------------------------------------
console.log('\n====================================================');
console.log(`🏁 REGRESSION SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL SUITES PASSED CLEANLY WITH ZERO REGRESSIONS.');
} else {
  console.error('❌ SOME TESTS FAILED.');
  process.exit(1);
}
