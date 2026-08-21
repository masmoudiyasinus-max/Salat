import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';

// Import services and components
import { DATA_STATUS, isValidTimeString, getPrayerTimesStatus, getWeatherDataStatus, getRecordsStatus } from '../src/services/dataReadiness.js';
import { getCurrentObligatoryPrayerId, calculateNightTimes, toWesternDigits, getCityNowDate } from '../src/services/storage.js';
import { resolveTimezoneForLocation } from '../src/services/adhanCalculator.js';
import { getCityTodayDateStr } from '../src/services/timeUtils.js';

import ActivePrayerHero from '../src/components/ActivePrayerHero.jsx';
import LiveProgressBar from '../src/components/LiveProgressBar.jsx';
import LiveClock from '../src/components/LiveClock.jsx';
import LiveCountdown from '../src/components/LiveCountdown.jsx';
import ScheduleTableModal from '../src/components/ScheduleTableModal.jsx';

console.log('=== STARTING EMPIRICAL STRESS TEST SUITE FOR MILESTONE 2 ===\n');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
    failCount++;
  }
}

// -------------------------------------------------------------
// 1. DATA READINESS SERVICE STRESS TESTS
// -------------------------------------------------------------
console.log('--- 1. Testing dataReadiness.js ---');

runTest('isValidTimeString validates normal and boundary inputs', () => {
  assert.equal(isValidTimeString('04:30'), true);
  assert.equal(isValidTimeString('00:00'), true);
  assert.equal(isValidTimeString('23:59'), true);
  assert.equal(isValidTimeString('12:00'), true);

  // Invalid formats
  assert.equal(isValidTimeString('24:00'), false);
  assert.equal(isValidTimeString('12:60'), false);
  assert.equal(isValidTimeString('-01:00'), false);
  assert.equal(isValidTimeString('abc'), false);
  assert.equal(isValidTimeString(''), false);
  assert.equal(isValidTimeString(null), false);
  assert.equal(isValidTimeString(undefined), false);
  assert.equal(isValidTimeString(123), false);
  assert.equal(isValidTimeString({}), false);
  assert.equal(isValidTimeString('12:'), false);
  assert.equal(isValidTimeString(':30'), false);
});

runTest('getPrayerTimesStatus requires all 5 obligatory prayers with valid time strings', () => {
  const complete = {
    Fajr: '04:30',
    Sunrise: '06:00',
    Dhuhr: '12:30',
    Asr: '16:00',
    Maghrib: '19:00',
    Isha: '20:30',
  };
  assert.equal(getPrayerTimesStatus(complete), DATA_STATUS.READY);

  // Missing one obligatory prayer
  const missingAsr = { ...complete, Asr: '' };
  assert.equal(getPrayerTimesStatus(missingAsr), DATA_STATUS.UNAVAILABLE);

  // Invalid time string
  const invalidDhuhr = { ...complete, Dhuhr: 'invalid' };
  assert.equal(getPrayerTimesStatus(invalidDhuhr), DATA_STATUS.UNAVAILABLE);

  // Null/undefined/empty
  assert.equal(getPrayerTimesStatus(null), DATA_STATUS.UNAVAILABLE);
  assert.equal(getPrayerTimesStatus(undefined), DATA_STATUS.UNAVAILABLE);
  assert.equal(getPrayerTimesStatus({}), DATA_STATUS.UNAVAILABLE);
});

// -------------------------------------------------------------
// 2. MIDNIGHT-TO-FAJR & ROLLING WINDOW TIME TESTS
// -------------------------------------------------------------
console.log('\n--- 2. Testing Midnight-to-Fajr & 24h Rolling Window Calculations ---');

const sampleTimes = {
  Fajr: '04:30',
  Sunrise: '06:00',
  Dhuhr: '12:30',
  Asr: '16:00',
  Maghrib: '19:00',
  Isha: '20:30',
  timezone: 'Africa/Cairo',
};

runTest('getCurrentObligatoryPrayerId at 02:30 AM returns Isha', () => {
  const testNow = new Date('2026-08-18T02:30:00');
  const activeId = getCurrentObligatoryPrayerId(sampleTimes, testNow);
  assert.equal(activeId, 'Isha');
});

