import assert from 'node:assert/strict';
import React from 'react';

// Import services and helpers for M3
import {
  getChatSessions,
  saveChatSessions,
  getActiveSessionId,
  saveActiveSessionId,
  createNewSession,
  updateSessionMessages,
  updateSessionTitle,
  deleteSession,
  resetChatSessions,
  sanitizeChatSessions,
  getSettings,
  saveSettings,
} from '../src/services/storage.js';

import {
  getReadingHabitState,
  saveReadingHabitState,
  getDailyTargetForLevel,
  recordReadingProgress,
  setCustomDailyTarget,
  getActiveBookId,
  setActiveBookId,
  DEFAULT_READING_STATE,
  getDayDiff,
  getTodayDateString,
} from '../src/services/bookStorage.js';

import {
  fetchAvailableGeminiModels,
  determineSearchIntent,
  sendGeminiChatMessage,
  generateSessionTitle,
  correctSpellingText,
} from '../src/services/geminiApi.js';

import { extractMuneerAction, executeSettingsActionDirectly } from '../src/services/muneerActions.js';

console.log('=== STARTING EMPIRICAL STRESS TEST SUITE FOR MILESTONE 3 ===\n');

let passCount = 0;
let failCount = 0;

async function runTest(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      await result;
    }
    console.log(`✓ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
    failCount++;
  }
}

// In-memory LocalStorage Mock for isolated stress testing
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

// Mock browser global environment
const mockStorage = new MockLocalStorage();
globalThis.localStorage = mockStorage;
globalThis.window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};

// -------------------------------------------------------------
// 1. CHAT STORAGE & SESSION MANAGEMENT STRESS TESTS
// -------------------------------------------------------------
console.log('--- 1. Testing Chat Storage & Session Resilience ---');

await runTest('sanitizeChatSessions handles null, undefined, empty, and corrupted data', () => {
  const resNull = sanitizeChatSessions(null);
  assert.ok(Array.isArray(resNull));
  assert.equal(resNull.length, 1);
  assert.equal(resNull[0].id, 'session_default');

  const resUndefined = sanitizeChatSessions(undefined);
  assert.ok(Array.isArray(resUndefined));
  assert.equal(resUndefined.length, 1);

  const resEmpty = sanitizeChatSessions([]);
  assert.ok(Array.isArray(resEmpty));
  assert.equal(resEmpty.length, 1);

  const corrupted = [
    { id: null, title: null, messages: null },
    { id: 's2', title: 123, messages: [{ text: null }, { text: { error: 'Failed' } }, { text: 'Valid' }] },
  ];
  const resCorrupted = sanitizeChatSessions(corrupted);
  assert.equal(resCorrupted.length, 2);
  assert.ok(resCorrupted[0].id.startsWith('session_0_'));
  assert.equal(resCorrupted[0].title, 'محادثة');
  assert.deepEqual(resCorrupted[0].messages, []);
  assert.equal(resCorrupted[1].title, 'محادثة');
  assert.equal(resCorrupted[1].messages.length, 3);
  assert.equal(resCorrupted[1].messages[0].text, '');
  assert.equal(resCorrupted[1].messages[1].text, 'Failed');
  assert.equal(resCorrupted[1].messages[2].text, 'Valid');
});

await runTest('Chat session deletion: deleting single session preserves clean default session', () => {
  mockStorage.clear();
  const initial = getChatSessions();
  assert.equal(initial.length, 1);

  const { activeId, sessions } = deleteSession(initial[0].id);
  assert.ok(Array.isArray(sessions));
  assert.equal(sessions.length, 1);
  assert.equal(activeId, sessions[0].id);
  assert.equal(sessions[0].id, 'session_default');
});

await runTest('Chat session deletion: deleting active session among multiple sessions updates activeId', async () => {
  mockStorage.clear();
  const { newSession: s1 } = createNewSession('Session 1');
  updateSessionMessages(s1.id, [{ sender: 'user', text: 'Hello 1' }]);
  await new Promise((r) => setTimeout(r, 5));

  const { newSession: s2 } = createNewSession('Session 2');
  updateSessionMessages(s2.id, [{ sender: 'user', text: 'Hello 2' }]);
  await new Promise((r) => setTimeout(r, 5));

  const { newSession: s3 } = createNewSession('Session 3');
  updateSessionMessages(s3.id, [{ sender: 'user', text: 'Hello 3' }]);

  const sessionsBefore = getChatSessions();
  assert.equal(sessionsBefore.length, 3);

  // Delete s3 (which is currently active)
  const result = deleteSession(s3.id);
  assert.equal(result.sessions.length, 2);
  assert.equal(result.activeId, result.sessions[0].id);
  assert.equal(result.sessions.some((s) => s.id === s3.id), false);
});

await runTest('Chat session deletion: deleting non-existent session is a safe no-op', () => {
  const before = getChatSessions();
  const result = deleteSession('non_existent_id_99999');
  assert.equal(result.sessions.length, before.length);
  assert.equal(result.activeId, result.sessions[0].id);
});

await runTest('createNewSession and updateSessionTitle behave predictably under rapid updates', () => {
  mockStorage.clear();
  const { newSession } = createNewSession();
  assert.ok(newSession.id);
  assert.equal(newSession.messages.length, 0);

  const updated1 = updateSessionTitle(newSession.id, '  عنوان تجريبي جديد  ');
  const found1 = updated1.find((s) => s.id === newSession.id);
  assert.equal(found1.title, 'عنوان تجريبي جديد');

  // Empty or blank title should not overwrite
  const updated2 = updateSessionTitle(newSession.id, '   ');
  const found2 = updated2.find((s) => s.id === newSession.id);
  assert.equal(found2.title, 'عنوان تجريبي جديد');
});

await runTest('updateSessionMessages auto-names session from first user message', () => {
  mockStorage.clear();
  const { newSession } = createNewSession();
  const msgs = [
    { sender: 'assistant', text: 'مرحباً' },
    { sender: 'user', text: 'ما هو حكم صلاة الوتر في السفر؟' },
  ];
  const updated = updateSessionMessages(newSession.id, msgs);
  const found = updated.find((s) => s.id === newSession.id);
  assert.equal(found.title, 'ما هو حكم صلاة الوتر في السفر؟');
  assert.equal(found.messages.length, 2);
});

await runTest('resetChatSessions resets to a single initial default chat', () => {
  const resetList = resetChatSessions();
  assert.equal(resetList.length, 1);
  assert.equal(resetList[0].id, 'session_default');
  assert.equal(getActiveSessionId(), 'session_default');
});

// -------------------------------------------------------------
// 2. MUNEER ACTION & SPEECH SYNTHESIS STRESS TESTS
// -------------------------------------------------------------
console.log('\n--- 2. Testing Muneer Actions & Speech Synthesis Prep ---');

await runTest('extractMuneerAction parses JSON actions and returns clean conversation text', () => {
  const responseWithAction = `السلام عليكم ورحمة الله وبركاته.
لقد قمت بضبط المدينة وطريقة الحساب لك وفق طلبك.
\`\`\`json
{
  "action": "update_settings",
  "changes": {
    "city": "مكة المكرمة",
    "country": "المملكة العربية السعودية"
  }
}
\`\`\`
بارك الله فيك.`;

  const { cleanText, action } = extractMuneerAction(responseWithAction);
  assert.ok(action);
  assert.equal(action.action, 'update_settings');
  assert.equal(action.changes.city, 'مكة المكرمة');
  assert.ok(cleanText.includes('السلام عليكم ورحمة الله وبركاته.'));
  assert.ok(cleanText.includes('بارك الله فيك.'));
  assert.ok(!cleanText.includes('```json'));
});

