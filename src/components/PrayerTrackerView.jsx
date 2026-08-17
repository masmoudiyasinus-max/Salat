import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Sun,
  Sunrise,
  Moon,
  CloudSun,
  Lock,
  X,
  BookOpen,
  Navigation,
  Settings,
  Info,
} from 'lucide-react';
import {
  PRAYER_NAMES,
  NAFL_PRAYERS,
  OBLIGATORY_PRAYER_IDS,
  APP_EVENTS,
  getRecords,
  saveRecords,
  upsertRecord,
  getPrayerTimesCache,
  savePrayerTimesCache,
  toWesternDigits,
  calculateNightTimes,
  getNaflRecords,
  toggleNaflRecord,
  getCityNowDate,
  getCityTodayDateStr,
  timeToMinutes,
  computeSummaryStats,
  formatTimeDisplay,
  getCurrentObligatoryPrayerId,
  applyPrayerOffsets,
  getSourceScheduleCache,
  KEYS,
} from '../services/storage';
import { getPrayerTimesForLocation, getDefaultLocationForTimezone, resolveTimezoneForLocation } from '../services/adhanCalculator';
import { requestFreshLocationFromScratch } from '../services/permissionService';
import { getTranslation } from '../services/i18n';
import { DATA_STATUS, getPrayerTimesStatus, isValidTimeString } from '../services/dataReadiness';
import ActivePrayerHero from './ActivePrayerHero';

const PRAYER_ICONS = {
  Fajr: Sunrise,
  Sunrise: Sun,
  Dhuhr: CloudSun,
  Asr: Sun,
  Maghrib: Moon,
  Isha: Moon,
};

