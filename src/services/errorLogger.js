/**
 * Centralized Error Logging, Telemetry & Deterministic Deduplication Engine
 * (Zero-Leak Capture, Deterministic Fingerprinting, Storage-Safe Local-First Logging)
 */
import { KEYS } from './storage.js';

let isLoggingInternal = false;
let listenersInitialized = false;

/**
 * Normalizes a stack trace by stripping non-deterministic runtime tokens
 * (such as Vite ?t=... timestamps, cache IDs, query hashes, and line:column jitter).
 */
export function normalizeStackTrace(stack) {
  if (!stack || typeof stack !== 'string') return '';
  return stack
    .split('\n')
    .slice(0, 6)
    .map((line) =>
      line
        .replace(/(\?t=\d+|\?v=[a-f0-9]+)/gi, '')
        .replace(/:\d+:\d+/g, '')
        .replace(/at http:\/\/[^/]+/g, 'at app://')
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

/**
 * Deterministic 32-bit hash function (DJB2 algorithm) producing an 8-character hex string.
 */
export function hashString(str) {
  if (!str) return '00000000';
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates a deterministic, unique fingerprint for an error based on:
 * Error Name + Normalized Message + Context + Normalized Stack Trace.
 */
export function generateFingerprint(error, context = 'Global') {
  const errName = error?.name || (typeof error === 'object' && error !== null ? error.constructor?.name || 'Error' : 'GenericError');
  const rawMsg = typeof error === 'string' ? error : error?.message || String(error || '');
  const cleanMsg = rawMsg
    .replace(/\d{13,}/g, '[TIMESTAMP]')
    .replace(/https?:\/\/[^\s]+/g, '[URL]')
    .trim();
  const normStack = normalizeStackTrace(error?.stack);
  const contextStr = String(context || 'Global').trim();

  const signature = `${errName}::${cleanMsg}::${contextStr}::${normStack}`;
  return `err_${hashString(signature)}`;
}

/**
 * Retrieves all stored error logs from local storage, sorted descending by lastSeen.
 */
export function getStoredLogs() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEYS.ERROR_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Safely persists error logs with memory bounds and quota-exceeded fallback.
 */
export function saveStoredLogs(logs) {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(KEYS.ERROR_LOGS, JSON.stringify(logs));
    return true;
  } catch (err) {
    console.warn('Storage quota warning during error logging, trimming older logs to fit', err);
    try {
      const emergencyTrim = (logs || []).slice(0, 30);
      localStorage.setItem(KEYS.ERROR_LOGS, JSON.stringify(emergencyTrim));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Logs an error into the central repository with automatic deduplication,
 * occurrence counting, metadata gathering, and infinite-loop guarding.
 *
 * @param {Error|string|any} error - The error object or message to log.
 * @param {string} [contextInfo='Global'] - The component or functional area name.
 * @returns {string|null} The unique error fingerprint, or null if skipped.
 */
export function logError(error, contextInfo = 'Global') {
  if (isLoggingInternal) {
    // Guard against recursive logging calls
    return null;
  }

  isLoggingInternal = true;

  try {
    if (!error) return null;

    const fingerprint = generateFingerprint(error, contextInfo);
    const stored = getStoredLogs();
    const existingIndex = stored.findIndex((item) => item && item.fingerprint === fingerprint);
    const nowIso = new Date().toISOString();

    const errName = error?.name || (typeof error === 'object' && error !== null ? error.constructor?.name || 'Error' : 'GenericError');
    const rawMsg = typeof error === 'string' ? error : error?.message || String(error || '');
    const stackStr = error?.stack || (error?.componentStack ? `Component Stack:\n${error.componentStack}` : '');

    const metadata = {
      url: typeof window !== 'undefined' && window.location ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      language: typeof navigator !== 'undefined' ? navigator.language : 'ar',
      screen: typeof window !== 'undefined' && window.screen ? `${window.screen.width}x${window.screen.height}` : '',
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    };

    if (existingIndex >= 0) {
      // Deduplication: Update existing entry in place without adding duplicates
      const existing = stored[existingIndex];
      existing.occurrences = (Number(existing.occurrences) || 1) + 1;
      existing.lastSeen = nowIso;
      if (stackStr && (!existing.stack || existing.stack === 'N/A')) {
        existing.stack = stackStr;
      }
      // Re-order to top (most recently seen)
      stored.splice(existingIndex, 1);
      stored.unshift(existing);
    } else {
      // New distinct error
      const newEntry = {
        fingerprint,
        name: errName,
        message: rawMsg,
        context: String(contextInfo || 'Global'),
        occurrences: 1,
        firstSeen: nowIso,
        lastSeen: nowIso,
        stack: stackStr || 'N/A',
        metadata,
      };
      stored.unshift(newEntry);
    }

    // Rotation Strategy: Keep at most 100 unique errors
    const trimmed = stored.slice(0, 100);
    saveStoredLogs(trimmed);

    // Broadcast update event for reactive diagnostic viewers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app_error_logged', { detail: { fingerprint, total: trimmed.length } }));
    }

    return fingerprint;
  } catch (internalErr) {
    console.error('Fatal internal error inside logError:', internalErr);
    return null;
  } finally {
    isLoggingInternal = false;
  }
}

/**
 * Clears all stored error logs from local storage.
 */
export function clearLogs() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(KEYS.ERROR_LOGS);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app_error_logged', { detail: { total: 0 } }));
  }
  return [];
}

/**
 * Exports all collected logs as a clean, structured JSON string for diagnostics or download.
 */
export function exportLogsAsJson() {
  const logs = getStoredLogs();
  const payload = {
    app: 'HabitTracker_Salat',
    exportedAt: new Date().toISOString(),
    totalUniqueErrors: logs.length,
    totalOccurrences: logs.reduce((sum, item) => sum + (Number(item.occurrences) || 1), 0),
    logs,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Initializes global window.onerror and window.onunhandledrejection listeners.
 */
export function initGlobalErrorListeners() {
  if (typeof window === 'undefined' || listenersInitialized) return;
  listenersInitialized = true;

  window.addEventListener('error', (event) => {
    // Ignore benign cross-origin script errors or image 404s
    if (!event.error && !event.message) return;
    const targetEl = event.target;
    if (targetEl && (targetEl.tagName === 'IMG' || targetEl.tagName === 'SCRIPT' || targetEl.tagName === 'LINK')) {
      return; // Resource load events
    }
    const err = event.error || new Error(event.message || 'Uncaught window error');
    logError(err, 'Window.GlobalError');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason || 'Unhandled Promise Rejection'));
    logError(err, 'UnhandledPromiseRejection');
  });
}
