/**
 * bookStorage.js - IndexedDB and LocalStorage Service for Book Reader and Habit Progression
 * Local-First, Zero External Leakage, 100% Client-Side
 */

const DB_NAME = 'HabitTracker_BooksDB';
const DB_VERSION = 1;
const STORE_NAME = 'books_files';

const STORAGE_KEY_HABIT = 'habit_tracker_reading_habit_state_v1';
const STORAGE_KEY_ACTIVE_BOOK = 'habit_tracker_active_book_id';

/**
 * Open or initialize the IndexedDB database
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (e) => {
      resolve(e.target.result);
    };

    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

/**
 * Save a book file (ArrayBuffer/Blob) and its metadata into IndexedDB
 */
export async function saveBookToDB(bookId, name, size, dataBuffer, totalPages = 0) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Ensure data buffer is cloned and not detached
    let safeData = dataBuffer;
    if (dataBuffer instanceof ArrayBuffer) {
      safeData = dataBuffer.slice(0);
    } else if (dataBuffer && dataBuffer.buffer instanceof ArrayBuffer) {
      safeData = dataBuffer.buffer.slice(dataBuffer.byteOffset, dataBuffer.byteOffset + dataBuffer.byteLength);
    }

    const record = {
      id: bookId,
      name,
      size,
      data: safeData,
      totalPages,
      updatedAt: Date.now(),
    };

    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get a book file by ID from IndexedDB
 */
export async function getBookFromDB(bookId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(bookId);

    req.onsuccess = (e) => {
      resolve(e.target.result || null);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Delete a book from IndexedDB
 */
export async function deleteBookFromDB(bookId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(bookId);

    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * List all saved books metadata from IndexedDB
 */
export async function getAllBooksMetadata() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = (e) => {
        const records = e.target.result || [];
        // Map without large binary data
        const list = records.map((r) => ({
          id: r.id,
          name: r.name,
          size: r.size,
          totalPages: r.totalPages || 0,
          updatedAt: r.updatedAt,
        }));
        resolve(list);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Failed to get books list:', err);
    return [];
  }
}

/**
 * Active Book ID management
 */
export function getActiveBookId() {
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_BOOK) || null;
  } catch {
    return null;
  }
}

export function setActiveBookId(bookId) {
  try {
    if (bookId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_BOOK, bookId);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_BOOK);
    }
  } catch (err) {
    console.error('Failed to set active book ID:', err);
  }
}

/**
 * Default Reading Habit Progression State
 */
export const DEFAULT_READING_STATE = {
  activeLevel: 1, // 1 (10p), 2 (20p), 3 (30p), 4 (Custom unlocked)
  completedDays: 0,
  streakDays: 0,
  missedGraceWarning: false,
  isCustomUnlocked: false,
  customDailyTarget: 30,
  lastReadDate: null,
  dailyLogs: {}, // "YYYY-MM-DD": { pagesRead: number, target: number, completed: boolean }
  bookmarks: {}, // [bookId]: { lastPage: number, totalPages: number, bookmarkTitle: string, timestamp: number }
};

/**
 * Get current date string in YYYY-MM-DD
 */
export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get difference in days between two YYYY-MM-DD date strings
 */
function getDayDiff(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 999;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2 - d1);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determine daily target pages based on active level
 */
export function getDailyTargetForLevel(level, isCustomUnlocked = false, customTarget = 30) {
  if (isCustomUnlocked && level >= 4) {
    return Number(customTarget) || 30;
  }
  if (level === 1) return 10;
  if (level === 2) return 20;
  if (level === 3) return 30;
  return 30;
}

/**
 * Load and reconcile Reading Habit State with 1-Day Grace Buffer
 */
export function getReadingHabitState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HABIT);
    let state = raw ? JSON.parse(raw) : { ...DEFAULT_READING_STATE };

    // Reconcile missed days
    const today = getTodayDateString();
    if (state.lastReadDate && state.lastReadDate !== today) {
      const diff = getDayDiff(state.lastReadDate, today);

      if (diff === 1) {
        // Read yesterday, streak is safe!
        state.missedGraceWarning = false;
      } else if (diff === 2) {
        // Missed 1 day! Activate 1-day grace buffer (warning shown, but no reset yet)
        state.missedGraceWarning = true;
      } else if (diff > 2) {
        // Missed 2 or more consecutive days -> Reset streak and levels if not custom unlocked
        state.missedGraceWarning = false;
        state.streakDays = 0;
        if (!state.isCustomUnlocked) {
          state.activeLevel = 1;
          state.completedDays = 0;
        }
        saveReadingHabitState(state);
      }
    }

    return state;
  } catch (err) {
    console.error('Failed to load reading habit state:', err);
    return { ...DEFAULT_READING_STATE };
  }
}

/**
 * Save Reading Habit State to localStorage
 */
export function saveReadingHabitState(state) {
  try {
    localStorage.setItem(STORAGE_KEY_HABIT, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('habit_reading_state_updated', { detail: state }));
  } catch (err) {
    console.error('Failed to save reading habit state:', err);
  }
}

/**
 * Record pages read today and update level progression
 */
export function recordReadingProgress(bookId, currentPage, totalPages, pagesReadInSession = 1) {
  const state = getReadingHabitState();
  const today = getTodayDateString();

  // 1. Update bookmark for this book
  if (bookId) {
    state.bookmarks[bookId] = {
      lastPage: currentPage,
      totalPages: totalPages || state.bookmarks[bookId]?.totalPages || 0,
      timestamp: Date.now(),
    };
  }

  // 2. Update daily progress log
  const currentTarget = getDailyTargetForLevel(state.activeLevel, state.isCustomUnlocked, state.customDailyTarget);
  const existingLog = state.dailyLogs[today] || { pagesRead: 0, target: currentTarget, completed: false };

  existingLog.pagesRead += pagesReadInSession;
  existingLog.target = currentTarget;

  const wasCompletedBefore = existingLog.completed;
  if (existingLog.pagesRead >= currentTarget && !wasCompletedBefore) {
    existingLog.completed = true;

    // Increment streak & completed days
    state.streakDays = (state.streakDays || 0) + 1;
    state.completedDays = (state.completedDays || 0) + 1;
    state.missedGraceWarning = false;

    // Check Level Progression (Week 1 -> Week 2 -> Week 3 -> Custom Unlocked)
    if (state.completedDays >= 21) {
      state.isCustomUnlocked = true;
      state.activeLevel = 4;
    } else if (state.completedDays >= 14) {
      state.activeLevel = 3; // Week 3 (30 pages)
    } else if (state.completedDays >= 7) {
      state.activeLevel = 2; // Week 2 (20 pages)
    } else {
      state.activeLevel = 1; // Week 1 (10 pages)
    }
  }

  state.dailyLogs[today] = existingLog;
  state.lastReadDate = today;

  saveReadingHabitState(state);
  return state;
}

/**
 * Set custom daily target (only when unlocked)
 */
export function setCustomDailyTarget(targetPages) {
  const state = getReadingHabitState();
  if (!state.isCustomUnlocked) return state;

  state.customDailyTarget = Math.max(1, Number(targetPages) || 30);
  saveReadingHabitState(state);
  return state;
}
