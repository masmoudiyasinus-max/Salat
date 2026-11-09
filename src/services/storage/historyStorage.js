import { APP_EVENTS } from "../prayerConstants.js";
import { timeToMinutes, toWesternDigits } from "../timeUtils.js";
import { safeSetLocalStorageItem } from "./storageCore.js";
import { KEYS } from "./storageKeys.js";

export function getCurrentObligatoryPrayerId(
	prayerTimes,
	safeNow = new Date(),
) {
	if (
		!prayerTimes ||
		!prayerTimes.Fajr ||
		!prayerTimes.Dhuhr ||
		!prayerTimes.Asr ||
		!prayerTimes.Maghrib ||
		!prayerTimes.Isha
	) {
		return null;
	}

	const currentMins = safeNow.getHours() * 60 + safeNow.getMinutes();
	const fajrMins = timeToMinutes(prayerTimes.Fajr);
	const dhuhrMins = timeToMinutes(prayerTimes.Dhuhr);
	const asrMins = timeToMinutes(prayerTimes.Asr);
	const maghribMins = timeToMinutes(prayerTimes.Maghrib);
	const ishaMins = timeToMinutes(prayerTimes.Isha);

	if (
		fajrMins === -1 ||
		dhuhrMins === -1 ||
		asrMins === -1 ||
		maghribMins === -1 ||
		ishaMins === -1
	) {
		return null;
	}

	if (currentMins >= fajrMins && currentMins < dhuhrMins) {
		return "Fajr";
	}
	if (currentMins >= dhuhrMins && currentMins < asrMins) {
		return "Dhuhr";
	}
	if (currentMins >= asrMins && currentMins < maghribMins) {
		return "Asr";
	}
	if (currentMins >= maghribMins && currentMins < ishaMins) {
		return "Maghrib";
	}
	return "Isha";
}

export function calculateNightTimes(maghribTimeStr, fajrTimeStr) {
	if (
		!maghribTimeStr ||
		!fajrTimeStr ||
		typeof maghribTimeStr !== "string" ||
		typeof fajrTimeStr !== "string" ||
		!maghribTimeStr.includes(":") ||
		!fajrTimeStr.includes(":")
	) {
		return null;
	}

	const [mH, mM] = maghribTimeStr.split(":").map(Number);
	const [fH, fM] = fajrTimeStr.split(":").map(Number);

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
		return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
	};

	const formatMins12 = (mins) => {
		let h = Math.floor(mins / 60);
		const m = mins % 60;
		const period = h >= 12 ? "م" : "ص";
		h = h % 12;
		if (h === 0) h = 12;
		return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
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
	try {
		return JSON.parse(data);
	} catch {
		return [];
	}
}

export function saveNaflRecords(records) {
	safeSetLocalStorageItem(KEYS.NAFL_RECORDS, JSON.stringify(records));
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.NAFL_RECORDS_UPDATED, { detail: records }),
		);
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
	} catch {
		return [];
	}
}

export function saveRecords(records) {
	safeSetLocalStorageItem(KEYS.RECORDS, JSON.stringify(records));
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.RECORDS_UPDATED, { detail: records }),
		);
	}
}

export function clearAllRecords() {
	saveRecords([]);
	saveNaflRecords([]);
	localStorage.removeItem(KEYS.RE_TOGGLE_HISTORY);
	return [];
}

export function upsertRecord(newRecord) {
	const records = getRecords();
	const index = records.findIndex(
		(r) => r.date === newRecord.date && r.prayer_name === newRecord.prayer_name,
	);
	if (index >= 0) {
		records[index] = { ...records[index], ...newRecord };
	} else {
		records.push(newRecord);
	}
	saveRecords(records);
	return records;
}

export function computeSummaryStats(records) {
	if (!Array.isArray(records)) {
		return {
			onTime: 0,
			late: 0,
			qada: 0,
			missed: 0,
			avgDelay: 0,
			maxStreak: 0,
			currentStreak: 0,
		};
	}

	let onTime = 0;
	let late = 0;
	let qada = 0;
	let missed = 0;
	let totalDelay = 0;
	let delayCount = 0;

	const dateGroups = {};
	records.forEach((r) => {
		if (!r) return;
		if (r.status === "on_time") onTime++;
		else if (r.status === "late") late++;
		else if (r.status === "qada") qada++;
		else if (r.status === "missed") missed++;

		if (typeof r.delay_minutes === "number" && r.delay_minutes > 0) {
			totalDelay += r.delay_minutes;
			delayCount++;
		}

		if (r.date) {
			if (!dateGroups[r.date]) dateGroups[r.date] = [];
			dateGroups[r.date].push(r);
		}
	});

	const avgDelay = delayCount > 0 ? Math.round(totalDelay / delayCount) : 0;

	// Chronological ascending sort for daily continuity evaluation
	const sortedDates = Object.keys(dateGroups).sort();
	let tempStreak = 0;
	let maxStreak = 0;
	let prevDateStr = null;

	for (const date of sortedDates) {
		const dayPrayers = dateGroups[date] || [];
		const allOnTime =
			dayPrayers.length >= 5 && dayPrayers.every((p) => p.status === "on_time");

		if (allOnTime) {
			if (prevDateStr) {
				const [y1, m1, d1] = prevDateStr.split("-").map(Number);
				const [y2, m2, d2] = date.split("-").map(Number);
				const utc1 = Date.UTC(y1, m1 - 1, d1);
				const utc2 = Date.UTC(y2, m2 - 1, d2);
				const diffInDays = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));

				if (diffInDays === 1) {
					tempStreak++;
				} else {
					// Gap > 1 day resets streak to 1 for this qualifying day
					tempStreak = 1;
				}
			} else {
				tempStreak = 1;
			}

			prevDateStr = date;
			if (tempStreak > maxStreak) {
				maxStreak = tempStreak;
			}
		} else {
			// Day is recorded but not all on-time -> breaks streak
			tempStreak = 0;
			prevDateStr = null;
		}
	}

	return {
		onTime,
		late,
		qada,
		missed,
		avgDelay,
		maxStreak,
		currentStreak: tempStreak,
	};
}