export default function PrayerTrackerView({ settings, onRecordUpdated, onNavigateToSettings }) {
  const lang = settings?.language || 'ar';
  const t = (k, fb) => getTranslation(lang, k, fb);
  const [prayerTimes, setPrayerTimes] = useState(getPrayerTimesCache);
  const [records, setRecords] = useState(getRecords);
  const [naflRecords, setNaflRecords] = useState(getNaflRecords);

  // Modal Sub-window State for Obligatory Prayers
  const [activeModalPrayer, setActiveModalPrayer] = useState(null);
  const [customPerformedTime, setCustomPerformedTime] = useState('');
  const [showFridayHadithModal, setShowFridayHadithModal] = useState(false);
  const [isDetectingLocationQuick, setIsDetectingLocationQuick] = useState(false);

  const handleQuickAutoDetectLocation = async () => {
    setIsDetectingLocationQuick(true);
    const res = await requestFreshLocationFromScratch(() => {
      setPrayerTimes(getPrayerTimesCache());
    });
    setIsDetectingLocationQuick(false);
    if (!res.success) {
      if (res.error === 'denied') {
        alert(lang === 'en' ? 'Location permission was denied in your browser. Please select your city from Settings.' : 'تم رفض إذن الوصول للموقع في المتصفح، يرجى اختيار مدينتك من شاشة الإعدادات.');
      } else {
        alert(lang === 'en' ? 'Could not detect live location. Please select your city from Settings.' : 'تعذر استقبال إشارة الموقع المباشرة، يرجى اختيار مدينتك من شاشة الإعدادات.');
      }
    }
  };

  const effectiveTimezone = prayerTimes?.timezone || resolveTimezoneForLocation(settings?.city, settings?.country);
  const tzOpt = (effectiveTimezone && typeof effectiveTimezone === 'string' && effectiveTimezone.includes('/')) ? { timeZone: effectiveTimezone } : {};

  const [nowTime, setNowTime] = useState(() => {
    const d = getCityNowDate(effectiveTimezone);
    return isNaN(d.getTime()) ? new Date() : d;
  });
  const safeNow = nowTime && !isNaN(nowTime.getTime()) ? nowTime : new Date();
  const year = safeNow.getFullYear();
  const month = String(safeNow.getMonth() + 1).padStart(2, '0');
  const day = String(safeNow.getDate()).padStart(2, '0');
  const selectedDate = `${year}-${month}-${day}`;

  useEffect(() => {
    const updateClock = () => {
      if (document.hidden) return;
      const cityNow = getCityNowDate(effectiveTimezone);
      setNowTime(isNaN(cityNow.getTime()) ? new Date() : cityNow);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    const handleVisibilityChange = () => {
      if (!document.hidden) updateClock();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [effectiveTimezone]);

  useEffect(() => {
    setRecords(getRecords());
    setNaflRecords(getNaflRecords());
  }, [selectedDate]);

  // Listen to prayer times updates from settings or background recalculations
  useEffect(() => {
    const handleTimesUpdated = (e) => {
      if (e?.detail) {
        setPrayerTimes(e.detail);
      } else {
        setPrayerTimes(getPrayerTimesCache());
      }
    };
    window.addEventListener(APP_EVENTS.PRAYER_TIMES_UPDATED, handleTimesUpdated);
    return () => window.removeEventListener(APP_EVENTS.PRAYER_TIMES_UPDATED, handleTimesUpdated);
  }, []);

  // Instant Mathematical Astronomical Calculation via adhan-js whenever location, method, or date changes
  useEffect(() => {
    let isMounted = true;
    async function autoCalculatePrayerTimes() {
      const targetDateStr = selectedDate;
      const cached = getPrayerTimesCache();

      // 1. Check if an imported schedule is stored locally and contains this date
      const importedSchedule = getSourceScheduleCache();
      if (importedSchedule?.schedule && importedSchedule.schedule[targetDateStr]) {
        const tableTimes = importedSchedule.schedule[targetDateStr];
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const timeNow = toWesternDigits(`${hh}:${mm}`);

        const mergedTimes = {
          ...tableTimes,
          timezone: resolveTimezoneForLocation(settings?.city, settings?.country),
          lastSyncedDate: targetDateStr,
          lastSyncedTime: timeNow,
          source: `جدول مستورد من الموقع: ${importedSchedule.domain || 'المصدر'}`,
          isImportedSchedule: true,
          domain: importedSchedule.domain,
          totalDaysCount: importedSchedule.totalDays,
        };
        setPrayerTimes(mergedTimes);
        savePrayerTimesCache(mergedTimes);
        return;
      }

      // If already accurately calculated with adhan-js for this exact date, city, and method, we're good
      if (
        cached &&
        cached.lastSyncedDate === targetDateStr &&
        cached.Fajr &&
        cached.source &&
        cached.source.includes('adhan-js') &&
        cached.calculationMethod === (settings?.calculationMethod || 'auto') &&
        cached.asrMadhab === (settings?.asrMadhab || 'shafi')
      ) {
        return;
      }

      const defaultLoc = getDefaultLocationForTimezone();
      const effectiveCity = settings?.city || defaultLoc.city;
      const effectiveCountry = settings?.country || defaultLoc.country;

      try {
        const res = await getPrayerTimesForLocation(
          effectiveCity,
          effectiveCountry,
          targetDateStr,
          settings
        );

        if (isMounted && res && res.success && res.times) {
          const now = new Date();
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          const timeNow = toWesternDigits(`${hh}:${mm}`);

          const mergedTimes = {
            ...res.times,
            timezone: res.timezone || prayerTimes?.timezone || '',
            lastSyncedDate: targetDateStr,
            lastSyncedTime: timeNow,
            calculationMethod: settings?.calculationMethod || 'auto',
            asrMadhab: settings?.asrMadhab || 'shafi',
            source: 'حساب فلكي دقيق (adhan-js)',
          };
          setPrayerTimes(mergedTimes);
          savePrayerTimesCache(mergedTimes);
        }
      } catch (err) {
        console.error('Auto calculate caught error:', err);
      }
    }

    autoCalculatePrayerTimes();
    return () => {
      isMounted = false;
    };
  }, [settings.city, settings.country, settings.calculationMethod, settings.asrMadhab, selectedDate]);


  const safeRecords = Array.isArray(records) ? records : [];
  const safeNaflRecords = Array.isArray(naflRecords) ? naflRecords : [];

  const dateRecords = useMemo(
    () => safeRecords.filter((r) => r && r.date === selectedDate),
    [safeRecords, selectedDate]
  );
  const dateNaflRecords = useMemo(
    () => safeNaflRecords.filter((r) => r && r.date === selectedDate),
    [safeNaflRecords, selectedDate]
  );

  // Effective Prayer Times with user-specified offsets applied
  const effectivePrayerTimes = useMemo(
    () => applyPrayerOffsets(prayerTimes, settings?.prayerOffsets),
    [prayerTimes, settings?.prayerOffsets]
  );

  // Night Calculation (Maghrib to Fajr)
  const nightTimes = useMemo(
    () => calculateNightTimes(effectivePrayerTimes?.Maghrib, effectivePrayerTimes?.Fajr),
    [effectivePrayerTimes?.Maghrib, effectivePrayerTimes?.Fajr]
  );

  // Live Countup and Countdown Timers Computation for All Islamic Timeline Events (Continuous Rolling Timeline)
  const timerInfo = useMemo(() => {
    if (!effectivePrayerTimes?.Fajr || !effectivePrayerTimes?.Sunrise || !effectivePrayerTimes?.Dhuhr || !effectivePrayerTimes?.Asr || !effectivePrayerTimes?.Maghrib || !effectivePrayerTimes?.Isha) {
      return {
        currentEvent: null,
        nextEvent: null,
        currentPrayerId: null,
        currentEventLabel: '',
        nextEventLabel: '',
        currentAdhanTime: '',
        nextAdhanTime: '',
        nextEventDate: null,
        prevEventDate: null,
        isRollingCycle: false,
      };
    }

    const parseEventDateTime = (timeStr, dayOffset = 0) => {
      if (!timeStr || !timeStr.includes(':')) return null;
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return null;
      const d = new Date(safeNow.getTime());
      d.setDate(d.getDate() + dayOffset);
      d.setHours(h, m, 0, 0);
      return d;
    };

    const buildDailyEvents = (dayOffset) => {
      const pTimes = effectivePrayerTimes || {};
      const fajrT = pTimes.Fajr;
      const sunriseT = pTimes.Sunrise;
      const dhuhrT = pTimes.Dhuhr;
      const asrT = pTimes.Asr;
      const maghribT = pTimes.Maghrib;
      const ishaT = pTimes.Isha;

      if (!fajrT || !sunriseT || !dhuhrT || !asrT || !maghribT || !ishaT) {
        return [];
      }

      const nTimes = calculateNightTimes(maghribT, fajrT);
      const [sH, sM] = sunriseT.split(':').map(Number);
      const duhaTotalM = sH * 60 + sM + 15;
      const duhaH = Math.floor(duhaTotalM / 60) % 24;
      const duhaM = duhaTotalM % 60;
      const duhaT = `${String(duhaH).padStart(2, '0')}:${String(duhaM).padStart(2, '0')}`;

      // Midnight and Last Third date objects calculated relative to Maghrib timestamp
      const maghribDateObj = parseEventDateTime(maghribT, dayOffset);
      if (!maghribDateObj) return [];
      const halfNightMs = Math.floor(((nTimes?.nightDurationMinutes || 0) * 60 * 1000) / 2);
      const twoThirdsMs = Math.floor(((nTimes?.nightDurationMinutes || 0) * 60 * 1000 * 2) / 3);

      const midnightDateObj = new Date(maghribDateObj.getTime() + halfNightMs);
      const lastThirdDateObj = new Date(maghribDateObj.getTime() + twoThirdsMs);

      return [
        { id: 'Fajr', nameAr: 'أذان الفجر', labelCountup: 'مضى على أذان الفجر', labelCountdown: 'المتبقي لأذان الفجر', dateObj: parseEventDateTime(fajrT, dayOffset) },
        { id: 'Sunrise', nameAr: 'وقت الشروق', labelCountup: 'مضى على وقت الشروق', labelCountdown: 'المتبقي لوقت الشروق', dateObj: parseEventDateTime(sunriseT, dayOffset) },
        { id: 'Duha', nameAr: 'وقت صلاة الضحى', labelCountup: 'مضى على وقت صلاة الضحى', labelCountdown: 'المتبقي لوقت صلاة الضحى', dateObj: parseEventDateTime(duhaT, dayOffset) },
        { id: 'Dhuhr', nameAr: 'أذان الظهر', labelCountup: 'مضى على أذان الظهر', labelCountdown: 'المتبقي لأذان الظهر', dateObj: parseEventDateTime(dhuhrT, dayOffset) },
        { id: 'Asr', nameAr: 'أذان العصر', labelCountup: 'مضى على أذان العصر', labelCountdown: 'المتبقي لأذان العصر', dateObj: parseEventDateTime(asrT, dayOffset) },
        { id: 'Maghrib', nameAr: 'أذان المغرب', labelCountup: 'مضى على أذان المغرب', labelCountdown: 'المتبقي لأذان المغرب', dateObj: maghribDateObj },
        { id: 'Isha', nameAr: 'أذان العشاء', labelCountup: 'مضى على أذان العشاء', labelCountdown: 'المتبقي لأذان العشاء', dateObj: parseEventDateTime(ishaT, dayOffset) },
        { id: 'Midnight', nameAr: 'منتصف الليل الشرعي', labelCountup: 'مضى على منتصف الليل الشرعي', labelCountdown: 'المتبقي لمنتصف الليل الشرعي', dateObj: midnightDateObj },
        { id: 'LastThird', nameAr: 'الثلث الأخير', labelCountup: 'مضى على الثلث الأخير', labelCountdown: 'المتبقي للثلث الأخير', dateObj: lastThirdDateObj },
      ];
    };

    const allEvents = [
      ...buildDailyEvents(-1),
      ...buildDailyEvents(0),
      ...buildDailyEvents(1),
    ].sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    let currentEvent = null;
    let nextEvent = null;

    for (let i = 0; i < allEvents.length - 1; i++) {
      if (safeNow >= allEvents[i].dateObj && safeNow < allEvents[i + 1].dateObj) {
        currentEvent = allEvents[i];
        nextEvent = allEvents[i + 1];
        break;
      }
    }

    if (!currentEvent) {
      currentEvent = allEvents[0];
      nextEvent = allEvents[1] || allEvents[0];
    }

    // Countup Timer: Elapsed since current event
    const elapsedMs = Math.max(0, safeNow.getTime() - currentEvent.dateObj.getTime());
    const elapsedSecs = Math.floor(elapsedMs / 1000);
    const elH = Math.floor(elapsedSecs / 3600);
    const elM = Math.floor((elapsedSecs % 3600) / 60);
    const elS = elapsedSecs % 60;
    const countupStr = elH > 0
      ? `${String(elH).padStart(2, '0')}:${String(elM).padStart(2, '0')}:${String(elS).padStart(2, '0')}`
      : `${String(elM).padStart(2, '0')}:${String(elS).padStart(2, '0')}`;

    // Countdown Timer: Remaining until next event
    const remainingMs = Math.max(0, nextEvent.dateObj.getTime() - safeNow.getTime());
    const remainingSecs = Math.floor(remainingMs / 1000);
    const remH = Math.floor(remainingSecs / 3600);
    const remM = Math.floor((remainingSecs % 3600) / 60);
    const remS = remainingSecs % 60;
    const countdownStr = remH > 0
      ? `${String(remH).padStart(2, '0')}:${String(remM).padStart(2, '0')}:${String(remS).padStart(2, '0')}`
      : `${String(remM).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;

    return {
      currentEventId: currentEvent.id,
      currentEventName: currentEvent.nameAr,
      currentPrayerId: currentEvent.id.replace('_Next', ''),
      currentLabelCountup: currentEvent.labelCountup || `مضى على ${currentEvent.nameAr}`,
      currentEventDateObj: currentEvent.dateObj,
      nextEventId: nextEvent.id,
      nextEventName: nextEvent.nameAr,
      nextPrayerId: nextEvent.id.replace('_Next', ''),
      nextLabelCountdown: nextEvent.labelCountdown || `المتبقي لـ ${nextEvent.nameAr}`,
      nextEventDateObj: nextEvent.dateObj,
      countupStr: toWesternDigits(countupStr),
      countdownStr: toWesternDigits(countdownStr),
      elapsedSecs,
      remainingSecs,
      remM,
      remS,
      isAfterGracePeriod: elapsedSecs > (settings.gracePeriodMinutes ?? 15) * 60,
      isPast30Minutes: elapsedSecs > 30 * 60,
    };
  }, [safeNow, prayerTimes, settings?.gracePeriodMinutes]);



  const calculateDelay = (adhanTimeStr, performedTimeStr) => {
    if (!adhanTimeStr || !performedTimeStr) return 0;
    const [aH, aM] = adhanTimeStr.split(':').map(Number);
    const [pH, pM] = performedTimeStr.split(':').map(Number);

    const adhanMinutes = aH * 60 + aM;
    const performedMinutes = pH * 60 + pM;

    let diff = performedMinutes - adhanMinutes;
    if (diff < 0) diff += 1440;
    return diff;
  };

  // Helper to determine if Shariah Midnight (منتصف الليل الشرعي) has passed
  const isMidnightArrived = () => {
    if (!prayerTimes?.Maghrib || !prayerTimes?.Fajr) return false;
    const maghribT = prayerTimes.Maghrib;
    const fajrT = prayerTimes.Fajr;
    const nTimes = calculateNightTimes(maghribT, fajrT);
    if (!nTimes) return false;

    const [mH, mM] = maghribT.split(':').map(Number);
    const [fH, fM] = fajrT.split(':').map(Number);
    const currentMins = safeNow.getHours() * 60 + safeNow.getMinutes();
    const fajrMins = fH * 60 + fM;

    // Calculate exact midnight timestamp for the relevant night
    const halfNightMs = Math.floor((nTimes.nightDurationMinutes * 60 * 1000) / 2);
    
    let maghribDate = new Date(safeNow.getTime());
    if (currentMins < fajrMins) {
      // Early morning before Fajr: Night started yesterday evening!
      maghribDate.setDate(maghribDate.getDate() - 1);
    }
    maghribDate.setHours(mH, mM, 0, 0);

    const midnightTimeMs = maghribDate.getTime() + halfNightMs;
    return safeNow.getTime() >= midnightTimeMs;
  };


  // Lock check: Disable access ONLY if prayer adhan time has not arrived yet today
  const isPrayerTimeArrived = (adhanTimeStr, prayerId) => {
    if (!adhanTimeStr) return true;
    if (selectedDate < getCityTodayDateStr(prayerTimes?.timezone)) return true; // Past dates are ALWAYS unlocked!
    const timeMins = timeToMinutes(adhanTimeStr);
    if (timeMins === -1) return true;
    const currentMins = safeNow.getHours() * 60 + safeNow.getMinutes();
    return currentMins >= timeMins;
  };

  // Check if next prayer adhan time (or Sunrise for Fajr, or Shariah Midnight for Isha) has arrived
  const isNextPrayerTimeArrived = (currentPrayerId) => {
    if (selectedDate < getCityTodayDateStr(effectivePrayerTimes?.timezone || prayerTimes?.timezone)) return true; // Past dates always considered next prayer arrived!
    if (!effectivePrayerTimes) return false;
    const validObligatory = OBLIGATORY_PRAYER_IDS;
    const idx = validObligatory.indexOf(currentPrayerId);
    if (idx === -1) return false;

    const nextId = validObligatory[(idx + 1) % validObligatory.length];
    
    if (nextId === 'Fajr') {
      const sunriseTime = effectivePrayerTimes?.Sunrise;
      if (!sunriseTime) return false;
      return isPrayerTimeArrived(sunriseTime);
    }

    if (nextId === 'Isha') {
      return isMidnightArrived();
    }

    return isPrayerTimeArrived(effectivePrayerTimes[nextId], nextId);
  };

  // Automatic Real-Time Status Determination
  const getAutoEvaluatedStatus = (prayerId, adhanTimeStr) => {
    const rec = dateRecords.find((r) => r.prayer_name === prayerId);
    const isToday = true;

    // 1. If recorded status exists in saved data, use it!
    if (rec && rec.status) {
      return rec.status;
    }

    // 2. If prayer adhan time has not arrived yet today -> unarrived
    if (isToday && !isPrayerTimeArrived(adhanTimeStr, prayerId)) {
      return 'unarrived';
    }

    const nextArrived = isNextPrayerTimeArrived(prayerId);

    // 3. If next prayer adhan has arrived and user did NOT record it -> missed
    if (!isToday || nextArrived) {
      return 'missed';
    }

    // 4. Prayer window is currently active and user HAS NOT recorded it yet -> unperformed (none)
    return 'none';
  };

  // Automatic Real-Time Persistence Evaluator & Stale Cleanup for TRULY Missed Prayers
  useEffect(() => {
    if (!effectivePrayerTimes) return;
    let updated = false;

    const isToday = true;
    const currentRecords = getRecords();

    // 1. Clean premature missed records ONLY for obligatory prayers today
    let cleanedRecords = currentRecords.filter((r) => {
      const isObligatory = PRAYER_NAMES.some((p) => p.id === r.prayer_name);
      if (isObligatory && r.date === selectedDate && r.status === 'missed') {
        const nextArrived = isNextPrayerTimeArrived(r.prayer_name);
        if (!nextArrived) {
          updated = true;
          return false; // Remove premature missed record for active prayer!
        }
      }
      return true;
    });

    // 2. Persist truly missed prayers (after next prayer adhan arrives or past date)
    PRAYER_NAMES.forEach((p) => {
      const timeStr = effectivePrayerTimes[p.id];
      if (!timeStr) return;

      const hasArrived = isPrayerTimeArrived(timeStr);
      const nextArrived = isNextPrayerTimeArrived(p.id);

      if (!isToday || (hasArrived && nextArrived)) {
        const rec = cleanedRecords.find((r) => r.date === selectedDate && r.prayer_name === p.id);
        if (!rec) {
          cleanedRecords.push({
            date: selectedDate,
            prayer_name: p.id,
            adhan_time: timeStr,
            performed_time: '',
            delay_minutes: 0,
            status: 'missed',
          });
          updated = true;
        }
      }
    });

    if (updated) {
      saveRecords(cleanedRecords);
      setRecords([...cleanedRecords]);
    }
  }, [selectedDate, prayerTimes]);

  // Persistent Re-toggle History Manager (track: performed -> cancelled -> re-performed)
  const getToggleHistory = () => {
    try {
      const raw = localStorage.getItem(KEYS.RE_TOGGLE_HISTORY) || localStorage.getItem('prayer_re_toggle_history');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  };

  const saveToggleHistory = (historyObj) => {
    try {
      localStorage.setItem(KEYS.RE_TOGGLE_HISTORY, JSON.stringify(historyObj));
    } catch (e) {}
  };

  const isReToggleLocked = (prayerId) => {
    const rec = dateRecords.find((r) => r.prayer_name === prayerId);
    if (!rec || rec.status === 'missed') return false;
    const key = `${selectedDate}_${prayerId}`;
    const history = getToggleHistory();
    const count = history[key] || 0;
    return Boolean(rec.is_final_locked || count >= 2);
  };

  // Helper to check if a prayer status is missed and locked
  const isMissedAndLocked = (prayerId) => {
    if (!prayerTimes || !prayerTimes[prayerId]) return false;
    const rec = dateRecords.find((r) => r.prayer_name === prayerId);
    const status = getAutoEvaluatedStatus(prayerId, prayerTimes[prayerId]);
    return (rec && rec.status === 'missed') || status === 'missed';
  };

  const handleMarkPerformed = (prayerId, timeOverride = '', customStatus = null) => {
    const adhanTime = prayerTimes ? prayerTimes[prayerId] : null;
    if (!adhanTime || !isPrayerTimeArrived(adhanTime)) return;

    if (isMissedAndLocked(prayerId)) {
      alert(lang === 'en' ? 'This prayer was recorded as missed and cannot be modified according to strict commitment rules.' : 'هذه الصلاة سُجّلت كمتروكة ولا يمكن تعديل بياناتها وفقاً لقواعد الالتزام الصارمة.');
      return;
    }

    if (isReToggleLocked(prayerId)) {
      return;
    }

    const toggleKey = `${selectedDate}_${prayerId}`;
    const history = getToggleHistory();
    const newCount = (history[toggleKey] || 0) + 1;
    history[toggleKey] = newCount;
    saveToggleHistory(history);

    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const performedHHMM = timeOverride || currentHHMM;

    const delay = calculateDelay(adhanTime, performedHHMM);
    const grace = settings.gracePeriodMinutes ?? 15;

    let status = customStatus || (delay <= grace ? 'on_time' : 'late');

    const newRec = {
      date: selectedDate,
      prayer_name: prayerId,
      adhan_time: adhanTime,
      performed_time: performedHHMM,
      delay_minutes: delay,
      status: status,
      is_final_locked: newCount >= 2,
    };

    const updated = upsertRecord(newRec);
    setRecords([...updated]);
    if (onRecordUpdated) onRecordUpdated();
  };

  const handleMarkMissed = (prayerId) => {
    const adhanTime = prayerTimes ? prayerTimes[prayerId] : null;
    if (!adhanTime || !isPrayerTimeArrived(adhanTime)) return;

    const newRec = {
      date: selectedDate,
      prayer_name: prayerId,
      adhan_time: adhanTime,
      performed_time: '',
      delay_minutes: 0,
      status: 'missed',
    };

    const updated = upsertRecord(newRec);
    setRecords([...updated]);
    if (onRecordUpdated) onRecordUpdated();
  };

  const handleStatusChange = (prayerId, newStatus) => {
    const adhanTime = prayerTimes ? prayerTimes[prayerId] : null;
    if (!adhanTime || !isPrayerTimeArrived(adhanTime)) return;

    if (isMissedAndLocked(prayerId) && newStatus !== 'missed') {
      alert(lang === 'en' ? 'This prayer was recorded as missed and cannot be changed to done according to strict commitment rules.' : 'هذه الصلاة سُجّلت كمتروكة ولا يمكن تحويلها إلى (تم) وفقاً لقواعد الالتزام الصارمة.');
      return;
    }

    if (isReToggleLocked(prayerId)) {
      return;
    }

    const existing = dateRecords.find((r) => r.prayer_name === prayerId);

    // TOGGLE OFF: If prayer is already recorded with this same status, toggle it off by removing the record!
    if (existing && existing.status === newStatus) {
      const toggleKey = `${selectedDate}_${prayerId}`;
      const history = getToggleHistory();
      history[toggleKey] = Math.max(history[toggleKey] || 0, 1);
      saveToggleHistory(history);

      const allRecords = getRecords();
      const updated = allRecords.filter(r => !(r.date === selectedDate && r.prayer_name === prayerId));
      saveRecords(updated);
      setRecords([...updated]);
      if (onRecordUpdated) onRecordUpdated();
      return;
    }

    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const performedTime = existing?.performed_time || currentHHMM;
    const delayMins = calculateDelay(adhanTime, performedTime);

    const newRec = {
      date: selectedDate,
      prayer_name: prayerId,
      adhan_time: adhanTime,
      performed_time: performedTime,
      delay_minutes: delayMins,
      status: newStatus,
    };

    const updated = upsertRecord(newRec);
    setRecords([...updated]);
    if (onRecordUpdated) onRecordUpdated();
  };

  // Automatic Real-Time Nafl Status Determination & Missed Locking System
  const getAutoEvaluatedNaflStatus = (naflId) => {
    const naflRec = dateNaflRecords.find((r) => r.nafl_id === naflId);
    if (naflRec && naflRec.status === 'completed') {
      return 'on_time';
    }

    const idx = NAFL_PRAYERS.findIndex((n) => n.id === naflId);
    if (idx === -1) return 'missed';

    if (!effectivePrayerTimes?.Fajr || !effectivePrayerTimes?.Sunrise || !effectivePrayerTimes?.Dhuhr || !effectivePrayerTimes?.Maghrib || !effectivePrayerTimes?.Isha) {
      return 'unarrived';
    }

    const getNaflTimeMins = (nId) => {
      const parseMins = (tStr) => {
        if (!tStr || !tStr.includes(':')) return 0;
        const [h, m] = tStr.split(':').map(Number);
        return h * 60 + m;
      };
      const fajr = parseMins(effectivePrayerTimes.Fajr);
      const sunrise = parseMins(effectivePrayerTimes.Sunrise);
      const dhuhr = parseMins(effectivePrayerTimes.Dhuhr);
      const maghrib = parseMins(effectivePrayerTimes.Maghrib);
      const isha = parseMins(effectivePrayerTimes.Isha);
      const lastThird = parseMins(nightTimes.lastThird);

      switch (nId) {
        case 'Sunnah_Fajr': return fajr;
        case 'Duha': return sunrise + 15;
        case 'Sunnah_Dhuhr_Pre': return dhuhr;
        case 'Sunnah_Dhuhr_Post': return dhuhr + 15;
        case 'Sunnah_Maghrib': return maghrib;
        case 'Sunnah_Isha': return isha;
        case 'Qiyam_Layl': return isha + 30;
        case 'Witr': return lastThird < isha ? lastThird + 1440 : lastThird;
        case 'Fajr_Next': return fajr + 1440;
        default: return fajr;
      }
    };

    let currentMins = safeNow.getHours() * 60 + safeNow.getMinutes();
    const fajrMins = (effectivePrayerTimes.Fajr.split(':').map(Number)[0]) * 60 + (effectivePrayerTimes.Fajr.split(':').map(Number)[1]);

    if (currentMins < fajrMins) {
      currentMins += 1440;
    }

    const startMins = getNaflTimeMins(naflId);
    const isToday = true;
    if (isToday && currentMins < startMins) {
      return 'unarrived';
    }

    const nextId = NAFL_PRAYERS[idx + 1]?.id || 'Fajr_Next';
    const nextMins = getNaflTimeMins(nextId);
    if (isToday && currentMins < nextMins) {
      return 'late'; // Active window open!
    }

    return 'missed'; // Time window passed -> Truly Missed!
  };

  const handleToggleNafl = (naflId) => {
    const status = getAutoEvaluatedNaflStatus(naflId);
    if (status === 'unarrived') return;

    if (status === 'missed') {
      alert(lang === 'en' ? 'The time window for this Sunnah prayer has ended and it cannot be recorded according to commitment rules.' : 'انقضى وقت هذه السنة والنوافل وتعتبر متروكة ولا يمكن تسجيلها بعد انقضاء وقتها وفقاً لقواعد الالتزام.');
      return;
    }

    const updated = toggleNaflRecord(selectedDate, naflId);
    setNaflRecords([...updated]);
  };

  // Hero Date Formatting with Western Digits (1 2 3 4 5) in exact city timezone
  const isEn = lang === 'en';
  const is12Hour = (settings?.timeFormat || '12') === '12';

  const liveClockTime = isEn
    ? (new Date()).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: is12Hour,
        ...tzOpt,
      })
    : toWesternDigits(
        (new Date()).toLocaleTimeString('ar-EG-u-nu-latn', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: is12Hour,
          ...tzOpt,
        })
      );

  const gregorianDateFormatted = isEn
    ? (new Date()).toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        ...tzOpt,
      })
    : toWesternDigits(
        (new Date()).toLocaleDateString('ar-EG-u-nu-latn', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          ...tzOpt,
        })
      );

  const hijriDateFormatted = isEn
    ? `${(new Date()).toLocaleDateString('en-US-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        ...tzOpt,
      })} AH`
    : `${toWesternDigits(
        (new Date()).toLocaleDateString('ar-SA-u-ca-islamic-umalqura-nu-latn', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          ...tzOpt,
        })
      )} هـ`;

  const prayerTimesStatus = getPrayerTimesStatus(effectivePrayerTimes);
  const isDataReady = prayerTimesStatus === DATA_STATUS.READY;

  const modalPrayerInfo = activeModalPrayer
    ? PRAYER_NAMES.find((p) => p.id === activeModalPrayer)
    : null;
  const modalRec = activeModalPrayer
    ? dateRecords.find((r) => r.prayer_name === activeModalPrayer)
    : null;
  const modalHasArrived = activeModalPrayer && effectivePrayerTimes && effectivePrayerTimes[activeModalPrayer]
    ? isPrayerTimeArrived(effectivePrayerTimes[activeModalPrayer])
    : false;
  const ModalIconComp = activeModalPrayer ? PRAYER_ICONS[activeModalPrayer] || Clock : Clock;

  const oblList = OBLIGATORY_PRAYER_IDS;
  const activeObligatoryId = isDataReady ? getCurrentObligatoryPrayerId(effectivePrayerTimes, safeNow) : null;
  const activePrayerObj = activeObligatoryId ? PRAYER_NAMES.find((p) => p.id === activeObligatoryId) : null;
  const activeAdhanStr = (isDataReady && activeObligatoryId && effectivePrayerTimes[activeObligatoryId]) || '';
  const activeRec = (dateRecords || []).find((r) => r.prayer_name === activeObligatoryId);
  const activeStatus = activeRec?.status || (activeObligatoryId && activeAdhanStr ? getAutoEvaluatedStatus(activeObligatoryId, activeAdhanStr) : null);

  const currentOblIndex = activeObligatoryId ? oblList.indexOf(activeObligatoryId) : -1;
  const nextOblId = currentOblIndex >= 0 ? (currentOblIndex < oblList.length - 1 ? oblList[currentOblIndex + 1] : 'Fajr') : null;
  const nextPrayerObj = nextOblId ? PRAYER_NAMES.find((p) => p.id === nextOblId) : null;
  const nextAdhanStr = (isDataReady && nextOblId && effectivePrayerTimes[nextOblId]) || '';

  // Compute precise Date objects for active & next obligatory prayer adhans
  const parsePrayerDateTime = (timeStr, dayOffset = 0) => {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const d = new Date(safeNow.getTime());
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d;
  };

  let currentOblDateObj = isDataReady && activeAdhanStr ? parsePrayerDateTime(activeAdhanStr, 0) : null;
  if (currentOblDateObj && activeObligatoryId === 'Isha' && safeNow < currentOblDateObj) {
    currentOblDateObj = parsePrayerDateTime(activeAdhanStr, -1);
  }

  let nextOblDateObj = isDataReady && nextAdhanStr ? parsePrayerDateTime(nextAdhanStr, 0) : null;
  if (nextOblDateObj && (currentOblIndex === oblList.length - 1 || nextOblDateObj <= safeNow)) {
    nextOblDateObj = parsePrayerDateTime(nextAdhanStr, 1);
  }

  const isActiveCompleted = Boolean(activeRec && (activeStatus === 'on_time' || activeStatus === 'late' || activeStatus === 'qada'));

  return (
    <div className="prayer-tracker-view" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {/* 1. Cohesive Active Prayer Hero Component (Reception, Clock, Streak, Countdown, Progress Bar, & Actions) */}
      <ActivePrayerHero
        isDataReady={isDataReady}
        prayerTimes={effectivePrayerTimes}
        settings={settings}
        selectedDate={selectedDate}
        activeObligatoryId={activeObligatoryId}
        activePrayerObj={activePrayerObj}
        activeAdhanStr={activeAdhanStr}
        isActiveCompleted={isActiveCompleted}
        activeRec={activeRec}
        activeStatus={activeStatus}
        nextOblId={nextOblId}
        nextPrayerObj={nextPrayerObj}
        nextAdhanStr={nextAdhanStr}
        currentOblDateObj={currentOblDateObj}
        nextOblDateObj={nextOblDateObj}
        timerInfo={timerInfo}
        isNextPrayerTimeArrived={isNextPrayerTimeArrived}
        isMissedAndLocked={isMissedAndLocked}
        isReToggleLocked={isReToggleLocked}
        getToggleHistory={getToggleHistory}
        saveToggleHistory={saveToggleHistory}
        onRecordUpdated={onRecordUpdated}
        setRecords={setRecords}
        handleMarkPerformed={handleMarkPerformed}
        onOpenModal={(pId) => setActiveModalPrayer(pId)}
        onQuickAutoDetect={handleQuickAutoDetectLocation}
        isDetectingLocation={isDetectingLocationQuick}
        onNavigateToSettings={onNavigateToSettings}
        t={t}
      />

      {/* Frosted Glass Sub-Window Modal for Obligatory Prayers */}
      {activeModalPrayer && (
        <div className="prayer-modal-backdrop" onClick={() => setActiveModalPrayer(null)}>
          <div
            className="prayer-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '420px', width: '90%' }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                paddingBottom: '14px',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ModalIconComp size={24} style={{ color: 'var(--text-primary)' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>
                  {settings?.language === 'en' ? `Set Performed Time for ${t(activeModalPrayer, modalPrayerInfo?.nameAr)}` : `تحديد وقت أداء صلاة ${modalPrayerInfo?.nameAr}`}
                </h3>
              </div>

              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
                onClick={() => setActiveModalPrayer(null)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            {(() => {
              const adhanT = (effectivePrayerTimes && effectivePrayerTimes[activeModalPrayer]) || '';
              const now = new Date();
              const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
              
              const inputTime = customPerformedTime || modalRec?.performed_time || currentHHMM;
              const isFutureTime = inputTime > currentHHMM;
              const isBeforeAdhanTime = inputTime < adhanT;
              const isInvalidTime = isFutureTime || isBeforeAdhanTime;
              const isLocked = isMissedAndLocked(activeModalPrayer) || isReToggleLocked(activeModalPrayer);

              return (
                <div>
                  {!modalHasArrived ? (
                    <div
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-muted)',
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        textAlign: 'center',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      <Lock size={16} />
                      <span>{settings?.language === 'en' ? 'The prayer time has not arrived yet today.' : 'لم يحن وقت أذان هذه الصلاة بعد اليوم.'}</span>
                    </div>
                  ) : isLocked ? (
                    <div
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#ff0000',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.88rem',
                        fontWeight: '700',
                        textAlign: 'center',
                      }}
                    >
                      {settings?.language === 'en' ? 'This prayer is marked as missed or locked, performed time cannot be modified.' : 'سُجّلت هذه الصلاة كمتروكة أو مقفلة نهائياً، ولا يمكن تعديل وقت أدائها.'}
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: '16px',
                          fontSize: '0.86rem',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{settings?.language === 'en' ? "Today's Adhan Time:" : 'وقت أذان الصلاة اليوم:'}</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{toWesternDigits(adhanT)}</strong>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <label
                          style={{
                            marginBottom: '8px',
                            display: 'block',
                            fontWeight: '700',
                            fontSize: '0.88rem',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {settings?.language === 'en' ? 'Select the time you performed the prayer:' : 'حدد الوقت الذي أديت فيه الصلاة:'}
                        </label>
                        <input
                          type="time"
                          value={inputTime}
                          onChange={(e) => setCustomPerformedTime(e.target.value)}
                          autoComplete="off"
                          data-form-type="other"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          name="performed_time_custom"
                          style={{
                            padding: '12px 16px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '1.2rem',
                            fontWeight: '800',
                            textAlign: 'center',
                            backgroundColor: 'var(--bg-primary)',
                            color: isInvalidTime ? '#ff0000' : 'var(--text-primary)',
                            border: `1.5px solid ${isInvalidTime ? '#ff0000' : 'var(--border-strong)'}`,
                            width: '100%',
                            outline: 'none',
                          }}
                        />
                      </div>

                      {isBeforeAdhanTime && (
                        <div
                          style={{
                            color: '#ff0000',
                            fontSize: '0.82rem',
                            fontWeight: '700',
                            marginBottom: '16px',
                            textAlign: 'center',
                          }}
                        >
                          {settings?.language === 'en' ? `Cannot select a time before adhan (${toWesternDigits(adhanT)})` : `غير مسموح باختيار وقت قبل أذان الصلاة (وقت الأذان هو ${toWesternDigits(adhanT)})`}
                        </div>
                      )}

                      {isFutureTime && (
                        <div
                          style={{
                            color: '#ff0000',
                            fontSize: '0.82rem',
                            fontWeight: '700',
                            marginBottom: '16px',
                            textAlign: 'center',
                          }}
                        >
                          {settings?.language === 'en' ? `Cannot select a time in the future (Current time: ${toWesternDigits(currentHHMM)})` : `غير مسموح باختيار وقت في المستقبل (الوقت الحالي هو ${toWesternDigits(currentHHMM)})`}
                        </div>
                      )}

                      <button
                        className="btn-primary"
                        disabled={isInvalidTime}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          justifyContent: 'center',
                          fontSize: '0.92rem',
                          fontWeight: '800',
                          backgroundColor: isInvalidTime ? 'rgba(255, 255, 255, 0.1)' : 'var(--accent-blue)',
                          cursor: isInvalidTime ? 'not-allowed' : 'pointer',
                          opacity: isInvalidTime ? 0.6 : 1,
                        }}
                        onClick={() => {
                          if (isInvalidTime) return;
                          const delay = calculateDelay(adhanT, inputTime);
                          const grace = settings.gracePeriodMinutes ?? 15;
                          const status = delay <= grace ? 'on_time' : 'late';
                          handleMarkPerformed(activeModalPrayer, inputTime, status);
                          setActiveModalPrayer(null);
                          setCustomPerformedTime('');
                        }}
                      >
                        <CheckCircle size={18} />
                        <span>{settings?.language === 'en' ? 'Save Performed Time' : 'تسجيل الوقت المعتمد للأداء'}</span>
                      </button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}




      {/* Friday Sa'at al-Ijabah Hadith Modal */}
      {showFridayHadithModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3600,
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.25s ease-out',
          }}
          onClick={() => setShowFridayHadithModal(false)}
          id="modal-friday-hadith"
        >
          <div
            className="bento-card"
            style={{
              maxWidth: '680px',
              width: '100%',
              padding: '36px 30px',
              backgroundColor: 'rgba(18, 18, 24, 0.96)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 30px 70px rgba(0, 0, 0, 0.9)',
              textAlign: 'center',
              position: 'relative',
              animation: 'slideUp 0.25s ease-out',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowFridayHadithModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                [settings?.language === 'en' ? 'right' : 'left']: '18px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title={settings?.language === 'en' ? 'Close' : 'إغلاق'}
            >
              <X size={18} />
            </button>

            {/* Header Badge */}
            <div style={{ marginBottom: '22px', display: 'flex', justifyContent: 'center' }}>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  color: '#000',
                  backgroundColor: '#ffffff',
                  padding: '5px 20px',
                  borderRadius: 'var(--radius-pill)',
                  letterSpacing: '0.03em',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                }}
              >
                {settings?.language === 'en' ? 'Virtue of the Hour of Response on Friday' : 'فضـل ساعـة الإجابـة يـوم الجمعـة'}
              </span>
            </div>

            {/* Hadiths Content Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', textAlign: settings?.language === 'en' ? 'left' : 'right' }}>
              {/* Hadith 1: Abu Hurairah */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '22px 24px',
                  borderRadius: '18px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{settings?.language === 'en' ? 'Hadith of Abu Hurairah (may Allah be pleased with him):' : 'حديث أبي هريرة رضي الله عنه:'}</span>
                </div>
                <p className="religious-text" style={{ margin: 0, fontSize: '1.45rem', color: '#ffffff', lineHeight: 1.7, textAlign: 'justify', direction: 'rtl' }}>
                  عن النبي صلى الله عليه وسلم قال: «يومُ الجمعةِ اثنتا عشرةَ ساعةً، لا يوجد فيها عبدٌ مسلمٌ يسألُ اللهَ عزَّ وجلَّ شيئًا إلا آتاه إياه، فالتمِسوها آخرَ ساعةٍ بعد صلاةِ العصرِ»
                </p>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: settings?.language === 'en' ? 'flex-start' : 'flex-end', gap: '6px', fontWeight: '600' }}>
                  <BookOpen size={14} style={{ color: 'var(--status-on-time)' }} />
                  <span>{settings?.language === 'en' ? 'Narrated by Abu Dawood and An-Nasa\'i • Authenticated by Al-Albani' : 'رواه أبو داود والنسائي • صححه الألباني'}</span>
                </div>
              </div>

              {/* Hadith 2: Jabir ibn Abdillah */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '22px 24px',
                  borderRadius: '18px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{settings?.language === 'en' ? 'Hadith of Jabir ibn Abdillah (may Allah be pleased with both):' : 'حديث جابر بن عبد الله رضي الله عنهما:'}</span>
                </div>
                <p className="religious-text" style={{ margin: 0, fontSize: '1.45rem', color: '#ffffff', lineHeight: 1.7, textAlign: 'justify', direction: 'rtl' }}>
                  عن النبي صلى الله عليه وسلم قال: «يومُ الجمعةِ اثنتا عشرةَ ساعةً، فيها ساعةٌ لا يوجد مسلمٌ يسألُ اللهَ عزَّ وجلَّ فيها شيئًا إلا أعطاهُ، فالتمسوها آخرَ ساعةٍ بعد العصرِ»
                </p>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: settings?.language === 'en' ? 'flex-start' : 'flex-end', gap: '6px', fontWeight: '600' }}>
                  <BookOpen size={14} style={{ color: 'var(--status-on-time)' }} />
                  <span>{settings?.language === 'en' ? 'Narrated by Abu Dawood and An-Nasa\'i • Authenticated by Al-Hakim' : 'رواه أبو داود والنسائي • صححه الحاكم'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





