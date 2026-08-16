import Papa from 'papaparse';

export const KEYS = {
  RECORDS: 'prayer_tracker_records',
  SETTINGS: 'prayer_tracker_settings',
  TIMES: 'prayer_tracker_times_cache',
  CHAT_SESSIONS: 'prayer_tracker_chat_sessions',
  ACTIVE_SESSION_ID: 'prayer_tracker_active_session_id',
  NAFL_RECORDS: 'prayer_tracker_nafl_records',
  RE_TOGGLE_HISTORY: 'prayer_tracker_re_toggle_history',
  REJECTED_BG_PREFIX: 'prayer_tracker_rejected_bg_',
  ACTIVE_BG_PREFIX: 'prayer_tracker_active_bg_',
};

export function toWesternDigits(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

export function getCityNowDate(timezoneStr) {
  const now = new Date();
  if (!timezoneStr || typeof timezoneStr !== 'string' || timezoneStr.trim() === '') return now;
  try {
    const cityTimeString = now.toLocaleString('en-US', { timeZone: timezoneStr });
    const parsed = new Date(cityTimeString);
    if (isNaN(parsed.getTime())) {
      return now;
    }
    return parsed;
  } catch (e) {
    return now;
  }
}

export function formatTimeDisplay(timeStr, timeFormat = '12', lang = '') {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const clean = timeStr.trim();
  if (!clean.includes(':')) return clean;

  if (timeFormat === '24') {
    return toWesternDigits(clean);
  }

  const [hStr, mStr] = clean.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr.substring(0, 2);

  if (isNaN(h)) return toWesternDigits(clean);

  const activeLang = lang || (typeof window !== 'undefined' ? (getSettings()?.language || 'ar') : 'ar');
  const isEn = activeLang === 'en';
  const period = h >= 12 ? (isEn ? 'PM' : 'م') : (isEn ? 'AM' : 'ص');
  h = h % 12;
  if (h === 0) h = 12;

  const formattedH = String(h).padStart(2, '0');
  return toWesternDigits(`${formattedH}:${m} ${period}`);
}

const DEFAULT_SETTINGS = {
  geminiApiKey: '',
  tavilyApiKey: '',
  prayerSourceUrl: '',
  gracePeriodMinutes: 15,
  city: '',
  country: '',
  customBgImages: [],
  activeCustomBgImage: '',
  youtubeLiveUrl: 'https://www.youtube-nocookie.com/embed/m9-Umj3aL1I',
  bgMode: 'makkah',
  timeFormat: '12',
  language: 'ar',
};

const DEFAULT_PRAYER_TIMES = {
  Fajr: '',
  Sunrise: '',
  Dhuhr: '',
  Asr: '',
  Maghrib: '',
  Isha: '',
};

export const PRAYER_NAMES = [
  { id: 'Fajr', nameAr: 'الفجر' },
  { id: 'Dhuhr', nameAr: 'الظهر' },
  { id: 'Asr', nameAr: 'العصر' },
  { id: 'Maghrib', nameAr: 'المغرب' },
  { id: 'Isha', nameAr: 'العشاء' },
];

export const NAFL_PRAYERS = [
  { id: 'Sunnah_Fajr', nameAr: 'سنة الفجر', rakaat: '2 ركعة قبلية', timing: 'قبل صلاة الفجر' },
  { id: 'Duha', nameAr: 'صلاة الضحى', rakaat: '2 - 8 ركعات', timing: 'من الشروق+15د إلى قبل الظهر' },
  { id: 'Sunnah_Dhuhr_Pre', nameAr: 'سنة الظهر القبلية', rakaat: '4 ركعات', timing: 'بعد دخول وقت الظهر وقبل الفريضة' },
  { id: 'Sunnah_Dhuhr_Post', nameAr: 'سنة الظهر البعدية', rakaat: '2 ركعة بعدية', timing: 'بعد صلاة الظهر' },
  { id: 'Sunnah_Maghrib', nameAr: 'سنة المغرب البعدية', rakaat: '2 ركعة بعدية', timing: 'بعد صلاة المغرب' },
  { id: 'Sunnah_Isha', nameAr: 'سنة العشاء البعدية', rakaat: '2 ركعة بعدية', timing: 'بعد صلاة العشاء' },
  { id: 'Qiyam_Layl', nameAr: 'قيام الليل', rakaat: 'مثنى مثنى', timing: 'من بعد العشاء إلى الفجر' },
  { id: 'Witr', nameAr: 'صلاة الوتر', rakaat: '1 - 5 ركعات', timing: 'ختام صلوات الليل' },
];

export function getCurrentObligatoryPrayerId(prayerTimes, safeNow = new Date()) {
  if (!prayerTimes || !prayerTimes.Fajr || !prayerTimes.Dhuhr || !prayerTimes.Asr || !prayerTimes.Maghrib || !prayerTimes.Isha) {
    return 'Fajr';
  }
  const parseMins = (t) => {
    if (!t || typeof t !== 'string' || !t.includes(':')) return -1;
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return -1;
    return h * 60 + m;
  };
  const currentMins = safeNow.getHours() * 60 + safeNow.getMinutes();
  const fajrMins = parseMins(prayerTimes.Fajr);
  const dhuhrMins = parseMins(prayerTimes.Dhuhr);
  const asrMins = parseMins(prayerTimes.Asr);
  const maghribMins = parseMins(prayerTimes.Maghrib);
  const ishaMins = parseMins(prayerTimes.Isha);

  if (fajrMins === -1 || dhuhrMins === -1 || asrMins === -1 || maghribMins === -1 || ishaMins === -1) {
    return 'Fajr';
  }

  if (currentMins >= fajrMins && currentMins < dhuhrMins) {
    return 'Fajr';
  }
  if (currentMins >= dhuhrMins && currentMins < asrMins) {
    return 'Dhuhr';
  }
  if (currentMins >= asrMins && currentMins < maghribMins) {
    return 'Asr';
  }
  if (currentMins >= maghribMins && currentMins < ishaMins) {
    return 'Maghrib';
  }
  return 'Isha';
}

export function calculateNightTimes(maghribTimeStr, fajrTimeStr) {
  if (!maghribTimeStr || !fajrTimeStr || !maghribTimeStr.includes(':') || !fajrTimeStr.includes(':')) {
    return { midnight: '', midnight12: '', lastThird: '', lastThird12: '', nightDurationMinutes: 0 };
  }

  const [mH, mM] = maghribTimeStr.split(':').map(Number);
  const [fH, fM] = fajrTimeStr.split(':').map(Number);

  const maghribMins = mH * 60 + mM;
  let fajrMins = fH * 60 + fM;
  if (fajrMins <= maghribMins) {
    fajrMins += 1440;
  }

  const totalNightMins = fajrMins - maghribMins;
  const halfNightMins = Math.floor(totalNightMins / 2);
  const twoThirdsMins = Math.floor((totalNightMins * 2) / 3);

  const midnightMins = (maghribMins + halfNightMins) % 1440;
  const lastThirdMins = (maghribMins + twoThirdsMins) % 1440;

  const formatMins = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const formatMins12 = (mins) => {
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? 'م' : 'ص';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  };

  return {
    midnight: toWesternDigits(formatMins(midnightMins)),
    midnight12: toWesternDigits(formatMins12(midnightMins)),
    lastThird: toWesternDigits(formatMins(lastThirdMins)),
    lastThird12: toWesternDigits(formatMins12(lastThirdMins)),
    nightDurationMinutes: totalNightMins,
  };
}

export function getNaflRecords() {
  const data = localStorage.getItem(KEYS.NAFL_RECORDS);
  if (!data) return [];
  try { return JSON.parse(data); } catch(e) { return []; }
}

export function saveNaflRecords(records) {
  localStorage.setItem(KEYS.NAFL_RECORDS, JSON.stringify(records));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nafl-records-updated', { detail: records }));
  }
}

