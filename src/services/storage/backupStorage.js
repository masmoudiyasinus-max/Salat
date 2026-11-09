import { APP_EVENTS } from "../prayerConstants.js";
import {
	getActiveSessionId,
	getChatSessions,
	saveActiveSessionId,
	saveChatSessions,
} from "./chatStorage.js";
import {
	clearAllRecords,
	getNaflRecords,
	getRecords,
	saveNaflRecords,
	saveRecords,
} from "./historyStorage.js";
import {
	getPrayerTimesCache,
	savePrayerTimesCache,
} from "./scheduleCacheStorage.js";
import { getSettings, saveSettings } from "./settingsStorage.js";
import { KEYS } from "./storageKeys.js";

export function exportFullUserDataJSON() {
	const payload = {
		version: 1,
		app: "HabitTracker_Salat",
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
	if (!jsonString || typeof jsonString !== "string") {
		throw new Error("ملف النسخة الاحتياطية فارغ أو غير صالح");
	}

	const data = JSON.parse(jsonString);
	if (!data || typeof data !== "object") {
		throw new Error("تنسيق النسخة الاحتياطية غير متوافق");
	}

	if (data.settings && typeof data.settings === "object") {
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
	if (data.activeSessionId && typeof data.activeSessionId === "string") {
		saveActiveSessionId(data.activeSessionId);
	}
	if (data.cachedTimes && typeof data.cachedTimes === "object") {
		savePrayerTimesCache(data.cachedTimes);
	}

	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.RECORDS_UPDATED, { detail: getRecords() }),
		);
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.NAFL_RECORDS_UPDATED, {
				detail: getNaflRecords(),
			}),
		);
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.SETTINGS_UPDATED, { detail: getSettings() }),
		);
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.PRAYER_TIMES_UPDATED, {
				detail: getPrayerTimesCache(),
			}),
		);
	}

	return true;
}

const APP_INDEXED_DATABASES = ["HabitTracker_BooksDB", "HabitTracker_AudioDB"];

const APP_STORAGE_PREFIXES = [
	"bg_rejected_imgs_",
	"active_bg_",
	"prayer_tracker_",
	"habit_tracker_",
	"muneer_",
	"prayer_",
];

/**
 * Purge IndexedDB databases for complete local-first privacy hygiene.
 * Each database deletion is wrapped in its own isolated error boundary to guarantee
 * that an active lock or runtime exception in one never halts the purging of others.
 */
function cleanupIndexedDatabases() {
	const idb =
		(typeof window !== "undefined" && window.indexedDB) ||
		(typeof globalThis !== "undefined" && globalThis.indexedDB);
	if (idb && typeof idb.deleteDatabase === "function") {
		for (const dbName of APP_INDEXED_DATABASES) {
			try {
				idb.deleteDatabase(dbName);
			} catch {
				// Isolated error boundary per database
			}
		}
	}
}

export function clearEntireAppData() {
	clearAllRecords();

	const storage =
		(typeof window !== "undefined" && window.localStorage) ||
		(typeof globalThis !== "undefined" && globalThis.localStorage) ||
		(typeof localStorage !== "undefined" ? localStorage : null);

	if (storage) {
		Object.values(KEYS).forEach((k) => {
			try {
				storage.removeItem(k);
			} catch {
				// Safe fallback
			}
		});

		try {
			storage.removeItem("prayer_re_toggle_history");
		} catch {
			// Safe fallback
		}

		Object.keys(storage).forEach((k) => {
			if (APP_STORAGE_PREFIXES.some((prefix) => k.startsWith(prefix))) {
				try {
					storage.removeItem(k);
				} catch {
					// Safe fallback
				}
			}
		});
	}

	cleanupIndexedDatabases();

	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.RECORDS_UPDATED, { detail: [] }),
		);
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.NAFL_RECORDS_UPDATED, { detail: [] }),
		);
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.SETTINGS_UPDATED, { detail: getSettings() }),
		);
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.PRAYER_TIMES_UPDATED, {
				detail: getPrayerTimesCache(),
			}),
		);
	}
}

/**
 * Full user data reset alias ensuring complete local-first privacy hygiene.
 */
export function clearAllUserData() {
	clearEntireAppData();
}