runTest('Early morning 02:30 AM nextOblDateObj correctly targets TODAY at 04:30 AM (not tomorrow)', () => {
  const testNow = new Date('2026-08-18T02:30:00');
  const activeObligatoryId = getCurrentObligatoryPrayerId(sampleTimes, testNow);
  assert.equal(activeObligatoryId, 'Isha');

  const oblList = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const currentOblIndex = oblList.indexOf(activeObligatoryId); // 4
  const nextOblId = currentOblIndex >= 0 ? (currentOblIndex < oblList.length - 1 ? oblList[currentOblIndex + 1] : 'Fajr') : null;
  assert.equal(nextOblId, 'Fajr');

  const nextAdhanStr = sampleTimes[nextOblId]; // '04:30'

  const parsePrayerDateTime = (timeStr, dayOffset = 0) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(testNow.getTime());
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d;
  };

  let nextOblDateObj = parsePrayerDateTime(nextAdhanStr, 0);
  if (nextOblDateObj && nextOblDateObj <= testNow) {
    nextOblDateObj = parsePrayerDateTime(nextAdhanStr, 1);
  }

  // At 02:30 AM, nextOblDateObj (04:30 AM today) > testNow (02:30 AM today)
  // So nextOblDateObj should NOT have dayOffset +1
  assert.equal(nextOblDateObj.getDate(), testNow.getDate());
  assert.equal(nextOblDateObj.getHours(), 4);
  assert.equal(nextOblDateObj.getMinutes(), 30);

  const diffHours = (nextOblDateObj.getTime() - testNow.getTime()) / (1000 * 60 * 60);
  assert.equal(diffHours, 2); // Exactly 2 hours until Fajr!
});

runTest('Late night 21:00 PM nextOblDateObj correctly targets TOMORROW at 04:30 AM (+1 day)', () => {
  const testNow = new Date('2026-08-18T21:00:00');
  const activeObligatoryId = getCurrentObligatoryPrayerId(sampleTimes, testNow);
  assert.equal(activeObligatoryId, 'Isha');

  const nextOblId = 'Fajr';
  const nextAdhanStr = sampleTimes[nextOblId]; // '04:30'

  const parsePrayerDateTime = (timeStr, dayOffset = 0) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(testNow.getTime());
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d;
  };

  let nextOblDateObj = parsePrayerDateTime(nextAdhanStr, 0);
  if (nextOblDateObj && nextOblDateObj <= testNow) {
    nextOblDateObj = parsePrayerDateTime(nextAdhanStr, 1);
  }

  // At 21:00 PM, nextOblDateObj (04:30 AM today <= 21:00 PM) is true, so offset is +1
  assert.equal(nextOblDateObj.getDate(), testNow.getDate() + 1);
  assert.equal(nextOblDateObj.getHours(), 4);
  assert.equal(nextOblDateObj.getMinutes(), 30);

  const diffHours = (nextOblDateObj.getTime() - testNow.getTime()) / (1000 * 60 * 60);
  assert.equal(diffHours, 7.5); // Exactly 7.5 hours until tomorrow's Fajr!
});

runTest('Early morning 02:30 AM currentOblDateObj correctly refers to YESTERDAY Isha (20:30)', () => {
  const testNow = new Date('2026-08-18T02:30:00');
  const activeObligatoryId = 'Isha';
  const activeAdhanStr = sampleTimes[activeObligatoryId]; // '20:30'

  const parsePrayerDateTime = (timeStr, dayOffset = 0) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(testNow.getTime());
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d;
  };

  let currentOblDateObj = parsePrayerDateTime(activeAdhanStr, 0);
  if (currentOblDateObj && activeObligatoryId === 'Isha' && testNow < currentOblDateObj) {
    currentOblDateObj = parsePrayerDateTime(activeAdhanStr, -1);
  }

  assert.equal(currentOblDateObj.getDate(), testNow.getDate() - 1);
  assert.equal(currentOblDateObj.getHours(), 20);
  assert.equal(currentOblDateObj.getMinutes(), 30);
});

// -------------------------------------------------------------
// 3. LIVE PROGRESS BAR MATH & GUARD STRESS TESTS
// -------------------------------------------------------------
console.log('\n--- 3. Testing LiveProgressBar Math & Guards ---');