export function toggleNaflRecord(date, naflId) {
  const records = getNaflRecords();
  const idx = records.findIndex((r) => r.date === date && r.nafl_id === naflId);
  if (idx >= 0) {
    records[idx].status = records[idx].status === 'completed' ? 'none' : 'completed';
  } else {
    records.push({
      date,
      nafl_id: naflId,
      status: 'completed',
      timestamp: new Date().toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
    });
  }
  saveNaflRecords(records);
  return records;
}

export function getSettings() {
  const data = localStorage.getItem(KEYS.SETTINGS);
  if (!data) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export function getPrayerTimesCache() {
  const data = localStorage.getItem(KEYS.TIMES);
  if (!data) return DEFAULT_PRAYER_TIMES;
  try {
    return JSON.parse(data);
  } catch (e) {
    return DEFAULT_PRAYER_TIMES;
  }
}

export function savePrayerTimesCache(times) {
  localStorage.setItem(KEYS.TIMES, JSON.stringify(times));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('prayer-times-updated', { detail: times }));
  }
}

export function getRecords() {
  const data = localStorage.getItem(KEYS.RECORDS);
  if (!data) {
    saveRecords([]);
    return [];
  }
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    return [];
  }
}

export function saveRecords(records) {
  localStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('records-updated', { detail: records }));
  }
}

