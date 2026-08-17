// Centralized Time & Date Utilities for Islamic Prayer Tracking

/**
 * Converts Eastern Arabic numerals to standard Western digits.
 */
export function toWesternDigits(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  const easternDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return s.replace(/[٠-٩]/g, (w) => easternDigits.indexOf(w));
}

/**
 * Cleans an API time string by stripping timezone identifiers or extra text.
 * e.g., "04:30 (EEST)" -> "04:30"
 */
export function cleanTimeString(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const clean = timeStr.trim().split(' ')[0];
  if (!clean.includes(':')) return '';
  const parts = clean.split(':');
  if (parts.length < 2) return '';
  const h = parts[0].padStart(2, '0');
  const m = parts[1].padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Converts an "HH:MM" string to total minutes elapsed from midnight (0..1439).
 * Returns -1 if invalid or empty.
 */
export function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
    return -1;
  }
  const clean = timeStr.trim().split(' ')[0];
  const [hStr, mStr] = clean.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return -1;
  }
  return h * 60 + m;
}

/**
 * Obtains the current Date object normalized to the specified IANA timezone.
 */
export function getCityNowDate(timezone) {
  const now = new Date();
  if (!timezone) return now;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const map = {};
    parts.forEach((p) => {
      map[p.type] = p.value;
    });

    const localYear = parseInt(map.year, 10);
    const localMonth = parseInt(map.month, 10) - 1;
    const localDay = parseInt(map.day, 10);
    let localHour = parseInt(map.hour, 10);
    if (localHour === 24) localHour = 0;
    const localMin = parseInt(map.minute, 10);
    const localSec = parseInt(map.second, 10);

    const d = new Date(localYear, localMonth, localDay, localHour, localMin, localSec);
    return isNaN(d.getTime()) ? now : d;
  } catch (e) {
    return now;
  }
}

/**
 * Obtains today's date formatted as "YYYY-MM-DD" in the user's city timezone.
 */
export function getCityTodayDateStr(timezone) {
  const d = getCityNowDate(timezone);
  const validD = isNaN(d.getTime()) ? new Date() : d;
  const year = validD.getFullYear();
  const month = String(validD.getMonth() + 1).padStart(2, '0');
  const day = String(validD.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats an "HH:MM" 24h string into 12h display with localized AM/PM indicator.
 */
export function formatTimeDisplay12(timeStr, lang = 'ar') {
  if (!timeStr || !timeStr.includes(':')) return timeStr || '';
  const [hStr, m] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;

  const isEn = lang === 'en';
  const period = h >= 12 ? (isEn ? 'PM' : 'م') : (isEn ? 'AM' : 'ص');
  h = h % 12;
  if (h === 0) h = 12;

  const formattedH = String(h).padStart(2, '0');
  return toWesternDigits(`${formattedH}:${m} ${period}`);
}

/**
 * Formats a time string according to the user's active time format preference ('12' or '24').
 */
export function formatTimeDisplay(timeStr, timeFormat = '12', lang = 'ar') {
  if (!timeStr) return '';
  if (timeFormat === '24') {
    return toWesternDigits(timeStr);
  }
  return formatTimeDisplay12(timeStr, lang);
}

/**
 * Calculates delay in minutes between adhan time and performed time.
 */
export function calculateDelay(adhanTime, performedTime) {
  const adhanM = timeToMinutes(adhanTime);
  const performedM = timeToMinutes(performedTime);
  if (adhanM === -1 || performedM === -1) return 0;
  return Math.max(0, performedM - adhanM);
}

/**
 * Shifts prayer times by user-specified minute offsets (+/- minutes).
 */
export function applyPrayerOffsets(times, offsets = {}) {
  if (!times || typeof times !== 'object') return times;
  if (!offsets || typeof offsets !== 'object') return times;

  const result = { ...times };
  const keys = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  keys.forEach((k) => {
    const rawTime = times[k];
    const offsetMins = Number(offsets[k]) || 0;
    if (rawTime && rawTime.includes(':') && offsetMins !== 0) {
      const [h, m] = rawTime.split(':').map(Number);
      let total = h * 60 + m + offsetMins;
      if (total < 0) total += 1440;
      if (total >= 1440) total %= 1440;
      const newH = String(Math.floor(total / 60)).padStart(2, '0');
      const newM = String(total % 60).padStart(2, '0');
      result[k] = `${newH}:${newM}`;
    }
  });

  return result;
}
