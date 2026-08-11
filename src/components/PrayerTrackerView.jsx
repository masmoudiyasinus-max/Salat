import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Sun,
  Sunrise,
  Moon,
  CloudSun,
  Lock,
  X,
  Sparkles,
  HeartHandshake,
  Check,
  Hourglass,
  MapPin,
  Volume2,
  VolumeX,
  Flame, AlertTriangle } from 'lucide-react';
import {
  PRAYER_NAMES,
  NAFL_PRAYERS,
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
  computeSummaryStats,
} from '../services/storage';
import { fetchPrayerTimesFromTavily } from '../services/tavilyApi';
import { getWeatherCommentary, getCurrentTimeSlot } from '../services/bgImageService';

const getTodayStr = (timezone) => {
  const d = getCityNowDate(timezone);
  const validD = isNaN(d.getTime()) ? new Date() : d;
  const year = validD.getFullYear();
  const month = String(validD.getMonth() + 1).padStart(2, '0');
  const day = String(validD.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const PRAYER_ICONS = {
  Fajr: Sunrise,
  Sunrise: Sun,
  Dhuhr: CloudSun,
  Asr: Sun,
  Maghrib: Moon,
  Isha: Moon,
};

export default function PrayerTrackerView({ settings, onRecordUpdated, onRejectBgImage, isAudioMuted, onToggleAudio }) {
  const [prayerTimes, setPrayerTimes] = useState(getPrayerTimesCache);
  const [records, setRecords] = useState(getRecords);
  const [naflRecords, setNaflRecords] = useState(getNaflRecords);
  const [isFetchingTavily, setIsFetchingTavily] = useState(false);
  const getFormattedCurrentTime = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return toWesternDigits(`${hh}:${mm}`);
  };

  const [tavilyStatusText, setTavilyStatusText] = useState(() => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `آخر تحديث: ${toWesternDigits(`${hh}:${mm}`)}`;
  });

  // Modal Sub-window State for Obligatory Prayers
  const [activeModalPrayer, setActiveModalPrayer] = useState(null);
  const [customPerformedTime, setCustomPerformedTime] = useState('');
  const [dismissedPrepPrayers, setDismissedPrepPrayers] = useState({});

  const [showFridayHadithModal, setShowFridayHadithModal] = useState(false);
  const [testTimeMins, setTestTimeMins] = useState(null);

  const [nowTime, setNowTime] = useState(() => {
    const d = getCityNowDate(prayerTimes?.timezone);
    return isNaN(d.getTime()) ? new Date() : d;
  });
  const safeNow = nowTime && !isNaN(nowTime.getTime()) ? nowTime : new Date();
  const year = safeNow.getFullYear();
  const month = String(safeNow.getMonth() + 1).padStart(2, '0');
  const day = String(safeNow.getDate()).padStart(2, '0');
  const selectedDate = `${year}-${month}-${day}`;

  useEffect(() => {
    const updateClock = () => {
      const cityNow = getCityNowDate(prayerTimes?.timezone);
      setNowTime(isNaN(cityNow.getTime()) ? new Date() : cityNow);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [prayerTimes?.timezone]);

  useEffect(() => {
    setRecords(getRecords());
    setNaflRecords(getNaflRecords());
  }, [selectedDate]);

  // Helper to get exact target date string for fetching prayer times (consistently across auto & manual sync)
  const getFetchTargetDateStr = () => {
    return selectedDate;
  };

  // 2. Automatic Tavily fetch ONCE PER DAY in the background & store/cache in localStorage
  useEffect(() => {
    let isMounted = true;
    async function autoFetchPrayerTimes() {
      const targetDateStr = selectedDate;
      const cached = getPrayerTimesCache();

      // If prayer times for target date are already synced & saved in localStorage today, skip API call!
      if (cached && cached.lastSyncedDate === targetDateStr && cached.Fajr) {
        if (isMounted) {
          setTavilyStatusText(`مُزامن ومحفوظ لليوم (${cached.lastSyncedTime || getFormattedCurrentTime()})`);
        }
        return;
      }

      if (!settings.tavilyApiKey || settings.tavilyApiKey.trim() === '') {
        setTavilyStatusText('المزامنة الحية غير ممكنة (يلزم توفير مفتاح Tavily API)');
        setIsFetchingTavily(false);
        return;
      }

      try {
        setIsFetchingTavily(true);
        setTavilyStatusText('جاري المزامنة التلقائية اليومية...');

        const res = await fetchPrayerTimesFromTavily(
          settings.tavilyApiKey,
          settings.prayerSourceUrl,
          settings.city,
          settings.country,
          targetDateStr,
          settings.geminiApiKey
        );

        if (isMounted) {
          if (res && res.success && res.times) {
            const timeNow = getFormattedCurrentTime();
            const mergedTimes = {
              ...res.times,
              timezone: res.timezone || prayerTimes?.timezone || '',
              lastSyncedDate: targetDateStr,
              lastSyncedTime: timeNow,
            };
            setPrayerTimes(mergedTimes);
            savePrayerTimesCache(mergedTimes);
            setTavilyStatusText(`تمت المزامنة اليومية وتخزين البيانات: ${timeNow}`);
          } else {
            setTavilyStatusText(`آخر مزامنة محفوظة: ${cached?.lastSyncedTime || getFormattedCurrentTime()}`);
          }
        }
      } catch (err) {
        console.error('Auto fetch caught error:', err);
      } finally {
        if (isMounted) {
          setIsFetchingTavily(false);
        }
      }
    }

    autoFetchPrayerTimes();
    return () => {
      isMounted = false;
    };
  }, [settings.tavilyApiKey, settings.geminiApiKey, settings.prayerSourceUrl, settings.city, settings.country, selectedDate]);

  const handleManualRefreshPrayerTimes = async () => {
    if (!settings.tavilyApiKey || settings.tavilyApiKey.trim() === '') {
      setTavilyStatusText('المزامنة غير ممكنة: يلزم توفير مفتاح Tavily API في الإعدادات');
      setIsFetchingTavily(false);
      return;
    }

    try {
      setIsFetchingTavily(true);
      setTavilyStatusText('جاري التحديث والمزامنة...');

      const targetDateStr = selectedDate;

      const res = await fetchPrayerTimesFromTavily(
        settings.tavilyApiKey,
        settings.prayerSourceUrl,
        settings.city,
        settings.country,
        targetDateStr,
        settings.geminiApiKey
      );
      if (res && res.success && res.times) {
        const timeNow = getFormattedCurrentTime();
        const mergedTimes = {
          ...res.times,
          timezone: res.timezone || prayerTimes?.timezone || '',
          lastSyncedDate: targetDateStr,
          lastSyncedTime: timeNow,
        };
        setPrayerTimes(mergedTimes);
        savePrayerTimesCache(mergedTimes);

        setTavilyStatusText(`تمت المزامنة وتخزين المواقيت: ${timeNow}`);
      } else {
        setTavilyStatusText(`تعذر التحديث المباشر (${getFormattedCurrentTime()})`);
      }
    } catch (err) {
      console.error('Manual refresh caught error:', err);
      setTavilyStatusText(`تعذر التحديث المباشر (${getFormattedCurrentTime()})`);
    } finally {
      setIsFetchingTavily(false);
    }
  };

  const safeRecords = Array.isArray(records) ? records : [];
  const safeNaflRecords = Array.isArray(naflRecords) ? naflRecords : [];

  const dateRecords = safeRecords.filter((r) => r && r.date === selectedDate);
  const dateNaflRecords = safeNaflRecords.filter((r) => r && r.date === selectedDate);

  // Night Calculation (Maghrib to Fajr)
  const nightTimes = calculateNightTimes(
    prayerTimes?.Maghrib || '19:30',
    prayerTimes?.Fajr || '04:15'
  );

  // Live Countup and Countdown Timers Computation for All Islamic Timeline Events (Continuous Rolling Timeline)
  const computeTimers = () => {
    const parseEventDateTime = (timeStr, dayOffset = 0) => {
      const d = new Date(safeNow.getTime());
      d.setDate(d.getDate() + dayOffset);
      const [h, m] = (timeStr || '12:00').split(':').map(Number);
      d.setHours(h, m, 0, 0);
      return d;
    };

    const buildDailyEvents = (dayOffset) => {
      const pTimes = prayerTimes || {};
      const fajrT = pTimes.Fajr || '04:15';
      const sunriseT = pTimes.Sunrise || '05:45';
      const dhuhrT = pTimes.Dhuhr || '12:30';
      const asrT = pTimes.Asr || '16:00';
      const maghribT = pTimes.Maghrib || '19:30';
      const ishaT = pTimes.Isha || '20:44';

      const nTimes = calculateNightTimes(maghribT, fajrT);
      const midT = nTimes.midnight || '00:08';
      const lastThirdT = nTimes.lastThird || '01:25';

      const [sH, sM] = sunriseT.split(':').map(Number);
      const duhaTotalM = sH * 60 + sM + 15;
      const duhaH = Math.floor(duhaTotalM / 60) % 24;
      const duhaM = duhaTotalM % 60;
      const duhaT = `${String(duhaH).padStart(2, '0')}:${String(duhaM).padStart(2, '0')}`;

      // Midnight and Last Third date objects calculated relative to Maghrib timestamp
      const maghribDateObj = parseEventDateTime(maghribT, dayOffset);
      const halfNightMs = Math.floor((nTimes.nightDurationMinutes * 60 * 1000) / 2);
      const twoThirdsMs = Math.floor((nTimes.nightDurationMinutes * 60 * 1000 * 2) / 3);

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
        { id: 'LastThird', nameAr: 'الثلث الأخير (قيام الليل)', labelCountup: 'مضى على الثلث الأخير (قيام الليل)', labelCountdown: 'المتبقي للثلث الأخير (قيام الليل)', dateObj: lastThirdDateObj },
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
      nextEventId: nextEvent.id,
      nextEventName: nextEvent.nameAr,
      nextPrayerId: nextEvent.id.replace('_Next', ''),
      nextLabelCountdown: nextEvent.labelCountdown || `المتبقي لـ ${nextEvent.nameAr}`,
      countupStr: toWesternDigits(countupStr),
      countdownStr: toWesternDigits(countdownStr),
      elapsedSecs,
      remainingSecs,
      remM,
      remS,
      isAfterGracePeriod: elapsedSecs > (settings.gracePeriodMinutes ?? 15) * 60,
      isPast30Minutes: elapsedSecs > 30 * 60,
    };
  };

  const timerInfo = computeTimers();

  // 10-Minute Prayer Preparation Modal Condition (Restricted strictly to the 5 obligatory prayers)
  const isObligatoryNext = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].includes(timerInfo.nextPrayerId);
  const isWithin10Mins = isObligatoryNext && timerInfo.remainingSecs > 0 && timerInfo.remainingSecs <= 600;
  const prayerPrepKey = `${selectedDate}_${timerInfo.nextPrayerId}`;
  const showPrepModal = isWithin10Mins && !dismissedPrepPrayers[prayerPrepKey];

  // Real-Time Progress Fill Percentage for the Connecting Line (Fajr to Isha)
  
  const getProhibition = (currentMins, prayerTimes, dateRecords) => {
    if (!prayerTimes) return null;
    const [sH, sM] = (prayerTimes.Sunrise || '06:00').split(':').map(Number);
    const sunrise = sH * 60 + sM;
    const [dH, dM] = (prayerTimes.Dhuhr || '12:00').split(':').map(Number);
    const dhuhr = dH * 60 + dM;
    const [mH, mM] = (prayerTimes.Maghrib || '18:00').split(':').map(Number);
    const maghrib = mH * 60 + mM;

    if (currentMins >= sunrise && currentMins < sunrise + 15) {
      return { desc: 'عن عقبة بن عامر رضي الله عنه قال: «ثَلَاثُ سَاعَاتٍ كَانَ رَسُولُ اللهِ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ يَنْهَانَا أَنْ نُصَلِّيَ فِيهِنَّ، أَوْ أَنْ نَقْبُرَ فِيهِنَّ مَوْتَانَا: حِينَ تَطْلُعُ الشَّمْسُ بَازِغَةً حَتَّى تَرْتَفِعَ، وَحِينَ يَقُومُ قَائِمُ الظَّهِيرَةِ حَتَّى تَمِيلَ الشَّمْسُ، وَحِينَ تَضَيَّفُ الشَّمْسُ لِلْغُرُوبِ حَتَّى تَغْرُبَ»' };
    }
    if (currentMins >= dhuhr - 15 && currentMins < dhuhr) {
      return { desc: 'عن عقبة بن عامر رضي الله عنه قال: «ثَلَاثُ سَاعَاتٍ كَانَ رَسُولُ اللهِ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ يَنْهَانَا أَنْ نُصَلِّيَ فِيهِنَّ، أَوْ أَنْ نَقْبُرَ فِيهِنَّ مَوْتَانَا: حِينَ تَطْلُعُ الشَّمْسُ بَازِغَةً حَتَّى تَرْتَفِعَ، وَحِينَ يَقُومُ قَائِمُ الظَّهِيرَةِ حَتَّى تَمِيلَ الشَّمْسُ، وَحِينَ تَضَيَّفُ الشَّمْسُ لِلْغُرُوبِ حَتَّى تَغْرُبَ»' };
    }
    if (currentMins >= maghrib - 15 && currentMins < maghrib) {
      return { desc: 'عن عقبة بن عامر رضي الله عنه قال: «ثَلَاثُ سَاعَاتٍ كَانَ رَسُولُ اللهِ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ يَنْهَانَا أَنْ نُصَلِّيَ فِيهِنَّ، أَوْ أَنْ نَقْبُرَ فِيهِنَّ مَوْتَانَا: حِينَ تَطْلُعُ الشَّمْسُ بَازِغَةً حَتَّى تَرْتَفِعَ، وَحِينَ يَقُومُ قَائِمُ الظَّهِيرَةِ حَتَّى تَمِيلَ الشَّمْسُ، وَحِينَ تَضَيَّفُ الشَّمْسُ لِلْغُرُوبِ حَتَّى تَغْرُبَ»' };
    }

    const isTesting = testTimeMins !== null;
    const [fH, fM] = (prayerTimes.Fajr || '04:15').split(':').map(Number);
    const fajr = fH * 60 + fM;
    const fajrRec = (dateRecords || []).find(r => r.prayer_name === 'Fajr');
    const fajrPerformed = isTesting || (fajrRec && (fajrRec.status === 'on_time' || fajrRec.status === 'late' || fajrRec.status === 'qada'));
    if (fajrPerformed && currentMins > fajr && currentMins < sunrise) {
      return { desc: 'عن أبي سعيد الخدري رضي الله عنه قال: سمعت رسول الله صلى الله عليه وسلم يقول: «لا صَلاةَ بَعْدَ الصُّبْحِ حَتَّى تَرْتَفِعَ الشَّمْسُ، وَلا صَلاةَ بَعْدَ العَصْرِ حَتَّى تَغِيبَ الشَّمْسُ»' };
    }

    const [aH, aM] = (prayerTimes.Asr || '15:30').split(':').map(Number);
    const asr = aH * 60 + aM;
    const asrRec = (dateRecords || []).find(r => r.prayer_name === 'Asr');
    const asrPerformed = isTesting || (asrRec && (asrRec.status === 'on_time' || asrRec.status === 'late' || asrRec.status === 'qada'));
    if (asrPerformed && currentMins > asr && currentMins < maghrib - 15) {
      return { desc: 'عن أبي سعيد الخدري رضي الله عنه قال: سمعت رسول الله صلى الله عليه وسلم يقول: «لا صَلاةَ بَعْدَ الصُّبْحِ حَتَّى تَرْتَفِعَ الشَّمْسُ، وَلا صَلاةَ بَعْدَ العَصْرِ حَتَّى تَغِيبَ الشَّمْسُ»' };
    }

    return null;
  };

  const safeNowForProhibition = new Date();
  const globalCurrentMins = testTimeMins !== null ? testTimeMins : safeNowForProhibition.getHours() * 60 + safeNowForProhibition.getMinutes();
  const currentProhibition = getProhibition(globalCurrentMins, prayerTimes, dateRecords);

  const computeLineProgressPct = () => {
    if (!prayerTimes?.Fajr || !prayerTimes?.Isha) return 0;

    const [fH, fM] = (prayerTimes.Fajr || '04:15').split(':').map(Number);
    const [iH, iM] = (prayerTimes.Isha || '20:44').split(':').map(Number);

    const fajrMins = fH * 60 + fM;
    const ishaMins = iH * 60 + iM;

    const currentMins = safeNow.getHours() * 60 + safeNow.getMinutes();

    if (currentMins <= fajrMins) return 0;
    if (currentMins >= ishaMins) return 100;

    const totalRange = ishaMins - fajrMins;
    const elapsed = currentMins - fajrMins;

    const pct = Math.min(100, Math.max(0, (elapsed / totalRange) * 100));
    return Math.round(pct * 10) / 10;
  };

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
    const maghribT = prayerTimes?.Maghrib || '19:30';
    const fajrT = prayerTimes?.Fajr || '04:15';
    const nTimes = calculateNightTimes(maghribT, fajrT);

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
    if (selectedDate < getTodayStr(prayerTimes?.timezone)) return true; // Past dates are ALWAYS unlocked!

    const [aH, aM] = adhanTimeStr.split(':').map(Number);
    const adhanMins = aH * 60 + aM;

    const currentH = nowTime.getHours();
    const currentM = nowTime.getMinutes();
    const currentMins = currentH * 60 + currentM;

    const [fH, fM] = (prayerTimes?.Fajr || '04:15').split(':').map(Number);
    const fajrMins = fH * 60 + fM;

    // Post-midnight / early morning before Fajr (00:00 to Fajr): All past day prayers & Isha are 100% unlocked!
    if (currentMins < fajrMins) {
      return true;
    }

    return currentMins >= adhanMins;
  };

  // Check if next prayer adhan time (or Sunrise for Fajr, or Shariah Midnight for Isha) has arrived
  const isNextPrayerTimeArrived = (prayerId) => {
    const validObligatory = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    if (!validObligatory.includes(prayerId)) return false;

    if (prayerId === 'Fajr') {
      const sunriseTime = prayerTimes?.Sunrise || '05:45';
      return isPrayerTimeArrived(sunriseTime);
    }

    if (prayerId === 'Isha') {
      return isMidnightArrived();
    }

    const nextPrayerMap = {
      Fajr: 'Dhuhr',
      Dhuhr: 'Asr',
      Asr: 'Maghrib',
      Maghrib: 'Isha',
      Isha: 'Fajr',
    };
    const nextId = nextPrayerMap[prayerId];
    if (!nextId) return false;
    return isPrayerTimeArrived(prayerTimes[nextId], nextId);
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

    // 3. IF PRAYER WINDOW IS STILL ACTIVE TODAY (!nextArrived):
    if (isToday && !nextArrived) {
      const [aH, aM] = (adhanTimeStr || '12:00').split(':').map(Number);
      const adhanMins = aH * 60 + aM;
      const currentMins = nowTime.getHours() * 60 + nowTime.getMinutes();

      let diff = currentMins - adhanMins;
      if (diff < 0) diff += 1440;

      const grace = settings.gracePeriodMinutes ?? 15;
      if (diff <= grace) {
        return 'on_time';
      }

      return 'late';
    }

    // 4. Next prayer / Shariah Midnight HAS arrived -> missed (متروكة)!
    return 'missed';
  };

  // Automatic Real-Time Persistence Evaluator & Stale Cleanup for TRULY Missed Prayers
  useEffect(() => {
    if (!prayerTimes) return;
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
      const timeStr = prayerTimes[p.id];
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
      const raw = localStorage.getItem('prayer_re_toggle_history');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  };

  const saveToggleHistory = (historyObj) => {
    try {
      localStorage.setItem('prayer_re_toggle_history', JSON.stringify(historyObj));
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
    const rec = dateRecords.find((r) => r.prayer_name === prayerId);
    const status = getAutoEvaluatedStatus(prayerId, prayerTimes[prayerId] || '12:00');
    return (rec && rec.status === 'missed') || status === 'missed';
  };

  const handleMarkPerformed = (prayerId, timeOverride = '', customStatus = null) => {
    const adhanTime = prayerTimes[prayerId] || '12:00';
    if (!isPrayerTimeArrived(adhanTime)) return;

    if (isMissedAndLocked(prayerId)) {
      alert('هذه الصلاة سُجّلت كمتروكة ولا يمكن تعديل بياناتها وفقاً لقواعد الالتزام الصارمة.');
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
    const adhanTime = prayerTimes[prayerId] || '12:00';
    if (!isPrayerTimeArrived(adhanTime)) return;

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
    const adhanTime = prayerTimes[prayerId] || '12:00';
    if (!isPrayerTimeArrived(adhanTime)) return;

    if (isMissedAndLocked(prayerId) && newStatus !== 'missed') {
      alert('هذه الصلاة سُجّلت كمتروكة ولا يمكن تحويلها إلى (تم) وفقاً لقواعد الالتزام الصارمة.');
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

    const getNaflTimeMins = (nId) => {
      if (!prayerTimes) return 0;
      const parseMins = (tStr) => {
        const [h, m] = (tStr || '12:00').split(':').map(Number);
        return h * 60 + m;
      };
      const fajr = parseMins(prayerTimes.Fajr || '04:15');
      const sunrise = parseMins(prayerTimes.Sunrise || '05:45');
      const dhuhr = parseMins(prayerTimes.Dhuhr || '12:30');
      const maghrib = parseMins(prayerTimes.Maghrib || '19:30');
      const isha = parseMins(prayerTimes.Isha || '20:44');
      const lastThird = parseMins(nightTimes.lastThird || '01:25');

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
    const fajrMins = ((prayerTimes?.Fajr || '04:15').split(':').map(Number)[0]) * 60 + ((prayerTimes?.Fajr || '04:15').split(':').map(Number)[1]);

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
      alert('انقضى وقت هذه السنة والنوافل وتعتبر متروكة ولا يمكن تسجيلها بعد انقضاء وقتها وفقاً لقواعد الالتزام.');
      return;
    }

    const updated = toggleNaflRecord(selectedDate, naflId);
    setNaflRecords([...updated]);
  };

  // Hero Date Formatting with Western Digits (1 2 3 4 5)
  const liveClockTime = toWesternDigits(
    nowTime.toLocaleTimeString('ar-EG-u-nu-latn', {
      hour: '2-digit',
      minute: '2-digit',
    })
  );

  const gregorianDateFormatted = toWesternDigits(
    nowTime.toLocaleDateString('ar-EG-u-nu-latn', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  );

  const hijriDateFormatted = toWesternDigits(
    nowTime.toLocaleDateString('ar-SA-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  );

  const modalPrayerInfo = activeModalPrayer
    ? PRAYER_NAMES.find((p) => p.id === activeModalPrayer)
    : null;
  const modalRec = activeModalPrayer
    ? dateRecords.find((r) => r.prayer_name === activeModalPrayer)
    : null;
  const modalAdhan = activeModalPrayer
    ? toWesternDigits(prayerTimes[activeModalPrayer] || '12:00')
    : '12:00';
  const modalHasArrived = activeModalPrayer
    ? isPrayerTimeArrived(prayerTimes[activeModalPrayer] || '12:00')
    : false;
  const ModalIconComp = activeModalPrayer ? PRAYER_ICONS[activeModalPrayer] || Clock : Clock;

  const oblList = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const activeObligatoryId = oblList.includes(timerInfo.currentPrayerId)
    ? timerInfo.currentPrayerId
    : 'Fajr';
  const activePrayerObj = PRAYER_NAMES.find((p) => p.id === activeObligatoryId) || PRAYER_NAMES[0];
  const activeAdhanStr = (prayerTimes && prayerTimes[activeObligatoryId]) || '12:00';
  const activeRec = (dateRecords || []).find((r) => r.prayer_name === activeObligatoryId);
  const activeStatus = activeRec?.status || getAutoEvaluatedStatus(activeObligatoryId, activeAdhanStr);

  const currentOblIndex = oblList.indexOf(activeObligatoryId);
  const prevOblId = currentOblIndex > 0 ? oblList[currentOblIndex - 1] : 'Isha';
  const prevPrayerObj = PRAYER_NAMES.find((p) => p.id === prevOblId) || PRAYER_NAMES[4];
  const prevRec = (dateRecords || []).find((r) => r.prayer_name === prevOblId);
  const prevAdhanStr = (prayerTimes && prayerTimes[prevOblId]) || '12:00';
  const prevStatus = prevRec?.status || (selectedDate < getTodayStr(prayerTimes?.timezone) ? 'missed' : getAutoEvaluatedStatus(prevOblId, prevAdhanStr));

  const nextOblId = currentOblIndex < oblList.length - 1 ? oblList[currentOblIndex + 1] : 'Fajr';
  const nextPrayerObj = PRAYER_NAMES.find((p) => p.id === nextOblId) || PRAYER_NAMES[0];
  const nextAdhanStr = (prayerTimes && prayerTimes[nextOblId]) || '16:00';

  const isActiveCompleted = Boolean(activeRec && (activeStatus === 'on_time' || activeStatus === 'late' || activeStatus === 'qada'));

  const ActiveIconComp = PRAYER_ICONS[activeObligatoryId] || Clock;

  let prevStatusLabel = 'لم تُؤدَّ بعد';
  let prevStatusColor = 'var(--text-muted)';
  if (prevStatus === 'on_time') {
    prevStatusLabel = 'أُدِّيت في الوقت ✓';
    prevStatusColor = '#00ff00';
  } else if (prevStatus === 'late') {
    prevStatusLabel = 'أُدِّيت متأخرة';
    prevStatusColor = '#f59e0b';
  } else if (prevStatus === 'qada') {
    prevStatusLabel = 'قضاء';
    prevStatusColor = '#f59e0b';
  } else if (prevStatus === 'missed') {
    prevStatusLabel = 'متروكة ✕';
    prevStatusColor = '#ff0000';
  }

  return (
    <div className="prayer-tracker-view">
      {/* Hero Reception Header Banner */}
      <div
        className="bento-card"
        style={{
          marginBottom: '20px',
          padding: '28px 32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '24px',
          }}
        >
          {/* Right Group: Large Clock & Date Stack */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {/* Massive Live Clock */}
            <div
              style={{
                fontSize: 'clamp(2.5rem, 4.5vw, 4rem)',
                fontWeight: '800',
                color: 'var(--text-primary)',
                lineHeight: '1',
                letterSpacing: '-0.02em',
              }}
            >
              {liveClockTime}
            </div>

            {/* Vertical Hairline Divider */}
            <div
              style={{
                width: '1.5px',
                height: '48px',
                backgroundColor: 'var(--border-subtle)',
              }}
            />

            {/* Dates: Gregorian & Hijri */}
            <div>
              <div
                style={{
                  fontSize: 'clamp(1.05rem, 2vw, 1.35rem)',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  marginBottom: '2px',
                }}
              >
                {gregorianDateFormatted}
              </div>
              <div
                style={{
                  fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>{hijriDateFormatted} هـ</span>
                <span>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--status-on-time)' }}>
                  <MapPin size={13} />
                  <span>
                    {(settings.city || settings.country)
                      ? `${settings.city || ''}${settings.city && settings.country ? '، ' : ''}${settings.country || ''}`
                      : 'الموقع غير محدد (اضبط الإعدادات)'}
                  </span>
                </span>
              </div>

            </div>
          </div>
        </div>

        {/* Sunrise & Live Sync Status Bar */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Left: Longest Streak Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={16} style={{ color: '#f97316' }} />
            <span>أطول سلسلة كاملة (Streak):</span>
            <strong style={{ color: '#f97316' }}>
              {computeSummaryStats(getRecords()).maxStreak} يوم
            </strong>
          </div>

          {/* Right: Last Updated Timestamp Badge ADJACENT to Sync Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: 'var(--accent-blue)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.78rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Clock size={13} style={{ color: 'var(--accent-blue)' }} />
              <span>{tavilyStatusText}</span>
            </div>

            <button
              className="btn-pill btn-sync-hover"
              onClick={handleManualRefreshPrayerTimes}
              disabled={isFetchingTavily}
              style={{
                padding: '8px 20px',
                fontSize: '0.82rem',
                fontWeight: '600',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '9999px',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isFetchingTavily ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              title="إعادة جلب ومزامنة مواقيت الصلاة الحقيقية فوراً عبر الذكاء الاصطناعي والويب"
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RefreshCw size={13} className={isFetchingTavily ? 'spin' : ''} style={{ color: 'var(--accent-blue)' }} />
              </div>
              <span>{isFetchingTavily ? 'جاري المزامنة والتصحيح...' : 'مزامنة وتحديث المواقيت'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Active Prayer Frame with Integrated Live Timer Box (إطار عرض الصلاة الحالية) */}
      <div
        className="bento-card active-prayer-hero-card"
        style={{
          marginBottom: '24px',
          padding: '28px 32px',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1.5px solid rgba(255, 255, 255, 0.22)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'none',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Top Row: Active Prayer Main Info + Embedded Live Timer Frame + Previous Prayer Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            
            {/* 1. Active Prayer Main Badge (Icon, Name, Adhan Time) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: isActiveCompleted
                    ? 'rgba(255, 255, 255, 0.15)'
                    : activeStatus === 'on_time'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : activeStatus === 'missed'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
                  border: `1.5px solid ${
                    isActiveCompleted
                      ? '#ffffff'
                      : activeStatus === 'on_time'
                      ? '#00ff00'
                      : activeStatus === 'missed'
                      ? '#ff0000'
                      : 'var(--accent-blue)'
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'none',
                }}
              >
                <ActiveIconComp
                  size={32}
                  style={{
                    color: isActiveCompleted
                      ? '#ffffff'
                      : activeStatus === 'on_time'
                      ? '#00ff00'
                      : activeStatus === 'missed'
                      ? '#ff0000'
                      : 'var(--accent-blue)',
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: isActiveCompleted ? '#ffffff' : 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{isActiveCompleted ? 'الصلاة الحالية (أُدِّيت ✓)' : 'الصلاة الحالية الآن'}</span>
                  <span style={{ fontSize: '0.78rem', padding: '2px 10px', borderRadius: 'var(--radius-pill)', backgroundColor: 'rgba(255, 255, 255, 0.08)', color: isActiveCompleted ? '#ffffff' : 'var(--text-muted)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                    أذان {toWesternDigits(activeAdhanStr)}
                  </span>
                </div>

                <h2 style={{ fontSize: 'clamp(1.8rem, 3.2vw, 2.5rem)', fontWeight: '900', color: isActiveCompleted ? '#ffffff' : 'var(--text-primary)', margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                  صلاة {activePrayerObj.nameAr}
                </h2>

                {/* Line 2 (Directly Underneath Prayer Name): Live Unboxed Bare Timers Display */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    marginTop: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {(() => {
                    const showSecondaryLine = (timerInfo.elapsedSecs <= 30 * 60) || (timerInfo.remainingSecs <= 30 * 60);

                    if (timerInfo.elapsedSecs <= 30 * 60) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={15} style={{ color: isActiveCompleted ? '#ffffff' : 'var(--status-on-time)' }} />
                            <span style={{ fontSize: '0.86rem', color: isActiveCompleted ? '#ffffff' : 'var(--text-secondary)', fontWeight: '600' }}>
                              {timerInfo.currentLabelCountup}:
                            </span>
                            <strong style={{ fontSize: '1.1rem', fontWeight: '800', color: isActiveCompleted ? '#ffffff' : 'var(--text-primary)' }}>
                              {timerInfo.countupStr}
                            </strong>
                          </div>

                          {showSecondaryLine && (
                            <>
                              <span style={{ color: isActiveCompleted ? '#ffffff' : 'var(--text-muted)', opacity: 0.5 }}>•</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.85 }}>
                                <Hourglass size={14} style={{ color: isActiveCompleted ? '#ffffff' : 'var(--text-muted)' }} />
                                <span style={{ fontSize: '0.82rem', color: isActiveCompleted ? '#ffffff' : 'var(--text-muted)', fontWeight: '600' }}>
                                  {timerInfo.nextLabelCountdown}:
                                </span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: isActiveCompleted ? '#ffffff' : 'var(--text-muted)' }}>
                                  {timerInfo.countdownStr}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Hourglass size={15} style={{ color: isActiveCompleted ? '#ffffff' : timerInfo.remainingSecs <= 15 * 60 ? 'var(--status-on-time)' : 'var(--status-late)' }} />
                          <span style={{ fontSize: '0.86rem', color: isActiveCompleted ? '#ffffff' : 'var(--text-secondary)', fontWeight: '600' }}>
                            {timerInfo.nextLabelCountdown}:
                          </span>
                          <strong style={{ fontSize: '1.1rem', fontWeight: '800', color: isActiveCompleted ? '#ffffff' : 'var(--text-primary)' }}>
                            {timerInfo.countdownStr}
                          </strong>
                        </div>

                        {showSecondaryLine && (
                          <>
                            <span style={{ color: isActiveCompleted ? '#ffffff' : 'var(--text-muted)', opacity: 0.5 }}>•</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.85 }}>
                              <Clock size={14} style={{ color: isActiveCompleted ? '#ffffff' : 'var(--text-muted)' }} />
                              <span style={{ fontSize: '0.82rem', color: isActiveCompleted ? '#ffffff' : 'var(--text-muted)', fontWeight: '600' }}>
                                {timerInfo.currentLabelCountup}:
                              </span>
                              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: isActiveCompleted ? '#ffffff' : 'var(--text-muted)' }}>
                                {timerInfo.countupStr}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* 3. Dynamic Side Badge: Previous Prayer Status (if active not done) vs Next Prayer Info (if active done) */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div style={{ textAlign: 'right' }}>
                {isActiveCompleted ? (
                  <>
                    <div style={{ fontSize: '0.78rem', color: '#ffffff', opacity: 0.8, fontWeight: '600', marginBottom: '2px' }}>
                      الصلاة القادمة ({nextPrayerObj?.nameAr}):
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>أذان {toWesternDigits(nextAdhanStr)}</span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>• المتبقي {timerInfo.countdownStr}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '2px' }}>
                      حالة الصلاة السابقة ({prevPrayerObj?.nameAr}):
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: '800', color: prevStatusColor, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{prevStatusLabel}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Dynamic Progress Bar Separator (Duration between current and next prayer) */}
          {(() => {
            const totalSecs = timerInfo.elapsedSecs + timerInfo.remainingSecs;
            const progressPct = totalSecs > 0 ? Math.min(100, Math.max(0, (timerInfo.elapsedSecs / totalSecs) * 100)) : 0;
            return (
              <div style={{ width: '100%', padding: '2px 0', margin: '-4px 0' }}>
                <div
                  style={{
                    width: '100%',
                    height: '2px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    borderRadius: '2px',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      height: '100%',
                      width: `${progressPct}%`,
                      backgroundColor: isActiveCompleted ? '#ffffff' : 'var(--accent-blue)',
                      boxShadow: 'none',
                      borderRadius: '2px',
                      transition: 'width 1s linear, background-color 0.3s ease',
                    }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Bottom Action Buttons Row (Single Smart Performance Button) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              حالة أداء صلاة {activePrayerObj.nameAr}:
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Single Unified Smart Performance Button */}
              {(() => {
                const isActiveNextArrived = isNextPrayerTimeArrived(activeObligatoryId);
                const isActiveMissedLocked = isMissedAndLocked(activeObligatoryId);
                const isWithin15MinsOfAdhan = timerInfo.elapsedSecs <= 15 * 60;

                const isDoneOnTime = activeRec && activeStatus === 'on_time';
                const isDoneLate = activeRec && (activeStatus === 'late' || activeStatus === 'qada');
                const isMissed = activeStatus === 'missed' || isActiveNextArrived || isActiveMissedLocked;

                const isFinalReToggleLocked = isReToggleLocked(activeObligatoryId);

                let btnBg = 'rgba(16, 185, 129, 0.22)';
                let btnBorder = '#00ff00';
                let btnColor = '#00ff00';
                let btnShadow = 'none';
                let BtnIcon = CheckCircle;
                let btnText = `تسجيل أداء صلاة ${activePrayerObj.nameAr} (في الوقت)`;

                if (isFinalReToggleLocked && (isDoneOnTime || isDoneLate)) {
                  btnBg = 'rgba(255, 255, 255, 0.15)';
                  btnBorder = '#ffffff';
                  btnColor = '#ffffff';
                  btnShadow = 'none';
                  BtnIcon = Lock;
                  btnText = `أُدِّيت (مقفلة نهائياً ضد التعديل) ✓`;
                } else if (isDoneOnTime) {
                  btnBg = 'rgba(16, 185, 129, 0.25)';
                  btnBorder = '#00ff00';
                  btnColor = '#00ff00';
                  btnShadow = 'none';
                  BtnIcon = CheckCircle;
                  btnText = `أُدِّيت في الوقت (انقر للإلغاء) ✓`;
                } else if (isDoneLate) {
                  btnBg = 'rgba(245, 158, 11, 0.25)';
                  btnBorder = '#f59e0b';
                  btnColor = '#f59e0b';
                  btnShadow = 'none';
                  BtnIcon = Clock;
                  btnText = `أُدِّيت متأخرة (انقر للإلغاء)`;
                } else if (isMissed) {
                  btnBg = 'rgba(239, 68, 68, 0.2)';
                  btnBorder = 'rgba(239, 68, 68, 0.5)';
                  btnColor = '#ff0000';
                  btnShadow = 'none';
                  BtnIcon = XCircle;
                  btnText = `صلاة ${activePrayerObj.nameAr} متروكة (مفوتة) ✕`;
                } else if (!isWithin15MinsOfAdhan) {
                  btnBg = 'rgba(245, 158, 11, 0.22)';
                  btnBorder = '#f59e0b';
                  btnColor = '#f59e0b';
                  btnShadow = 'none';
                  BtnIcon = Clock;
                  btnText = `تسجيل أداء صلاة ${activePrayerObj.nameAr} (متأخرة)`;
                }

                return (
                  <button
                    type="button"
                    className="btn-pill"
                    onClick={() => {
                      if (isMissed) {
                        alert(`صلاة ${activePrayerObj.nameAr} سُجّلت كمتروكة لعدم أدائها قبل أذان الصلاة التالية، ولا يمكن تحويلها إلى (تم).`);
                        return;
                      }
                      if (isFinalReToggleLocked) {
                        return;
                      }
                      // Toggle off if already performed
                      if (activeRec && (isDoneOnTime || isDoneLate)) {
                        const toggleKey = `${selectedDate}_${activeObligatoryId}`;
                        const history = getToggleHistory();
                        history[toggleKey] = Math.max(history[toggleKey] || 0, 1);
                        saveToggleHistory(history);

                        const allRecords = getRecords();
                        const updated = allRecords.filter(r => !(r.date === selectedDate && r.prayer_name === activeObligatoryId));
                        saveRecords(updated);
                        setRecords([...updated]);
                        if (onRecordUpdated) onRecordUpdated();
                        return;
                      }
                      // Perform smart recording based on time elapsed
                      const now = new Date();
                      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                      const smartStatus = isWithin15MinsOfAdhan ? 'on_time' : 'late';
                      handleMarkPerformed(activeObligatoryId, hhmm, smartStatus);
                    }}
                    style={{
                      padding: '12px 28px',
                      fontSize: '0.92rem',
                      fontWeight: '800',
                      backgroundColor: btnBg,
                      color: btnColor,
                      border: `1.5px solid ${btnBorder}`,
                      borderRadius: '9999px',
                      cursor: (isMissed || isFinalReToggleLocked) ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: btnShadow,
                    }}
                  >
                    <BtnIcon size={18} />
                    <span>{btnText}</span>
                  </button>
                );
              })()}

              <button
                type="button"
                className="btn-pill"
                onClick={() => setActiveModalPrayer(activeObligatoryId)}
                style={{
                  padding: '10px 18px',
                  fontSize: '0.84rem',
                  fontWeight: '700',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-muted)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>التفاصيل</span>
              </button>
            </div>

          </div>

        </div>
      </div>

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
                  تحديد وقت أداء صلاة {modalPrayerInfo?.nameAr}
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
              const adhanT = prayerTimes[activeModalPrayer] || '12:00';
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
                      <span>لم يحن وقت أذان هذه الصلاة بعد اليوم.</span>
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
                      سُجّلت هذه الصلاة كمتروكة أو مقفلة نهائياً، ولا يمكن تعديل وقت أدائها.
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
                        <span>وقت أذان الصلاة اليوم:</span>
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
                          حدد الوقت الذي أديت فيه الصلاة:
                        </label>
                        <input
                          type="time"
                          value={inputTime}
                          onChange={(e) => setCustomPerformedTime(e.target.value)}
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
                          غير مسموح باختيار وقت قبل أذان الصلاة (وقت الأذان هو {toWesternDigits(adhanT)})
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
                          غير مسموح باختيار وقت في المستقبل (الوقت الحالي هو {toWesternDigits(currentHHMM)})
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
                        <span>تسجيل الوقت المعتمد للأداء</span>
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
                left: '18px',
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
              title="إغلاق"
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
                  boxShadow: '0 4px 15px rgba(255, 255, 255, 0.3)',
                }}
              >
                فضـل ساعـة الإجابـة يـوم الجمعـة
              </span>
            </div>

            {/* Hadiths Content Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', textAlign: 'right' }}>
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
                  <span>حديث أبي هريرة رضي الله عنه:</span>
                </div>
                <p className="religious-text" style={{ margin: 0, fontSize: '1.45rem', color: '#ffffff', lineHeight: 1.7, textAlign: 'justify', direction: 'rtl' }}>
                  عن النبي صلى الله عليه وسلم قال: «يومُ الجمعةِ اثنتا عشرةَ ساعةً، لا يوجد فيها عبدٌ مسلمٌ يسألُ اللهَ عزَّ وجلَّ شيئًا إلا آتاه إياه، فالتمِسوها آخرَ ساعةٍ بعد صلاةِ العصرِ»
                </p>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '10px', textAlign: 'left', fontWeight: '600' }}>
                  (رواه أبو داود والنسائي، وصححه الألباني)
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
                  <span>حديث جابر بن عبد الله رضي الله عنهما:</span>
                </div>
                <p className="religious-text" style={{ margin: 0, fontSize: '1.45rem', color: '#ffffff', lineHeight: 1.7, textAlign: 'justify', direction: 'rtl' }}>
                  عن النبي صلى الله عليه وسلم قال: «يومُ الجمعةِ اثنتا عشرةَ ساعةً، فيها ساعةٌ لا يوجد مسلمٌ يسألُ اللهَ عزَّ وجلَّ فيها شيئًا إلا أعطاهُ، فالتمسوها آخرَ ساعةٍ بعد العصرِ»
                </p>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '10px', textAlign: 'left', fontWeight: '600' }}>
                  (رواه أبو داود والنسائي وصححه الحاكم)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