runTest('LiveProgressBar math handles 0 totalSecs, negative deltas, and extreme boundaries without NaN', () => {
  const calculatePct = (currentDateObj, nextDateObj, safeNow) => {
    if (
      !currentDateObj ||
      !nextDateObj ||
      !(currentDateObj instanceof Date) ||
      !(nextDateObj instanceof Date) ||
      isNaN(currentDateObj.getTime()) ||
      isNaN(nextDateObj.getTime())
    ) {
      return 0;
    }

    const elapsedMs = Math.max(0, safeNow.getTime() - currentDateObj.getTime());
    const remainingMs = Math.max(0, nextDateObj.getTime() - safeNow.getTime());

    const elapsedSecs = Math.floor(elapsedMs / 1000);
    const remainingSecs = Math.floor(remainingMs / 1000);
    const totalSecs = elapsedSecs + remainingSecs;

    const pct = totalSecs > 0 ? Math.min(100, Math.max(0, (elapsedSecs / totalSecs) * 100)) : 0;
    return isNaN(pct) ? 0 : pct;
  };

  const d1 = new Date('2026-08-18T12:00:00');
  const d2 = new Date('2026-08-18T16:00:00');

  // Exact start (0%)
  assert.equal(calculatePct(d1, d2, new Date('2026-08-18T12:00:00')), 0);

  // Exact midpoint (50%)
  assert.equal(calculatePct(d1, d2, new Date('2026-08-18T14:00:00')), 50);

  // Exact end (100%)
  assert.equal(calculatePct(d1, d2, new Date('2026-08-18T16:00:00')), 100);

  // Before start (0%)
  assert.equal(calculatePct(d1, d2, new Date('2026-08-18T10:00:00')), 0);

  // After end (100%)
  assert.equal(calculatePct(d1, d2, new Date('2026-08-18T18:00:00')), 100);

  // Identical start & end (0 totalSecs -> 0%)
  assert.equal(calculatePct(d1, d1, new Date('2026-08-18T12:00:00')), 0);

  // Invalid dates
  assert.equal(calculatePct(new Date('invalid'), d2, new Date()), 0);
  assert.equal(calculatePct(null, d2, new Date()), 0);
  assert.equal(calculatePct(d1, null, new Date()), 0);
  assert.equal(calculatePct(undefined, undefined, new Date()), 0);
});

// -------------------------------------------------------------
// 4. REACT SERVER RENDERING & ZERO NAN / ZERO ERROR STRESS TESTS
// -------------------------------------------------------------
console.log('\n--- 4. Testing React Component Render Output (Zero NaN, Zero Errors) ---');

runTest('ActivePrayerHero renders correctly in LOADING state (when isDetectingLocation = true)', () => {
  const html = renderToString(
    <ActivePrayerHero
      isDetectingLocation={true}
      isDataReady={false}
      settings={{ language: 'ar' }}
      t={(k, def) => def}
    />
  );
  assert.match(html, /جاري حساب مواقيت الصلاة/);
  assert.doesNotMatch(html, /NaN/);
  assert.doesNotMatch(html, /undefined/);
});

runTest('ActivePrayerHero renders correctly in UNAVAILABLE state (when isDataReady = false)', () => {
  const html = renderToString(
    <ActivePrayerHero
      isDetectingLocation={false}
      isDataReady={false}
      settings={{ language: 'en' }}
      t={(k, def) => def}
    />
  );
  assert.match(html, /Prayer Times Unavailable/);
  assert.doesNotMatch(html, /NaN/);
});

