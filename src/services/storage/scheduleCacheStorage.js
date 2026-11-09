import { APP_EVENTS } from "../prayerConstants.js";
import { safeSetLocalStorageItem } from "./storageCore.js";
import { KEYS } from "./storageKeys.js";

export const DEFAULT_PRAYER_TIMES = {
	Fajr: "",
	Sunrise: "",
	Dhuhr: "",
	Asr: "",
	Maghrib: "",
	Isha: "",
};

export function getPrayerTimesCache() {
	const data = localStorage.getItem(KEYS.TIMES);
	if (!data) return DEFAULT_PRAYER_TIMES;
	try {
		return JSON.parse(data);
	} catch {
		return DEFAULT_PRAYER_TIMES;
	}
}

export function savePrayerTimesCache(times) {
	safeSetLocalStorageItem(KEYS.TIMES, JSON.stringify(times));
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.PRAYER_TIMES_UPDATED, { detail: times }),
		);
	}
}

export function getSourceScheduleCache() {
	const data = localStorage.getItem(KEYS.SOURCE_SCHEDULE);
	if (!data) return null;
	try {
		const parsed = JSON.parse(data);
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}

export function saveSourceScheduleCache(scheduleData) {
	if (!scheduleData || typeof scheduleData !== "object") return;
	safeSetLocalStorageItem(KEYS.SOURCE_SCHEDULE, JSON.stringify(scheduleData));
}
