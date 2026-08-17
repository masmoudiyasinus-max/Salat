/**
 * Official Aladhan REST API Service (api.aladhan.com)
 * High-performance, zero-key REST JSON engine for worldwide prayer timings & monthly calendars.
 */
import { cleanTimeString, toWesternDigits } from './timeUtils.js';
import { saveSourceScheduleCache, savePrayerTimesCache, getSourceScheduleCache } from './storage.js';
import { logError } from './errorLogger.js';
import { resolveTimezoneForLocation } from './adhanCalculator.js';

// Mapping internal calculation authority IDs to Aladhan API numerical method IDs
export const ALADHAN_METHOD_MAP = {
  mwl: 3,
  isna: 2,
  egypt: 5,
  makkah: 4,
  karachi: 1,
  tehran: 7,
  gulf: 8,
  kuwait: 9,
  qatar: 10,
  singapore: 11,
  france: 12,
  turkey: 13,
  russia: 14,
  moonsighting: 15,
  dubai: 16,
  jakim: 17,
  tunisia: 18,
  algeria: 19,
  indonesia: 20,
  morocco: 21,
  auto: 5, // Default fallback
};

/**
 * Normalizes a timing string by stripping timezone suffixes (e.g. "04:07 (CET)" -> "04:07").
 */
function cleanAladhanTime(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const timeOnly = raw.split(' ')[0].trim();
  return cleanTimeString(timeOnly);
}

/**
 * Formats day date from Aladhan response to ISO YYYY-MM-DD string.
 */
function formatAladhanDateToISO(dateObj) {
  if (dateObj?.gregorian?.date) {
    // DD-MM-YYYY -> YYYY-MM-DD
    const parts = dateObj.gregorian.date.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return '';
}

/**
 * Fetches a full monthly calendar for a city & country from api.aladhan.com.
 */
export async function fetchAladhanMonthlyCalendar(city, country, methodKey = 'auto', month = null, year = null) {
  if (!city || typeof city !== 'string') return { success: false, error: 'invalid_city' };

  const now = new Date();
  const targetMonth = month || now.getMonth() + 1;
  const targetYear = year || now.getFullYear();
  const methodNum = ALADHAN_METHOD_MAP[methodKey] || ALADHAN_METHOD_MAP.auto;

  const url = `https://api.aladhan.com/v1/calendarByCity?city=${encodeURIComponent(city.trim())}&country=${encodeURIComponent((country || '').trim())}&method=${methodNum}&month=${targetMonth}&year=${targetYear}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { success: false, error: `http_${res.status}` };
    }

    const json = await res.json();
    if (json.code !== 200 || !Array.isArray(json.data)) {
      return { success: false, error: json.data || 'invalid_response' };
    }

    const schedule = {};
    let todayTimes = null;
    let hijriToday = null;

    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    json.data.forEach((dayItem) => {
      const dateISO = formatAladhanDateToISO(dayItem.date);
      if (dateISO && dayItem.timings) {
        const row = {
          Fajr: cleanAladhanTime(dayItem.timings.Fajr),
          Sunrise: cleanAladhanTime(dayItem.timings.Sunrise),
          Dhuhr: cleanAladhanTime(dayItem.timings.Dhuhr),
          Asr: cleanAladhanTime(dayItem.timings.Asr),
          Maghrib: cleanAladhanTime(dayItem.timings.Maghrib),
          Isha: cleanAladhanTime(dayItem.timings.Isha),
          Midnight: cleanAladhanTime(dayItem.timings.Midnight || ''),
          Lastthird: cleanAladhanTime(dayItem.timings.Lastthird || ''),
        };

        schedule[dateISO] = row;

        if (dateISO === todayISO) {
          todayTimes = row;
          hijriToday = dayItem.date?.hijri;
        }
      }
    });

    const totalDays = Object.keys(schedule).length;
    return {
      success: true,
      schedule,
      totalDays,
      todayTimes: todayTimes || (totalDays > 0 ? Object.values(schedule)[0] : null),
      hijriToday,
      city,
      country,
      source: 'Aladhan REST API (api.aladhan.com)',
    };
  } catch (err) {
    console.error('Aladhan API fetch error:', err);
    logError(err, 'AladhanAPI.MonthlyCalendar');
    return { success: false, error: err.message };
  }
}

/**
 * Synchronizes and stores the current month & next month from Aladhan API directly into local storage.
 */
export async function syncFullMonthFromAladhanApi(city, country, methodKey = 'auto') {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // 1. Fetch Current Month
  const currentMonthRes = await fetchAladhanMonthlyCalendar(city, country, methodKey, currentMonth, currentYear);
  if (!currentMonthRes.success || currentMonthRes.totalDays === 0) {
    return currentMonthRes;
  }

  let combinedSchedule = { ...currentMonthRes.schedule };

  // 2. Fetch Next Month (for 60 days total coverage)
  try {
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    const nextMonthRes = await fetchAladhanMonthlyCalendar(city, country, methodKey, nextMonth, nextYear);
    if (nextMonthRes.success && nextMonthRes.schedule) {
      combinedSchedule = { ...combinedSchedule, ...nextMonthRes.schedule };
    }
  } catch (e) {
    console.warn('Next month Aladhan sync warning:', e);
  }

  const totalDays = Object.keys(combinedSchedule).length;
  const domain = 'api.aladhan.com';

  // 3. Save multi-day schedule into localStorage for 100% offline support
  saveSourceScheduleCache({
    url: `https://api.aladhan.com/v1/calendarByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`,
    domain: 'Aladhan API (الرسمي)',
    lastFetched: new Date().toISOString(),
    totalDays,
    schedule: combinedSchedule,
  });

  // 4. Immediately overwrite active prayer times cache with today's times
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayTimes = combinedSchedule[todayStr] || Object.values(combinedSchedule)[0];
  const cityTimezone = currentMonthRes.timezone || resolveTimezoneForLocation(city, country);

  if (todayTimes) {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timeNow = toWesternDigits(`${hh}:${mm}`);

    const mergedTimes = {
      ...todayTimes,
      timezone: cityTimezone,
      lastSyncedDate: todayStr,
      lastSyncedTime: timeNow,
      source: 'واجهة Aladhan API الرسمية (api.aladhan.com)',
      isImportedSchedule: true,
      domain: 'api.aladhan.com',
      totalDaysCount: totalDays,
    };
    savePrayerTimesCache(mergedTimes);
  }

  return {
    success: true,
    totalDays,
    todayTimes,
    schedule: combinedSchedule,
    city,
    country,
    timezone: cityTimezone,
    source: `Aladhan API (${totalDays} يوماً مخزنة محلياً)`,
  };
}
