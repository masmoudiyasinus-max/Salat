import Papa from 'papaparse';

const KEYS = {
  RECORDS: 'prayer_tracker_records',
  SETTINGS: 'prayer_tracker_settings',
  TIMES: 'prayer_tracker_times_cache',
  CHAT_SESSIONS: 'prayer_tracker_chat_sessions',
  ACTIVE_SESSION_ID: 'prayer_tracker_active_session_id',
  NAFL_RECORDS: 'prayer_tracker_nafl_records',
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
  { id: 'Sunnah_Dhuhr_Pre', nameAr: 'سنة الظهر القبلية', rakaat: '4 ركعات (مثنى)', timing: 'بعد دخول وقت الظهر (بعد الأذان) وقبل الفريضة' },
  { id: 'Sunnah_Dhuhr_Post', nameAr: 'سنة الظهر البعدية', rakaat: '2 ركعة بعدية', timing: 'بعد صلاة الظهر' },
  { id: 'Sunnah_Maghrib', nameAr: 'سنة المغرب البعدية', rakaat: '2 ركعة بعدية', timing: 'بعد صلاة المغرب' },
  { id: 'Sunnah_Isha', nameAr: 'سنة العشاء البعدية', rakaat: '2 ركعة بعدية', timing: 'بعد صلاة العشاء' },
  { id: 'Qiyam_Layl', nameAr: 'قيام الليل', rakaat: 'مثنى مثنى', timing: 'من بعد العشاء إلى الفجر' },
  { id: 'Witr', nameAr: 'صلاة الوتر', rakaat: '1 - 5 ركعات', timing: 'ختام صلوات الليل' },
];

export function calculateNightTimes(maghribTimeStr, fajrTimeStr) {
  if (!maghribTimeStr || !fajrTimeStr) {
    return { midnight: '01:00', lastThird: '02:30', nightDurationMinutes: 510 };
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
}

export function getRecords() {
  const data = localStorage.getItem(KEYS.RECORDS);
  if (!data) {
    saveRecords([]);
    return [];
  }
  try {
    const parsed = JSON.parse(data);
    // Auto purge old fake demo data (records generated with demo pattern)
    if (Array.isArray(parsed) && parsed.length >= 400 && parsed.some((r) => r.performed_time === '12:35')) {
      saveRecords([]);
      return [];
    }
    return parsed;
  } catch (e) {
    return [];
  }
}

export function saveRecords(records) {
  localStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
}

export function clearAllRecords() {
  saveRecords([]);
  saveNaflRecords([]);
  return [];
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
      ? sess.messages.map((m, mIdx) => ({
          id: m.id || `msg_${mIdx}_${Date.now()}`,
          sender: m.sender === 'user' ? 'user' : 'assistant',
          text:
            typeof m.text === 'string'
              ? m.text
              : typeof m.text === 'object' && m.text !== null
              ? m.text.error || m.text.message || JSON.stringify(m.text)
              : String(m.text || ''),
          attachedFiles: Array.isArray(m.attachedFiles) ? m.attachedFiles : [],
          timestamp: m.timestamp || '12:00',
          usedSearch: Boolean(m.usedSearch),
          durationSeconds: m.durationSeconds ? String(m.durationSeconds) : null,
          isEdited: Boolean(m.isEdited),
          isRegenerated: Boolean(m.isRegenerated),
        }))
      : [],
  }));
}

export function getChatSessions() {
  const data = localStorage.getItem(KEYS.CHAT_SESSIONS);
  if (!data) {
    const defaultSession = createInitialChatSession();
    localStorage.setItem(KEYS.CHAT_SESSIONS, JSON.stringify([defaultSession]));
    localStorage.setItem(KEYS.ACTIVE_SESSION_ID, defaultSession.id);
    return [defaultSession];
  }
  try {
    const parsed = JSON.parse(data);
    const sanitized = sanitizeChatSessions(parsed);
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
  const sessions = getChatSessions();
  const newId = 'session_' + Date.now();
  const newSession = {
    id: newId,
    title: customTitle || `محادثة جديدة ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: '1',
        sender: 'assistant',
        text: 'أهلاً بك! أنا رفيقك الذكي لمتابعة روتينك اليومي والتزامك بالصلوات (Claude Opus 4.8 System Prompt). تحدث معي بحرية عن خططك أو اطلب مني تحليلاً لالتزامك.',
        timestamp: new Date().toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
      },
    ],
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
    messages: [
      {
        id: '1',
        sender: 'assistant',
        text: 'أهلاً بك! أنا رفيقك الذكي لمتابعة روتينك اليومي والتزامك بالصلوات (Claude Opus 4.8 System Prompt). تحدث معي بحرية عن خططك، يومياتك، أو اطلب مني تحليلاً لالتزامك.',
        timestamp: new Date().toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
      },
    ],
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
