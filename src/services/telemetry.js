import * as Sentry from '@sentry/react';

// Central local storage key for deduplicated telemetry logs
export const LOCAL_STORAGE_KEY = 'app_telemetry_errors_v1';

/**
 * Saves or updates an error in the local queue with strict deduplication (0 duplicates).
 */
export function saveErrorToLocalQueue(event) {
  try {
    const existingLogs = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    const fingerprint = Array.isArray(event.fingerprint)
      ? event.fingerprint.join('::')
      : (typeof event.fingerprint === 'string' ? event.fingerprint : (event.message || 'Unknown'));

    const existingIndex = existingLogs.findIndex((item) => item.fingerprint === fingerprint);
    const timestamp = new Date().toISOString();

    if (existingIndex > -1) {
      // Deduplicate: increment occurrences count on the existing record only
      existingLogs[existingIndex].occurrences = (existingLogs[existingIndex].occurrences || 1) + 1;
      existingLogs[existingIndex].lastSeen = timestamp;
    } else {
      // First occurrence: prepend clean record
      existingLogs.unshift({
        fingerprint,
        message: event.message || event.exception?.values?.[0]?.value || 'Unknown Error',
        context: event.tags || event.extra || {},
        occurrences: 1,
        firstSeen: timestamp,
        lastSeen: timestamp,
      });
    }

    // Keep the most recent 50 unique error signatures
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existingLogs.slice(0, 50)));
  } catch (e) {
    console.error('فشل حفظ الخطأ في السجل المحلي للرصد:', e);
  }
}

/**
 * Retrieves all locally logged unique errors from the queue.
 */
export function getLocalErrorLogs() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Clears the local error telemetry queue.
 */
export function clearLocalErrorLogs() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear local error logs:', e);
  }
}

/**
 * Initializes Sentry / GlitchTip React telemetry engine with deduplication.
 */
export function initTelemetry() {
  try {
    const dsn = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_GLITCHTIP_DSN || '') : '';

    Sentry.init({
      dsn: dsn,
      tracesSampleRate: 1.0,
      autoSessionTracking: false,
      // Automatic error fingerprinting and local deduplication
      beforeSend(event, hint) {
        const error = hint?.originalException;
        if (error && typeof error === 'object') {
          const name = error.name || 'Error';
          const msg = error.message || String(error);
          event.fingerprint = [name, msg];
        } else if (typeof error === 'string') {
          event.fingerprint = ['Error', error];
        }

        saveErrorToLocalQueue(event);
        return event;
      },
    });
  } catch (err) {
    console.warn('Telemetry initialization notice:', err);
  }
}

export { Sentry };