await runTest('executeSettingsActionDirectly updates settings safely and handles malformed actions', () => {
  mockStorage.clear();
  const action = {
    action: 'update_settings',
    changes: {
      city: 'المدينة المنورة',
      country: 'السعودية',
      timeFormat: '24',
      bgMode: 'madinah',
    },
  };

  let savedCallbackCalled = false;
  const updated = executeSettingsActionDirectly(action, (res) => {
    savedCallbackCalled = true;
  });

  assert.ok(updated);
  assert.equal(updated.city, 'المدينة المنورة');
  assert.equal(updated.country, 'السعودية');
  assert.equal(updated.timeFormat, '24');
  assert.equal(updated.bgMode, 'madinah');
  assert.equal(savedCallbackCalled, true);

  // Malformed actions should not throw
  assert.equal(executeSettingsActionDirectly(null), undefined);
  assert.equal(executeSettingsActionDirectly({ action: 'unknown' }), undefined);
});

await runTest('Speech Synthesis text cleaning strips markdown, asterisks, backticks, and links', () => {
  const sampleMarkdown = `### تنبيه مهم
**صلاة الفجر** هي *أولى* الصلوات المكتوبة.
يمكنك مراجعة الرابط: [موقع الأوقاف](https://example.com/islam).
كود التوثيق: \`FAJR_01\`.`;

  const cleanSpokenText = sampleMarkdown
    .replace(/[*#`_~]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim();

  assert.ok(!cleanSpokenText.includes('###'));
  assert.ok(!cleanSpokenText.includes('**'));
  assert.ok(!cleanSpokenText.includes('`'));
  assert.ok(!cleanSpokenText.includes('https://'));
  assert.ok(cleanSpokenText.includes('موقع الأوقاف'));
  assert.ok(cleanSpokenText.includes('صلاة الفجر هي أولى الصلوات المكتوبة.'));
});

// -------------------------------------------------------------
// 3. BOOK READER & HABIT STORAGE STRESS TESTS
// -------------------------------------------------------------
console.log('\n--- 3. Testing Book Reader & Reading Habit State ---');

await runTest('getDailyTargetForLevel handles level progression and custom target unlocks', () => {
  // Level 1: 10 pages
  assert.equal(getDailyTargetForLevel(1, false, 0), 10);
  // Level 2: 20 pages
  assert.equal(getDailyTargetForLevel(2, false, 0), 20);
  // Level 3: 30 pages
  assert.equal(getDailyTargetForLevel(3, false, 0), 30);
  // Level 4 (custom unlocked): returns custom target or 30
  assert.equal(getDailyTargetForLevel(4, true, 45), 45);
  assert.equal(getDailyTargetForLevel(4, true, 0), 30);
  // Level 4 without custom unlocked -> 30 pages
  assert.equal(getDailyTargetForLevel(4, false, 45), 30);
});

await runTest('getDayDiff computes exact day differences across dates', () => {
  assert.equal(getDayDiff('2026-08-18', '2026-08-18'), 0);
  assert.equal(getDayDiff('2026-08-18', '2026-08-19'), 1);
  assert.equal(getDayDiff('2026-08-18', '2026-08-20'), 2);
  assert.equal(getDayDiff('2026-08-01', '2026-08-31'), 30);
  assert.equal(getDayDiff(null, '2026-08-18'), 999);
  assert.equal(getDayDiff('invalid-date', '2026-08-18'), 999);
});

await runTest('recordReadingProgress properly updates bookmarks, daily logs, and level progression', () => {
  mockStorage.clear();
  const bookId = 'book_12345';

  // Read spread [3, 4] (4 pages reached, target is 10)
  const updated1 = recordReadingProgress(bookId, 3, 100, 2);
  assert.ok(updated1.bookmarks[bookId]);
  assert.equal(updated1.bookmarks[bookId].lastPage, 3);
  assert.equal(updated1.bookmarks[bookId].totalPages, 100);

  const todayStr = getTodayDateString();
  const log1 = updated1.dailyLogs[todayStr];
  assert.ok(log1);
  assert.equal(log1.pagesRead, 4);
  assert.equal(log1.completed, false); // 4 < 10

  // Read spread [9, 10] (total 10 >= 10 -> completed!)
  const updated2 = recordReadingProgress(bookId, 9, 100, 2);
  assert.equal(updated2.bookmarks[bookId].lastPage, 9);
  assert.equal(updated2.dailyLogs[todayStr].pagesRead, 10);
  assert.equal(updated2.dailyLogs[todayStr].completed, true);
  assert.equal(updated2.completedDays, 1);
  assert.equal(updated2.streakDays, 1);
});

await runTest('setCustomDailyTarget unlocks and updates custom target only when unlocked', () => {
  mockStorage.clear();

  // Try setting before unlock -> should remain locked
  const stateLocked = setCustomDailyTarget(50);
  assert.equal(stateLocked.isCustomUnlocked, false);

  // Manually unlock level 4 and set custom target
  const customUnlockedState = {
    ...getReadingHabitState(),
    isCustomUnlocked: true,
    activeLevel: 4,
    completedDays: 21,
  };
  saveReadingHabitState(customUnlockedState);

  const stateUnlocked = setCustomDailyTarget(40);
  assert.equal(stateUnlocked.isCustomUnlocked, true);
  assert.equal(stateUnlocked.customDailyTarget, 40);

  const reloaded = getReadingHabitState();
  assert.equal(reloaded.customDailyTarget, 40);
});

await runTest('Reading habit state recovery handles corrupted JSON in localStorage', () => {
  mockStorage.setItem('habit_tracker_reading_habit_state_v1', 'NOT_VALID_JSON{]');
  const recovered = getReadingHabitState();
  assert.ok(recovered);
  assert.equal(recovered.activeLevel, 1);
  assert.ok(typeof recovered.bookmarks === 'object');
  assert.ok(typeof recovered.dailyLogs === 'object');
});

// -------------------------------------------------------------
// 4. GEMINI API SERVICE STRESS TESTS
// -------------------------------------------------------------
console.log('\n--- 4. Testing Gemini API Service Logic ---');

await runTest('fetchAvailableGeminiModels returns default models when no key is passed', async () => {
  const models = await fetchAvailableGeminiModels('');
  assert.ok(Array.isArray(models));
  assert.ok(models.length >= 3);
  assert.ok(models.includes('gemini-2.5-flash'));
  assert.ok(models.includes('gemini-2.0-flash'));
  assert.ok(models.includes('gemini-1.5-flash'));
});

await runTest('sendGeminiChatMessage returns clean error when API key is missing', async () => {
  const res = await sendGeminiChatMessage('', [], 'هل يجوز صيام التطوع بدون تبييت النية من الليل؟');
  assert.equal(res.success, false);
  assert.ok(res.error.includes('مفتاح Gemini API غير مضاف'));
});

await runTest('determineSearchIntent returns false for empty text or key', async () => {
  const res1 = await determineSearchIntent('', 'test');
  assert.equal(res1.needsSearch, false);
  assert.equal(res1.searchQuery, '');

  const res2 = await determineSearchIntent('valid_key', '');
  assert.equal(res2.needsSearch, false);
  assert.equal(res2.searchQuery, '');
});

await runTest('generateSessionTitle returns null for empty queries or keys', async () => {
  const title1 = await generateSessionTitle('', 'test query');
  assert.equal(title1, null);

  const title2 = await generateSessionTitle('valid_key', '');
  assert.equal(title2, null);
});

await runTest('correctSpellingText returns original text unchanged for empty input or key', async () => {
  const text1 = await correctSpellingText('', 'نص تجريبي');
  assert.equal(text1, 'نص تجريبي');

  const text2 = await correctSpellingText('valid_key', '');
  assert.equal(text2, '');
});

// -------------------------------------------------------------
// 5. BUFFER & CORRUPT DATA RESILIENCE TESTS FOR PDF ENGINE
// -------------------------------------------------------------
console.log('\n--- 5. Testing PDF Buffer Parsing & Error Resilience ---');

await runTest('Buffer data normalization handles Uint8Array, ArrayBuffer, Blob, and raw arrays', () => {
  const rawData = [37, 80, 68, 70, 45, 49, 46, 55]; // "%PDF-1.7"
  const ab = new Uint8Array(rawData).buffer;
  const uint8 = new Uint8Array(ab);

  const normalize = (input) => {
    if (!input) return null;
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    return new Uint8Array(input);
  };

  const n1 = normalize(uint8);
  assert.ok(n1 instanceof Uint8Array);
  assert.equal(n1.length, 8);

  const n2 = normalize(ab);
  assert.ok(n2 instanceof Uint8Array);
  assert.equal(n2.length, 8);

  const n3 = normalize(rawData);
  assert.ok(n3 instanceof Uint8Array);
  assert.equal(n3.length, 8);

  const nNull = normalize(null);
  assert.equal(nNull, null);
});

// -------------------------------------------------------------
// 6. ADVERSARIAL EDGE CASE TESTS
// -------------------------------------------------------------
console.log('\n--- 6. Testing Adversarial Edge Cases ---');

await runTest('Message resend data structures are preserved when text is empty but attachments exist', () => {
  const msgWithOnlyAttachment = {
    id: 'msg_1001',
    sender: 'user',
    text: '',
    attachedFiles: [{ id: 'f1', name: 'hadith.pdf', size: '12 KB', isImage: false, content: 'raw_content' }],
    segments: [{ type: 'file', file: { id: 'f1', name: 'hadith.pdf', size: '12 KB', isImage: false, content: 'raw_content' } }],
  };

  const query = typeof msgWithOnlyAttachment.text === 'string' ? msgWithOnlyAttachment.text : String(msgWithOnlyAttachment.text || '');
  const files = Array.isArray(msgWithOnlyAttachment.attachedFiles) ? msgWithOnlyAttachment.attachedFiles : [];
  const segments = Array.isArray(msgWithOnlyAttachment.segments) ? msgWithOnlyAttachment.segments : [];

  assert.equal(query, '');
  assert.equal(files.length, 1);
  assert.equal(segments.length, 1);

  // Even if query is empty, having attachments allows sending
  const canSend = Boolean(query.trim() || files.length > 0);
  assert.equal(canSend, true);
});

await runTest('ActiveBookId handles missing, null, and non-existent IDs gracefully', () => {
  mockStorage.clear();
  assert.equal(getActiveBookId(), null);

  setActiveBookId('book_alpha');
  assert.equal(getActiveBookId(), 'book_alpha');

  setActiveBookId(null);
  assert.equal(getActiveBookId(), null);
});

await runTest('Speech synthesis toggle simulator handles rapid start/stop/switch without orphan state', () => {
  let speakingMsgId = null;
  let canceledCount = 0;
  let spokenCount = 0;

  const mockSynthesis = {
    cancel: () => {
      canceledCount++;
    },
    speak: (utt) => {
      spokenCount++;
      // Simulate async completion or immediate error
    },
    getVoices: () => [
      { lang: 'ar-SA', name: 'Maged' },
      { lang: 'en-US', name: 'David' },
    ],
  };

  const toggleSpeak = (msgId, text) => {
    if (speakingMsgId === msgId) {
      mockSynthesis.cancel();
      speakingMsgId = null;
      return;
    }
    mockSynthesis.cancel();
    const { cleanText } = extractMuneerAction(text);
    const textToRead = (cleanText || text || '').trim();
    if (!textToRead) return;

    speakingMsgId = msgId;
    mockSynthesis.speak({ text: textToRead });
  };

  // 1. Start speaking msg1
  toggleSpeak('m1', 'مرحبا بك');
  assert.equal(speakingMsgId, 'm1');
  assert.equal(spokenCount, 1);
  assert.equal(canceledCount, 1);

  // 2. Click same msg1 again -> stop
  toggleSpeak('m1', 'مرحبا بك');
  assert.equal(speakingMsgId, null);
  assert.equal(canceledCount, 2);

  // 3. Start speaking msg2, then immediately switch to msg3
  toggleSpeak('m2', 'سؤال عن الصلاة');
  assert.equal(speakingMsgId, 'm2');
  assert.equal(spokenCount, 2);

  toggleSpeak('m3', 'إجابة الشيخ منير');
  assert.equal(speakingMsgId, 'm3');
  assert.equal(spokenCount, 3);
  assert.equal(canceledCount, 4);
});

await runTest('BookReader page navigation respects lower and upper bounds', () => {
  mockStorage.clear();
  const bookId = 'book_bounds_test';
  let currentPage = 1;
  const totalPages = 5;

  const handlePrevPage = () => {
    if (currentPage > 1) {
      currentPage -= 1;
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      currentPage += 1;
      recordReadingProgress(bookId, currentPage, totalPages, 1);
    }
  };

  // Try going prev from page 1 -> should stay at 1
  handlePrevPage();
  assert.equal(currentPage, 1);

  // Step forward to page 5
  handleNextPage(); // 2
  handleNextPage(); // 3
  handleNextPage(); // 4
  handleNextPage(); // 5
  assert.equal(currentPage, 5);

  // Try stepping beyond totalPages -> should stay at 5
  handleNextPage();
  assert.equal(currentPage, 5);

  const habit = getReadingHabitState();
  assert.equal(habit.bookmarks[bookId].lastPage, 5);
  assert.equal(habit.bookmarks[bookId].totalPages, 5);
});

await runTest('ChatView Markdown Formatter handles squished lists, code, and bold formatting', () => {
  const rawMarkdown = `1. **الفجر**: ركعتان فرض
2. **الظهر**: أربع ركعات
 3. **العصر**: أربع ركعات`;

  // Pre-normalize squished list items matching ChatView.jsx formatMarkdownText
  const text = String(rawMarkdown)
    .replace(/([^\n])\s+(\d+\.\s+\*\*)/g, '$1\n\n$2')
    .replace(/([^\n])\s+(\d+\.\s+[^\d\s])/g, '$1\n$2');

  const lines = text.split('\n');
  assert.ok(lines.length >= 3);
  assert.ok(lines.some((l) => l.trim().startsWith('3. **العصر**')));
});

console.log(`\n=== TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===`);
if (failCount > 0) {
  process.exit(1);
}