export function clearAllRecords() {
  saveRecords([]);
  saveNaflRecords([]);
  localStorage.removeItem(KEYS.RE_TOGGLE_HISTORY);
  return [];
}

export function exportFullUserDataJSON() {
  const payload = {
    version: 1,
    app: 'HabitTracker_Salat',
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    records: getRecords(),
    naflRecords: getNaflRecords(),
    chatSessions: getChatSessions(),
    activeSessionId: getActiveSessionId(),
    cachedTimes: getPrayerTimesCache(),
  };
  return JSON.stringify(payload, null, 2);
}

export function importFullUserDataJSON(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    throw new Error('ملف النسخة الاحتياطية فارغ أو غير صالح');
  }

  const data = JSON.parse(jsonString);
  if (!data || typeof data !== 'object') {
    throw new Error('تنسيق النسخة الاحتياطية غير متوافق');
  }

  if (data.settings && typeof data.settings === 'object') {
    saveSettings(data.settings);
  }
  if (Array.isArray(data.records)) {
    saveRecords(data.records);
  }
  if (Array.isArray(data.naflRecords)) {
    saveNaflRecords(data.naflRecords);
  }
  if (Array.isArray(data.chatSessions)) {
    saveChatSessions(data.chatSessions);
  }
  if (data.activeSessionId && typeof data.activeSessionId === 'string') {
    saveActiveSessionId(data.activeSessionId);
  }
  if (data.cachedTimes && typeof data.cachedTimes === 'object') {
    savePrayerTimesCache(data.cachedTimes);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('records-updated', { detail: getRecords() }));
    window.dispatchEvent(new CustomEvent('nafl-records-updated', { detail: getNaflRecords() }));
    window.dispatchEvent(new CustomEvent('settings-updated', { detail: getSettings() }));
    window.dispatchEvent(new CustomEvent('prayer-times-updated', { detail: getPrayerTimesCache() }));
  }

  return true;
}

export function clearEntireAppData() {
  clearAllRecords();
  localStorage.removeItem(KEYS.SETTINGS);
  localStorage.removeItem(KEYS.TIMES);
  localStorage.removeItem(KEYS.CHAT_SESSIONS);
  localStorage.removeItem(KEYS.ACTIVE_SESSION_ID);
  localStorage.removeItem(KEYS.RE_TOGGLE_HISTORY);

  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith('bg_rejected_imgs_') || k.startsWith('active_bg_') || k.startsWith('prayer_tracker_')) {
      localStorage.removeItem(k);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('records-updated', { detail: [] }));
    window.dispatchEvent(new CustomEvent('nafl-records-updated', { detail: [] }));
    window.dispatchEvent(new CustomEvent('settings-updated', { detail: getSettings() }));
    window.dispatchEvent(new CustomEvent('prayer-times-updated', { detail: getPrayerTimesCache() }));
  }
}

export function upsertRecord(newRecord) {
  const records = getRecords();
  const index = records.findIndex(
    (r) => r.date === newRecord.date && r.prayer_name === newRecord.prayer_name
  );
  if (index >= 0) {
    records[index] = { ...records[index], ...newRecord };
  } else {
    records.push(newRecord);
  }
  saveRecords(records);
  return records;
}