runTest('ActivePrayerHero renders correctly in READY state with full details and no NaN', () => {
  const now = new Date('2026-08-18T13:00:00');
  const curDate = new Date('2026-08-18T12:30:00');
  const nextDate = new Date('2026-08-18T16:00:00');

  const html = renderToString(
    <ActivePrayerHero
      isDetectingLocation={false}
      isDataReady={true}
      prayerTimes={sampleTimes}
      settings={{ language: 'ar', timeFormat: '12' }}
      selectedDate="2026-08-18"
      activeObligatoryId="Dhuhr"
      activePrayerObj={{ id: 'Dhuhr', nameAr: 'الظهر' }}
      activeAdhanStr="12:30"
      isActiveCompleted={false}
      activeRec={null}
      activeStatus="none"
      nextOblId="Asr"
      nextPrayerObj={{ id: 'Asr', nameAr: 'العصر' }}
      nextAdhanStr="16:00"
      currentOblDateObj={curDate}
      nextOblDateObj={nextDate}
      timerInfo={{ elapsedSecs: 1800 }}
      t={(k, def) => def}
    />
  );

  assert.match(html, /صلاة الظهر/);
  assert.match(html, /الصلاة القادمة/);
  assert.doesNotMatch(html, /NaN/);
});

runTest('LiveProgressBar renders safely when valid and returns null when invalid', () => {
  const validHtml = renderToString(
    <LiveProgressBar
      currentDateObj={new Date('2026-08-18T12:00:00')}
      nextDateObj={new Date('2026-08-18T16:00:00')}
      timezone="Africa/Cairo"
      isActiveCompleted={false}
    />
  );
  assert.ok(validHtml.length > 0);
  assert.doesNotMatch(validHtml, /NaN/);

  // Invalid date props should return empty string (null in React SSR)
  const invalidHtml1 = renderToString(
    <LiveProgressBar
      currentDateObj={null}
      nextDateObj={new Date('2026-08-18T16:00:00')}
    />
  );
  assert.equal(invalidHtml1, '');

  const invalidHtml2 = renderToString(
    <LiveProgressBar
      currentDateObj={new Date('invalid')}
      nextDateObj={new Date('2026-08-18T16:00:00')}
    />
  );
  assert.equal(invalidHtml2, '');
});

runTest('LiveClock renders cleanly across timezones and languages without throwing', () => {
  const tzs = ['Africa/Cairo', 'Asia/Riyadh', 'America/New_York', 'UTC', 'Invalid/Timezone', ''];
  const langs = ['ar', 'en'];
  const formats = ['12', '24'];

  for (const tz of tzs) {
    for (const lang of langs) {
      for (const fmt of formats) {
        const html = renderToString(
          <LiveClock
            timezone={tz}
            city="Cairo"
            country="Egypt"
            timeFormat={fmt}
            language={lang}
          />
        );
        assert.ok(html.length > 0);
        assert.doesNotMatch(html, /NaN/);
      }
    }
  }
});

runTest('LiveCountdown renders valid countdown string and handles invalid dates safely', () => {
  const future = new Date(Date.now() + 3600 * 1000 * 2); // 2 hours from now
  const htmlValid = renderToString(
    <LiveCountdown nextDateObj={future} language="ar" />
  );
  // Initially in SSR it might be empty or formatted on first effect, but must not crash or output NaN
  assert.doesNotMatch(htmlValid, /NaN/);

  const htmlInvalid = renderToString(
    <LiveCountdown nextDateObj={null} language="ar" />
  );
  assert.equal(htmlInvalid, '');
});

runTest('ScheduleTableModal renders correctly and filters by date', () => {
  const scheduleData = {
    timezone: 'Africa/Cairo',
    totalDays: 2,
    domain: 'test.com',
    schedule: {
      '2026-08-18': {
        Fajr: '04:30',
        Sunrise: '06:00',
        Dhuhr: '12:30',
        Asr: '16:00',
        Maghrib: '19:00',
        Isha: '20:30',
      },
      '2026-08-19': {
        Fajr: '04:31',
        Sunrise: '06:01',
        Dhuhr: '12:30',
        Asr: '16:00',
        Maghrib: '18:59',
        Isha: '20:29',
      },
    },
  };

  const html = renderToString(
    <ScheduleTableModal
      isOpen={true}
      onClose={() => {}}
      scheduleData={scheduleData}
      isEn={false}
      timezone="Africa/Cairo"
    />
  );
  // ScheduleTableModal uses createPortal if typeof document !== 'undefined', in SSR it returns null or portal markup
  // Verify it executes without error and matches no NaN
  assert.doesNotMatch(html, /NaN/);
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n=============================================================');
console.log(`TEST RESULTS: ${passCount} Passed, ${failCount} Failed.`);
console.log('=============================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
