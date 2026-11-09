import { OBLIGATORY_PRAYER_IDS } from "./prayerConstants.js";

// Centralized Data Readiness States & Validation Architecture

export const DATA_STATUS = {
	LOADING: "loading",
	UNAVAILABLE: "unavailable",
	READY: "ready",
};

/**
 * Validates a single HH:MM time string format.
 */
export function isValidTimeString(timeStr) {
	if (!timeStr || typeof timeStr !== "string") return false;
	const trimmed = timeStr.trim();
	if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return false;
	const [h, m] = trimmed.split(":").map(Number);
	return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/**
 * Evaluates whether prayer times object is genuinely ready and complete.
 * All 5 obligatory prayers must have valid HH:MM strings.
 */
export function getPrayerTimesStatus(prayerTimes) {
	if (!prayerTimes || typeof prayerTimes !== "object") {
		return DATA_STATUS.UNAVAILABLE;
	}

	const isComplete = OBLIGATORY_PRAYER_IDS.every((pId) =>
		isValidTimeString(prayerTimes[pId]),
	);
	return isComplete ? DATA_STATUS.READY : DATA_STATUS.UNAVAILABLE;
}

/**
 * Evaluates user records readiness state.
 */
export function getRecordsStatus(records) {
	if (!Array.isArray(records)) return DATA_STATUS.UNAVAILABLE;
	return records.length > 0 ? DATA_STATUS.READY : DATA_STATUS.UNAVAILABLE;
}