export function exportToCSV() {
  const records = getRecords();
  const csvData = records.map((r) => ({
    date: r.date,
    prayer_name: r.prayer_name,
    adhan_time: r.adhan_time || '',
    performed_time: r.performed_time || '',
    delay_minutes: r.delay_minutes ?? 0,
    status: r.status || 'missed',
  }));

  const csvString = Papa.unparse(csvData, {
    columns: ['date', 'prayer_name', 'adhan_time', 'performed_time', 'delay_minutes', 'status'],
  });

  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `prayer_tracker_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function importFromCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && Array.isArray(results.data)) {
          const parsed = results.data.map((row) => ({
            date: row.date,
            prayer_name: row.prayer_name,
            adhan_time: row.adhan_time,
            performed_time: row.performed_time,
            delay_minutes: parseInt(row.delay_minutes || '0', 10),
            status: row.status,
          }));
          saveRecords(parsed);
          resolve(parsed);
        } else {
          reject(new Error('Invalid CSV Format'));
        }
      },
      error: (err) => reject(err),
    });
  });
}

/* ==========================================================================
   Chat Storage & History Sessions Manager (Safe Sanitized Auto-Save)
   ========================================================================== */

export function sanitizeChatSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return [createInitialChatSession()];
  }
  return sessions.map((sess, sIdx) => ({
    id: sess.id || `session_${sIdx}_${Date.now()}`,
    title: typeof sess.title === 'string' ? sess.title : 'محادثة',
    createdAt: sess.createdAt || new Date().toISOString(),
    updatedAt: sess.updatedAt || new Date().toISOString(),
        messages: Array.isArray(sess.messages)
          ? sess.messages
              .filter((m) => {
                const textVal = typeof m.text === 'string' ? m.text : String(m.text || '');
                return (
                  !textVal.includes('أهلاً بك! أنا الشيخ منير، رفيقك ومعينك') &&
                  !textVal.includes('تم إعادة تهيئة المحادثة') &&
                  !textVal.includes('Claude Opus 4.8 System Prompt')
                );
              })
              .map((m, mIdx) => {
                const textVal =
                  typeof m.text === 'string'
                    ? m.text
                    : typeof m.text === 'object' && m.text !== null
                    ? m.text.error || m.text.message || JSON.stringify(m.text)
                    : String(m.text || '');

                return {
                  id: m.id || `msg_${mIdx}_${Date.now()}`,
                  sender: m.sender === 'user' ? 'user' : 'assistant',
                  text: textVal,
                  attachedFiles: Array.isArray(m.attachedFiles) ? m.attachedFiles : [],
                  timestamp: m.timestamp || '12:00',
                  usedSearch: Boolean(m.usedSearch),
                  durationSeconds: m.durationSeconds ? String(m.durationSeconds) : null,
                  isEdited: Boolean(m.isEdited),
                  isRegenerated: Boolean(m.isRegenerated),
                };
              })
          : [],
  }));
}

export function getChatSessions() {
  const data = localStorage.getItem(KEYS.CHAT_SESSIONS);
  const activeId = localStorage.getItem(KEYS.ACTIVE_SESSION_ID) || '';
  if (!data) {
    const defaultSession = createInitialChatSession();
    localStorage.setItem(KEYS.CHAT_SESSIONS, JSON.stringify([defaultSession]));
    localStorage.setItem(KEYS.ACTIVE_SESSION_ID, defaultSession.id);
    return [defaultSession];
  }
  try {
    const parsed = JSON.parse(data);
    let sanitized = sanitizeChatSessions(parsed);
    // Auto-purge any empty sessions (0 messages) that are not the currently active session
    sanitized = sanitized.filter((s) => {
      const hasMsgs = Array.isArray(s.messages) && s.messages.length > 0;
      return hasMsgs || s.id === activeId;
    });
    if (sanitized.length === 0) {
      sanitized = [createInitialChatSession()];
    }
    saveChatSessions(sanitized);
    return sanitized;
  } catch (e) {
    const defaultSession = createInitialChatSession();
    localStorage.setItem(KEYS.CHAT_SESSIONS, JSON.stringify([defaultSession]));
    localStorage.setItem(KEYS.ACTIVE_SESSION_ID, defaultSession.id);
    return [defaultSession];
  }
}

export function resetChatSessions() {
  const defaultSession = createInitialChatSession();
  localStorage.setItem(KEYS.CHAT_SESSIONS, JSON.stringify([defaultSession]));
  localStorage.setItem(KEYS.ACTIVE_SESSION_ID, defaultSession.id);
  return [defaultSession];
}

export function saveChatSessions(sessions) {
  localStorage.setItem(KEYS.CHAT_SESSIONS, JSON.stringify(sessions));
}

export function getActiveSessionId() {
  return localStorage.getItem(KEYS.ACTIVE_SESSION_ID) || '';
}

export function saveActiveSessionId(id) {
  localStorage.setItem(KEYS.ACTIVE_SESSION_ID, id);
}

export function createNewSession(customTitle = '') {
  let sessions = getChatSessions();
  // Auto-remove any empty sessions before adding a fresh session
  sessions = sessions.filter((s) => Array.isArray(s.messages) && s.messages.length > 0);
  const newId = 'session_' + Date.now();
  const newSession = {
    id: newId,
    title: customTitle || `محادثة جديدة ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };

  const updated = [newSession, ...sessions];
  saveChatSessions(updated);
  saveActiveSessionId(newId);
  return { newSession, sessions: updated };
}

export function updateSessionMessages(sessionId, messages) {
  const sessions = getChatSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx >= 0) {
    let title = sessions[idx].title;
    const firstUserMsg = messages.find((m) => m.sender === 'user');
    if (firstUserMsg && (title.startsWith('محادثة جديدة') || title.startsWith('محادثة رئيسية'))) {
      const msgStr = typeof firstUserMsg.text === 'string' ? firstUserMsg.text : String(firstUserMsg.text || '');
      title = msgStr.slice(0, 30) + (msgStr.length > 30 ? '...' : '');
    }

    sessions[idx] = {
      ...sessions[idx],
      title,
      messages,
      updatedAt: new Date().toISOString(),
    };
    saveChatSessions(sessions);
  }
  return sessions;
}

export function updateSessionTitle(sessionId, newTitle) {
  if (!sessionId || !newTitle || !newTitle.trim()) return getChatSessions();
  const sessions = getChatSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx >= 0) {
    sessions[idx] = {
      ...sessions[idx],
      title: newTitle.trim(),
      updatedAt: new Date().toISOString(),
    };
    saveChatSessions(sessions);
  }
  return sessions;
}

export function deleteSession(sessionId) {
  let sessions = getChatSessions();
  sessions = sessions.filter((s) => s.id !== sessionId);

  if (sessions.length === 0) {
    const defaultSession = createInitialChatSession();
    sessions = [defaultSession];
  }

  saveChatSessions(sessions);
  saveActiveSessionId(sessions[0].id);
  return { activeId: sessions[0].id, sessions };
}

function createInitialChatSession() {
  return {
    id: 'session_default',
    title: 'محادثة رئيسية',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function generateInitialDemoRecords() {
  return [];
}

export function computeSummaryStats(records) {
  let onTime = 0;
  let late = 0;
  let qada = 0;
  let missed = 0;
  let totalDelay = 0;
  let delayCount = 0;

  records.forEach((r) => {
    if (r.status === 'on_time') onTime++;
    else if (r.status === 'late') late++;
    else if (r.status === 'qada') qada++;
    else if (r.status === 'missed') missed++;

    if (r.delay_minutes > 0) {
      totalDelay += r.delay_minutes;
      delayCount++;
    }
  });

  const avgDelay = delayCount > 0 ? Math.round(totalDelay / delayCount) : 0;

  const dateGroups = {};
  records.forEach((r) => {
    if (!dateGroups[r.date]) dateGroups[r.date] = [];
    dateGroups[r.date].push(r);
  });

  const sortedDates = Object.keys(dateGroups).sort().reverse();
  let currentStreak = 0;
  let maxStreak = 0;

  for (const date of sortedDates) {
    const dayPrayers = dateGroups[date];
    const allOnTime =
      dayPrayers.length >= 5 && dayPrayers.every((p) => p.status === 'on_time');

    if (allOnTime) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  return {
    onTime,
    late,
    qada,
    missed,
    avgDelay,
    maxStreak,
  };
}
