import {
	BookOpen,
	CheckCircle,
	Clock,
	CloudSun,
	Lock,
	Moon,
	Sun,
	Sunrise,
	X,
} from "lucide-react";
import { Button, Dialog } from "open-glass-ui";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	resolveTimezoneForLocation,
	TIMEZONE_DEFAULTS,
} from "../services/adhanCalculator";
import { fetchAladhanPrayerTimesForLocation } from "../services/aladhanApiService";
import { DATA_STATUS, getPrayerTimesStatus } from "../services/dataReadiness";
import { getTranslation } from "../services/i18n";
import {
	dispatchMuneerSignal,
	MUNEER_SIGNALS,
} from "../services/muneerSignalService.js";
import { requestFreshLocationFromScratch } from "../services/permissionService";
import {
	APP_EVENTS,
	applyPrayerOffsets,
	calculateNightTimes,
	getCityNowDate,
	getCityTodayDateStr,
	getCurrentObligatoryPrayerId,
	getPrayerTimesCache,
	getRecords,
	KEYS,
	OBLIGATORY_PRAYER_IDS,
	PRAYER_NAMES,
	savePrayerTimesCache,
	saveRecords,
	timeToMinutes,
	toWesternDigits,
	upsertRecord,
} from "../services/storage";
import ActivePrayerHero from "./ActivePrayerHero";
import GlassViewShell from "./layout/GlassViewShell";

const PRAYER_ICONS = {
	Fajr: Sunrise,
	Sunrise: Sun,
	Dhuhr: CloudSun,
	Asr: Sun,
	Maghrib: Moon,
	Isha: Moon,
};

export default function PrayerTrackerView({
	settings,
	onRecordUpdated,
	onNavigateToSettings,
}) {
	const lang = settings?.language || "ar";
	const t = (k, fb) => getTranslation(lang, k, fb);
	const [isLoadingPrayerTimes, setIsLoadingPrayerTimes] = useState(false);
	const [prayerTimes, setPrayerTimes] = useState(() => {
		try {
			const cached = getPrayerTimesCache();
			const browserTz =
				typeof Intl !== "undefined"
					? Intl.DateTimeFormat().resolvedOptions().timeZone
					: "";
			const tzLoc =
				browserTz && TIMEZONE_DEFAULTS && TIMEZONE_DEFAULTS[browserTz]
					? TIMEZONE_DEFAULTS[browserTz]
					: null;
			const effectiveCountry = (
				settings?.country ||
				tzLoc?.country ||
				""
			).trim();
			const effectiveCity = (settings?.city || tzLoc?.city || "").trim();
			const todayStr = getCityTodayDateStr(settings?.timezone || tzLoc?.tz);

			// STRICT: Only use cache if all 5 prayers exist, belongs to Aladhan API, matches today's date and exact city/country
			if (
				cached &&
				effectiveCity &&
				effectiveCountry &&
				cached.lastSyncedDate === todayStr &&
				cached.Fajr &&
				cached.Dhuhr &&
				cached.Asr &&
				cached.Maghrib &&
				cached.Isha &&
				(cached.source || "").includes("Aladhan") &&
				(cached.city || "").toLowerCase() === effectiveCity.toLowerCase() &&
				(cached.country || "").toLowerCase() === effectiveCountry.toLowerCase()
			) {
				return cached;
			}
			return null;
		} catch {
			return null;
		}
	});
	const [records, setRecords] = useState(getRecords);

	// Modal Sub-window State for Obligatory Prayers
	const [activeModalPrayer, setActiveModalPrayer] = useState(null);
	const [customPerformedTime, setCustomPerformedTime] = useState("");
	const [showFridayHadithModal, setShowFridayHadithModal] = useState(false);
	const [isDetectingLocationQuick, setIsDetectingLocationQuick] =
		useState(false);

	const handleQuickAutoDetectLocation = async () => {
		setIsDetectingLocationQuick(true);
		const res = await requestFreshLocationFromScratch((freshData) => {
			if (freshData?.times) {
				setPrayerTimes(freshData.times);
			} else {
				const cached = getPrayerTimesCache();
				if (
					cached &&
					(cached.source || "").includes("Aladhan") &&
					cached.Fajr
				) {
					setPrayerTimes(cached);
				}
			}
		});
		setIsDetectingLocationQuick(false);
		if (!res.success) {
			if (res.error === "denied") {
				alert(
					lang === "en"
						? "Location permission was denied in your browser. Please select your city from Settings."
						: "تم رفض إذن الوصول للموقع في المتصفح، يرجى اختيار مدينتك من شاشة الإعدادات.",
				);
			} else {
				alert(
					lang === "en"
						? "Could not detect live location. Please select your city from Settings."
						: "تعذر استقبال إشارة الموقع المباشرة، يرجى اختيار مدينتك من شاشة الإعدادات.",
				);
			}
		}
	};

	// Selected Date State for Browsing Timeline
	const [selectedDate, setSelectedDate] = useState(() =>
		getCityTodayDateStr(prayerTimes?.timezone),
	);

	// Sync state on external update events
	useEffect(() => {
		const handleRecordsChange = () => setRecords(getRecords());
		const handleTimesChange = (e) => {
			if (e.detail) {
				setPrayerTimes(e.detail);
			} else {
				setPrayerTimes(getPrayerTimesCache());
			}
		};

		window.addEventListener(APP_EVENTS.RECORDS_UPDATED, handleRecordsChange);
		window.addEventListener(APP_EVENTS.PRAYER_TIMES_UPDATED, handleTimesChange);

		return () => {
			window.removeEventListener(
				APP_EVENTS.RECORDS_UPDATED,
				handleRecordsChange,
			);
			window.removeEventListener(
				APP_EVENTS.PRAYER_TIMES_UPDATED,
				handleTimesChange,
			);
		};
	}, []);

	// Update selectedDate when timezone changes
	useEffect(() => {
		const tz =
			prayerTimes?.timezone ||
			resolveTimezoneForLocation(settings?.city, settings?.country);
		if (tz) {
			setSelectedDate(getCityTodayDateStr(tz));
		}
	}, [prayerTimes?.timezone, settings?.city, settings?.country]);

	// Keep system clock in sync
	useEffect(() => {
		const timer = setInterval(() => {
			const tz =
				prayerTimes?.timezone ||
				resolveTimezoneForLocation(settings?.city, settings?.country);
			const currentToday = getCityTodayDateStr(tz);
			setSelectedDate((prev) => {
				if (prev === currentToday) return prev;
				return currentToday;
			});
		}, 60000);
		return () => clearInterval(timer);
	}, [prayerTimes?.timezone, settings?.city, settings?.country]);

	const effectiveTimezone =
		prayerTimes?.timezone ||
		resolveTimezoneForLocation(settings?.city, settings?.country);

	const [nowTime, setNowTime] = useState(() => {
		const d = getCityNowDate(effectiveTimezone);
		return isNaN(d.getTime()) ? new Date() : d;
	});
	const safeNow = useMemo(
		() => (nowTime && !isNaN(nowTime.getTime()) ? nowTime : new Date()),
		[nowTime],
	);

	useEffect(() => {
		const updateClock = () => {
			if (document.hidden) return;
			const cityNow = getCityNowDate(effectiveTimezone);
			setNowTime(isNaN(cityNow.getTime()) ? new Date() : cityNow);
		};
		updateClock();
		const timer = setInterval(updateClock, 1000);
		const handleVisibilityChange = () => {
			if (!document.hidden) updateClock();
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			clearInterval(timer);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [effectiveTimezone]);

	useEffect(() => {
		setRecords(getRecords());
	}, [selectedDate]);

	// Instant Aladhan API fetch & sync whenever location or selected date changes
	useEffect(() => {
		let isMounted = true;
		async function autoCalculatePrayerTimes() {
			const targetDateStr = selectedDate;
			const cached = getPrayerTimesCache();

			const browserTz =
				typeof Intl !== "undefined"
					? Intl.DateTimeFormat().resolvedOptions().timeZone
					: "";
			const tzLoc =
				browserTz && TIMEZONE_DEFAULTS && TIMEZONE_DEFAULTS[browserTz]
					? TIMEZONE_DEFAULTS[browserTz]
					: null;
			const effectiveCountry = (
				settings?.country ||
				tzLoc?.country ||
				""
			).trim();
			const effectiveCity = (settings?.city || tzLoc?.city || "").trim();

			if (!effectiveCity || !effectiveCountry) {
				setPrayerTimes(null);
				setIsLoadingPrayerTimes(false);
				return;
			}

			// 1. Check if cache matches this exact date, city, country and originated from Aladhan API
			if (
				cached &&
				cached.lastSyncedDate === targetDateStr &&
				cached.Fajr &&
				cached.Dhuhr &&
				cached.Asr &&
				cached.Maghrib &&
				cached.Isha &&
				(cached.source || "").includes("Aladhan") &&
				(cached.city || "").toLowerCase() === effectiveCity.toLowerCase() &&
				(cached.country || "").toLowerCase() === effectiveCountry.toLowerCase()
			) {
				setPrayerTimes(cached);
				setIsLoadingPrayerTimes(false);
				return;
			}

			// 2. Clear unverified times & set loading state
			setPrayerTimes(null);
			setIsLoadingPrayerTimes(true);

			// 3. Fetch from Aladhan API Service
			try {
				const res = await fetchAladhanPrayerTimesForLocation(
					effectiveCity,
					effectiveCountry,
					targetDateStr,
				);

				if (isMounted) {
					if (res && res.success && res.times) {
						const now = new Date();
						const hh = String(now.getHours()).padStart(2, "0");
						const mm = String(now.getMinutes()).padStart(2, "0");
						const timeNow = toWesternDigits(`${hh}:${mm}`);

						const mergedTimes = {
							...res.times,
							city: effectiveCity,
							country: effectiveCountry,
							timezone:
								res.timezone ||
								resolveTimezoneForLocation(effectiveCity, effectiveCountry) ||
								"",
							lastSyncedDate: targetDateStr,
							lastSyncedTime: timeNow,
							source: "واجهة Aladhan API الرسمية (api.aladhan.com)",
						};
						setPrayerTimes(mergedTimes);
						savePrayerTimesCache(mergedTimes);
					} else {
						setPrayerTimes(null);
					}
					setIsLoadingPrayerTimes(false);
				}
			} catch (err) {
				console.error("Aladhan API fetch error:", err);
				if (isMounted) {
					setPrayerTimes(null);
					setIsLoadingPrayerTimes(false);
				}
			}
		}

		autoCalculatePrayerTimes();
		return () => {
			isMounted = false;
		};
	}, [settings?.city, settings?.country, selectedDate]);

	const dateRecords = useMemo(
		() =>
			(Array.isArray(records) ? records : []).filter(
				(r) => r && r.date === selectedDate,
			),
		[records, selectedDate],
	);

	// Effective Prayer Times with user-specified offsets applied
	const effectivePrayerTimes = useMemo(
		() => applyPrayerOffsets(prayerTimes, settings?.prayerOffsets),
		[prayerTimes, settings?.prayerOffsets],
	);

	// Live Countup and Countdown Timers Computation for All Islamic Timeline Events (Continuous Rolling Timeline)
	const timerInfo = useMemo(() => {
		if (
			!effectivePrayerTimes?.Fajr ||
			!effectivePrayerTimes?.Sunrise ||
			!effectivePrayerTimes?.Dhuhr ||
			!effectivePrayerTimes?.Asr ||
			!effectivePrayerTimes?.Maghrib ||
			!effectivePrayerTimes?.Isha
		) {
			return {
				currentEvent: null,
				nextEvent: null,
				currentPrayerId: null,
				currentEventLabel: "",
				nextEventLabel: "",
				currentAdhanTime: "",
				nextAdhanTime: "",
				nextEventDate: null,
				prevEventDate: null,
				isRollingCycle: false,
			};
		}

		const parseEventDateTime = (timeStr, dayOffset = 0) => {
			if (!timeStr || !timeStr.includes(":")) return null;
			const [h, m] = timeStr.split(":").map(Number);
			if (isNaN(h) || isNaN(m)) return null;
			const d = new Date(safeNow.getTime());
			d.setDate(d.getDate() + dayOffset);
			d.setHours(h, m, 0, 0);
			return d;
		};

		const buildDailyEvents = (dayOffset) => {
			const pTimes = effectivePrayerTimes || {};
			const fajrT = pTimes.Fajr;
			const sunriseT = pTimes.Sunrise;
			const dhuhrT = pTimes.Dhuhr;
			const asrT = pTimes.Asr;
			const maghribT = pTimes.Maghrib;
			const ishaT = pTimes.Isha;

			if (!fajrT || !sunriseT || !dhuhrT || !asrT || !maghribT || !ishaT) {
				return [];
			}

			const nTimes = calculateNightTimes(maghribT, fajrT);
			const [sH, sM] = sunriseT.split(":").map(Number);
			const duhaTotalM = sH * 60 + sM + 15;
			const duhaH = Math.floor(duhaTotalM / 60) % 24;
			const duhaM = duhaTotalM % 60;
			const duhaT = `${String(duhaH).padStart(2, "0")}:${String(duhaM).padStart(2, "0")}`;

			// Midnight and Last Third date objects calculated relative to Maghrib timestamp
			const maghribDateObj = parseEventDateTime(maghribT, dayOffset);
			if (!maghribDateObj) return [];
			const halfNightMs = Math.floor(
				((nTimes?.nightDurationMinutes || 0) * 60 * 1000) / 2,
			);
			const twoThirdsMs = Math.floor(
				((nTimes?.nightDurationMinutes || 0) * 60 * 1000 * 2) / 3,
			);

			const midnightDateObj = new Date(maghribDateObj.getTime() + halfNightMs);
			const lastThirdDateObj = new Date(maghribDateObj.getTime() + twoThirdsMs);

			return [
				{
					id: "Fajr",
					nameAr: "أذان الفجر",
					labelCountup: "مضى على أذان الفجر",
					labelCountdown: "المتبقي لأذان الفجر",
					dateObj: parseEventDateTime(fajrT, dayOffset),
				},
				{
					id: "Sunrise",
					nameAr: "وقت الشروق",
					labelCountup: "مضى على وقت الشروق",
					labelCountdown: "المتبقي لوقت الشروق",
					dateObj: parseEventDateTime(sunriseT, dayOffset),
				},
				{
					id: "Duha",
					nameAr: "وقت صلاة الضحى",
					labelCountup: "مضى على وقت صلاة الضحى",
					labelCountdown: "المتبقي لوقت صلاة الضحى",
					dateObj: parseEventDateTime(duhaT, dayOffset),
				},
				{
					id: "Dhuhr",
					nameAr: "أذان الظهر",
					labelCountup: "مضى على أذان الظهر",
					labelCountdown: "المتبقي لأذان الظهر",
					dateObj: parseEventDateTime(dhuhrT, dayOffset),
				},
				{
					id: "Asr",
					nameAr: "أذان العصر",
					labelCountup: "مضى على أذان العصر",
					labelCountdown: "المتبقي لأذان العصر",
					dateObj: parseEventDateTime(asrT, dayOffset),
				},
				{
					id: "Maghrib",
					nameAr: "أذان المغرب",
					labelCountup: "مضى على أذان المغرب",
					labelCountdown: "المتبقي لأذان المغرب",
					dateObj: maghribDateObj,
				},
				{
					id: "Isha",
					nameAr: "أذان العشاء",
					labelCountup: "مضى على أذان العشاء",
					labelCountdown: "المتبقي لأذان العشاء",
					dateObj: parseEventDateTime(ishaT, dayOffset),
				},
				{
					id: "Midnight",
					nameAr: "منتصف الليل الشرعي",
					labelCountup: "مضى على منتصف الليل الشرعي",
					labelCountdown: "المتبقي لمنتصف الليل الشرعي",
					dateObj: midnightDateObj,
				},
				{
					id: "LastThird",
					nameAr: "الثلث الأخير",
					labelCountup: "مضى على الثلث الأخير",
					labelCountdown: "المتبقي للثلث الأخير",
					dateObj: lastThirdDateObj,
				},
			];
		};

		const allEvents = [
			...buildDailyEvents(-1),
			...buildDailyEvents(0),
			...buildDailyEvents(1),
		].sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

		let currentEvent = null;
		let nextEvent = null;

		for (let i = 0; i < allEvents.length - 1; i++) {
			if (
				safeNow >= allEvents[i].dateObj &&
				safeNow < allEvents[i + 1].dateObj
			) {
				currentEvent = allEvents[i];
				nextEvent = allEvents[i + 1];
				break;
			}
		}

		if (!currentEvent) {
			currentEvent = allEvents[0];
			nextEvent = allEvents[1] || allEvents[0];
		}

		// Countup Timer: Elapsed since current event
		const elapsedMs = Math.max(
			0,
			safeNow.getTime() - currentEvent.dateObj.getTime(),
		);
		const elapsedSecs = Math.floor(elapsedMs / 1000);
		const elH = Math.floor(elapsedSecs / 3600);
		const elM = Math.floor((elapsedSecs % 3600) / 60);
		const elS = elapsedSecs % 60;
		const countupStr =
			elH > 0
				? `${String(elH).padStart(2, "0")}:${String(elM).padStart(2, "0")}:${String(elS).padStart(2, "0")}`
				: `${String(elM).padStart(2, "0")}:${String(elS).padStart(2, "0")}`;

		// Countdown Timer: Remaining until next event
		const remainingMs = Math.max(
			0,
			nextEvent.dateObj.getTime() - safeNow.getTime(),
		);
		const remainingSecs = Math.floor(remainingMs / 1000);
		const remH = Math.floor(remainingSecs / 3600);
		const remM = Math.floor((remainingSecs % 3600) / 60);
		const remS = remainingSecs % 60;
		const countdownStr =
			remH > 0
				? `${String(remH).padStart(2, "0")}:${String(remM).padStart(2, "0")}:${String(remS).padStart(2, "0")}`
				: `${String(remM).padStart(2, "0")}:${String(remS).padStart(2, "0")}`;

		return {
			currentEventId: currentEvent.id,
			currentEventName: currentEvent.nameAr,
			currentPrayerId: currentEvent.id.replace("_Next", ""),
			currentLabelCountup:
				currentEvent.labelCountup || `مضى على ${currentEvent.nameAr}`,
			currentEventDateObj: currentEvent.dateObj,
			nextEventId: nextEvent.id,
			nextEventName: nextEvent.nameAr,
			nextPrayerId: nextEvent.id.replace("_Next", ""),
			nextLabelCountdown:
				nextEvent.labelCountdown || `المتبقي لـ ${nextEvent.nameAr}`,
			nextEventDateObj: nextEvent.dateObj,
			countupStr: toWesternDigits(countupStr),
			countdownStr: toWesternDigits(countdownStr),
			elapsedSecs,
			remainingSecs,
			remM,
			remS,
			isAfterGracePeriod:
				elapsedSecs > (settings?.gracePeriodMinutes ?? 15) * 60,
			isPast30Minutes: elapsedSecs > 30 * 60,
		};
	}, [safeNow, effectivePrayerTimes, settings?.gracePeriodMinutes]);

	const calculateDelay = (adhanTimeStr, performedTimeStr) => {
		if (!adhanTimeStr || !performedTimeStr) return 0;
		const [aH, aM] = adhanTimeStr.split(":").map(Number);
		const [pH, pM] = performedTimeStr.split(":").map(Number);

		const adhanMinutes = aH * 60 + aM;
		const performedMinutes = pH * 60 + pM;

		let diff = performedMinutes - adhanMinutes;
		if (diff < 0) diff += 1440;
		return diff;
	};

	// Lock check: Disable access ONLY if prayer adhan time has not arrived yet today
	const isPrayerTimeArrived = useCallback(
		(adhanTimeStr) => {
			if (!adhanTimeStr) return true;
			if (selectedDate < getCityTodayDateStr(prayerTimes?.timezone))
				return true; // Past dates are ALWAYS unlocked!
			const timeMins = timeToMinutes(adhanTimeStr);
			if (timeMins === -1) return true;
			const currentMins = safeNow.getHours() * 60 + safeNow.getMinutes();
			return currentMins >= timeMins;
		},
		[selectedDate, prayerTimes?.timezone, safeNow],
	);

	// Check if next prayer adhan time (or Sunrise for Fajr) has arrived
	const isNextPrayerTimeArrived = useCallback(
		(currentPrayerId) => {
			if (
				selectedDate <
				getCityTodayDateStr(
					effectivePrayerTimes?.timezone || prayerTimes?.timezone,
				)
			)
				return true; // Past dates always considered next prayer arrived!
			if (!effectivePrayerTimes) return false;

			switch (currentPrayerId) {
				case "Fajr": {
					const sunriseTime = effectivePrayerTimes?.Sunrise;
					return sunriseTime ? isPrayerTimeArrived(sunriseTime) : false;
				}
				case "Dhuhr":
					return isPrayerTimeArrived(effectivePrayerTimes?.Asr);
				case "Asr":
					return isPrayerTimeArrived(effectivePrayerTimes?.Maghrib);
				case "Maghrib":
					return isPrayerTimeArrived(effectivePrayerTimes?.Isha);
				case "Isha":
					// Isha window continues overnight until tomorrow's Fajr.
					// On today's calendar date, next day's Fajr has not arrived yet.
					return false;
				default:
					return false;
			}
		},
		[
			selectedDate,
			effectivePrayerTimes,
			prayerTimes?.timezone,
			isPrayerTimeArrived,
		],
	);

	// Automatic Real-Time Status Determination
	const getAutoEvaluatedStatus = useCallback(
		(prayerId, adhanTimeStr) => {
			const rec = dateRecords.find((r) => r.prayer_name === prayerId);
			const isToday = true;

			// 1. If recorded status exists in saved data, use it!
			if (rec && rec.status) {
				return rec.status;
			}

			// 2. If prayer adhan time has not arrived yet today -> unarrived
			if (isToday && !isPrayerTimeArrived(adhanTimeStr)) {
				return "unarrived";
			}

			const nextArrived = isNextPrayerTimeArrived(prayerId);

			// 3. If next prayer adhan has arrived and user did NOT record it -> missed
			if (!isToday || nextArrived) {
				return "missed";
			}

			// 4. Prayer window is currently active and user HAS NOT recorded it yet -> unperformed (none)
			return "none";
		},
		[dateRecords, isPrayerTimeArrived, isNextPrayerTimeArrived],
	);

	// Automatic Real-Time Persistence Evaluator & Stale Cleanup for TRULY Missed Prayers
	useEffect(() => {
		if (!effectivePrayerTimes) return;
		let updated = false;

		const isToday = true;
		const currentRecords = getRecords();

		// 1. Clean premature missed records ONLY for obligatory prayers today
		const cleanedRecords = currentRecords.filter((r) => {
			const isObligatory = PRAYER_NAMES.some((p) => p.id === r.prayer_name);
			if (isObligatory && r.date === selectedDate && r.status === "missed") {
				const nextArrived = isNextPrayerTimeArrived(r.prayer_name);
				if (!nextArrived) {
					updated = true;
					return false; // Remove premature missed record for active prayer!
				}
			}
			return true;
		});

		// 2. Persist truly missed prayers (after next prayer adhan arrives or past date)
		PRAYER_NAMES.forEach((p) => {
			const timeStr = effectivePrayerTimes[p.id];
			if (!timeStr) return;

			const hasArrived = isPrayerTimeArrived(timeStr);
			const nextArrived = isNextPrayerTimeArrived(p.id);

			if (!isToday || (hasArrived && nextArrived)) {
				const rec = cleanedRecords.find(
					(r) => r.date === selectedDate && r.prayer_name === p.id,
				);
				if (!rec) {
					cleanedRecords.push({
						date: selectedDate,
						prayer_name: p.id,
						adhan_time: timeStr,
						performed_time: "",
						delay_minutes: 0,
						status: "missed",
					});
					updated = true;
				}
			}
		});

		if (updated) {
			saveRecords(cleanedRecords);
			setRecords([...cleanedRecords]);
		}
	}, [
		selectedDate,
		effectivePrayerTimes,
		isNextPrayerTimeArrived,
		isPrayerTimeArrived,
	]);

	// Persistent Re-toggle History Manager (track: performed -> cancelled -> re-performed)
	const getToggleHistory = () => {
		try {
			const raw =
				localStorage.getItem(KEYS.RE_TOGGLE_HISTORY) ||
				localStorage.getItem("prayer_re_toggle_history");
			return raw ? JSON.parse(raw) : {};
		} catch {
			return {};
		}
	};

	const saveToggleHistory = (historyObj) => {
		try {
			localStorage.setItem(KEYS.RE_TOGGLE_HISTORY, JSON.stringify(historyObj));
		} catch {}
	};

	const isReToggleLocked = (prayerId) => {
		const rec = dateRecords.find((r) => r.prayer_name === prayerId);
		if (!rec || rec.status === "missed") return false;
		const key = `${selectedDate}_${prayerId}`;
		const history = getToggleHistory();
		const count = history[key] || 0;
		return Boolean(rec.is_final_locked || count >= 2);
	};

	// Helper to check if a prayer status is missed and locked
	const isMissedAndLocked = (prayerId) => {
		if (!prayerTimes || !prayerTimes[prayerId]) return false;
		const rec = dateRecords.find((r) => r.prayer_name === prayerId);
		const status = getAutoEvaluatedStatus(prayerId, prayerTimes[prayerId]);
		return (rec && rec.status === "missed") || status === "missed";
	};

	const handleMarkPerformed = (
		prayerId,
		timeOverride = "",
		customStatus = null,
	) => {
		const adhanTime = prayerTimes ? prayerTimes[prayerId] : null;
		if (!adhanTime || !isPrayerTimeArrived(adhanTime)) return;

		if (isMissedAndLocked(prayerId)) {
			alert(
				lang === "en"
					? "This prayer was recorded as missed and cannot be modified according to strict commitment rules."
					: "هذه الصلاة سُجّلت كمتروكة ولا يمكن تعديل بياناتها وفقاً لقواعد الالتزام الصارمة.",
			);
			return;
		}

		if (isReToggleLocked(prayerId)) {
			return;
		}

		const toggleKey = `${selectedDate}_${prayerId}`;
		const history = getToggleHistory();
		const newCount = (history[toggleKey] || 0) + 1;
		history[toggleKey] = newCount;
		saveToggleHistory(history);

		const now = new Date();
		const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
		const performedHHMM = timeOverride || currentHHMM;

		const delay = calculateDelay(adhanTime, performedHHMM);
		const grace = settings?.gracePeriodMinutes ?? 15;

		const status = customStatus || (delay <= grace ? "on_time" : "late");

		const newRec = {
			date: selectedDate,
			prayer_name: prayerId,
			adhan_time: adhanTime,
			performed_time: performedHHMM,
			delay_minutes: delay,
			status: status,
			is_final_locked: newCount >= 2,
		};

		const updated = upsertRecord(newRec);
		setRecords([...updated]);
		if (onRecordUpdated) onRecordUpdated();

		const todayOblRecords = updated.filter(
			(r) =>
				r.date === selectedDate &&
				OBLIGATORY_PRAYER_IDS.includes(r.prayer_name) &&
				(r.status === "on_time" || r.status === "late"),
		);
		if (todayOblRecords.length === 5) {
			dispatchMuneerSignal(MUNEER_SIGNALS.ALL_PRAYERS_COMPLETED_TODAY);
		}
	};

	const prayerTimesStatus = getPrayerTimesStatus(effectivePrayerTimes);
	const isDataReady = prayerTimesStatus === DATA_STATUS.READY;

	const modalPrayerInfo = activeModalPrayer
		? PRAYER_NAMES.find((p) => p.id === activeModalPrayer)
		: null;
	const modalRec = activeModalPrayer
		? dateRecords.find((r) => r.prayer_name === activeModalPrayer)
		: null;
	const modalHasArrived =
		activeModalPrayer &&
		effectivePrayerTimes &&
		effectivePrayerTimes[activeModalPrayer]
			? isPrayerTimeArrived(effectivePrayerTimes[activeModalPrayer])
			: false;
	const ModalIconComp = activeModalPrayer
		? PRAYER_ICONS[activeModalPrayer] || Clock
		: Clock;

	const oblList = OBLIGATORY_PRAYER_IDS;
	const activeObligatoryId = isDataReady
		? getCurrentObligatoryPrayerId(effectivePrayerTimes, safeNow)
		: null;
	const activePrayerObj = activeObligatoryId
		? PRAYER_NAMES.find((p) => p.id === activeObligatoryId)
		: null;
	const activeAdhanStr =
		(isDataReady &&
			activeObligatoryId &&
			effectivePrayerTimes[activeObligatoryId]) ||
		"";
	const activeRec = (dateRecords || []).find(
		(r) => r.prayer_name === activeObligatoryId,
	);
	const activeStatus =
		activeRec?.status ||
		(activeObligatoryId && activeAdhanStr
			? getAutoEvaluatedStatus(activeObligatoryId, activeAdhanStr)
			: null);

	const currentOblIndex = activeObligatoryId
		? oblList.indexOf(activeObligatoryId)
		: -1;
	const nextOblId =
		currentOblIndex >= 0
			? currentOblIndex < oblList.length - 1
				? oblList[currentOblIndex + 1]
				: "Fajr"
			: null;
	const nextPrayerObj = nextOblId
		? PRAYER_NAMES.find((p) => p.id === nextOblId)
		: null;
	const nextAdhanStr =
		(isDataReady && nextOblId && effectivePrayerTimes[nextOblId]) || "";

	// Compute precise Date objects for active & next obligatory prayer adhans
	const parsePrayerDateTime = (timeStr, dayOffset = 0) => {
		if (!timeStr || !timeStr.includes(":")) return null;
		const [h, m] = timeStr.split(":").map(Number);
		if (isNaN(h) || isNaN(m)) return null;
		const d = new Date(safeNow.getTime());
		d.setDate(d.getDate() + dayOffset);
		d.setHours(h, m, 0, 0);
		return d;
	};

	let currentOblDateObj =
		isDataReady && activeAdhanStr
			? parsePrayerDateTime(activeAdhanStr, 0)
			: null;
	if (
		currentOblDateObj &&
		activeObligatoryId === "Isha" &&
		safeNow < currentOblDateObj
	) {
		currentOblDateObj = parsePrayerDateTime(activeAdhanStr, -1);
	}

	let nextOblDateObj =
		isDataReady && nextAdhanStr ? parsePrayerDateTime(nextAdhanStr, 0) : null;
	if (nextOblDateObj && nextOblDateObj <= safeNow) {
		nextOblDateObj = parsePrayerDateTime(nextAdhanStr, 1);
	}

	const isActiveCompleted = Boolean(
		activeRec &&
			(activeStatus === "on_time" ||
				activeStatus === "late" ||
				activeStatus === "qada"),
	);

	return (
		<GlassViewShell width="wide" className="prayer-tracker-view">
			{/* 1. Cohesive Active Prayer Hero Component (Reception, Clock, Streak, Countdown, Progress Bar, & Actions) */}
			<ActivePrayerHero
				isDataReady={isDataReady}
				prayerTimes={effectivePrayerTimes}
				settings={settings}
				selectedDate={selectedDate}
				activeObligatoryId={activeObligatoryId}
				activePrayerObj={activePrayerObj}
				activeAdhanStr={activeAdhanStr}
				isActiveCompleted={isActiveCompleted}
				activeRec={activeRec}
				activeStatus={activeStatus}
				nextOblId={nextOblId}
				nextPrayerObj={nextPrayerObj}
				nextAdhanStr={nextAdhanStr}
				currentOblDateObj={currentOblDateObj}
				nextOblDateObj={nextOblDateObj}
				timerInfo={timerInfo}
				isNextPrayerTimeArrived={isNextPrayerTimeArrived}
				isMissedAndLocked={isMissedAndLocked}
				isReToggleLocked={isReToggleLocked}
				getToggleHistory={getToggleHistory}
				saveToggleHistory={saveToggleHistory}
				onRecordUpdated={onRecordUpdated}
				setRecords={setRecords}
				handleMarkPerformed={handleMarkPerformed}
				onOpenModal={(pId) => setActiveModalPrayer(pId)}
				onQuickAutoDetect={handleQuickAutoDetectLocation}
				isDetectingLocation={isDetectingLocationQuick || isLoadingPrayerTimes}
				onNavigateToSettings={onNavigateToSettings}
				t={t}
			/>

			{/* Frosted Glass Sub-Window Modal for Obligatory Prayers */}
			{activeModalPrayer && (
				<Dialog
					open={Boolean(activeModalPrayer)}
					onOpenChange={(open) => !open && setActiveModalPrayer(null)}
					title={
						settings?.language === "en"
							? `Set Performed Time for ${t(activeModalPrayer, modalPrayerInfo?.nameAr)}`
							: `تحديد وقت أداء صلاة ${modalPrayerInfo?.nameAr}`
					}
					closeOnBackdrop={true}
				>
					{(() => {
						const adhanT =
							(effectivePrayerTimes &&
								effectivePrayerTimes[activeModalPrayer]) ||
							"";
						const now = new Date();
						const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

						const inputTime =
							customPerformedTime ||
							modalRec?.performed_time ||
							currentHHMM;
						const isFutureTime = inputTime > currentHHMM;
						const isBeforeAdhanTime = inputTime < adhanT;
						const isInvalidTime = isFutureTime || isBeforeAdhanTime;
						const isLocked =
							isMissedAndLocked(activeModalPrayer) ||
							isReToggleLocked(activeModalPrayer);

						return (
							<div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "8px" }}>
								{!modalHasArrived ? (
									<div
										style={{
											backgroundColor: "rgba(255, 255, 255, 0.04)",
											color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.7))",
											padding: "14px",
											borderRadius: "12px",
											border: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.15))",
											textAlign: "center",
											fontSize: "0.9rem",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											gap: "8px",
										}}
									>
										<Lock size={16} />
										<span>
											{settings?.language === "en"
												? "The prayer time has not arrived yet today."
												: "لم يحن وقت أذان هذه الصلاة بعد اليوم."}
										</span>
									</div>
								) : isLocked ? (
									<div
										style={{
											backgroundColor: "rgba(239, 68, 68, 0.1)",
											color: "#ef4444",
											border: "1px solid rgba(239, 68, 68, 0.3)",
											padding: "14px",
											borderRadius: "12px",
											fontSize: "0.88rem",
											fontWeight: "700",
											textAlign: "center",
										}}
									>
										{settings?.language === "en"
											? "This prayer is marked as missed or locked, performed time cannot be modified."
											: "سُجّلت هذه الصلاة كمتروكة أو مقفلة نهائياً، ولا يمكن تعديل وقت أدائها."}
									</div>
								) : (
									<>
										<div
											style={{
												backgroundColor: "rgba(255, 255, 255, 0.04)",
												padding: "10px 14px",
												borderRadius: "10px",
												fontSize: "0.86rem",
												color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.75))",
												display: "flex",
												alignItems: "center",
												justifyContent: "space-between",
											}}
										>
											<span>
												{settings?.language === "en"
													? "Today's Adhan Time:"
													: "وقت أذان الصلاة اليوم:"}
											</span>
											<strong style={{ color: "#ffffff", fontFamily: "monospace" }}>
												{toWesternDigits(adhanT)}
											</strong>
										</div>

										<div>
											<label
												style={{
													display: "block",
													fontSize: "0.85rem",
													color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.75))",
													marginBottom: "8px",
												}}
											>
												{settings?.language === "en"
													? "Actual time performed (HH:MM)"
													: "الوقت الفعلي الذي صليت فيه الصلاة (ساعة : دقيقة)"}
											</label>
											<input
												type="time"
												value={inputTime}
												onChange={(e) => setCustomPerformedTime(e.target.value)}
												style={{
													width: "100%",
													padding: "12px",
													fontSize: "1.1rem",
													fontWeight: "700",
													fontFamily: "monospace",
													textAlign: "center",
													borderRadius: "10px",
													backgroundColor: "rgba(255, 255, 255, 0.08)",
													border: `1px solid ${isInvalidTime ? "#ef4444" : "var(--ogui-hairline, rgba(255, 255, 255, 0.2))"}`,
													color: "#ffffff",
												}}
											/>
										</div>

										{isBeforeAdhanTime && (
											<div style={{ color: "#ef4444", fontSize: "0.82rem", textAlign: "center" }}>
												{settings?.language === "en"
													? `Cannot select a time before adhan (${toWesternDigits(adhanT)})`
													: `غير مسموح باختيار وقت قبل أذان الصلاة (وقت الأذان هو ${toWesternDigits(adhanT)})`}
											</div>
										)}

										{isFutureTime && (
											<div style={{ color: "#ef4444", fontSize: "0.82rem", textAlign: "center" }}>
												{settings?.language === "en"
													? `Cannot select a time in the future (Current time: ${toWesternDigits(currentHHMM)})`
													: `غير مسموح باختيار وقت في المستقبل (الوقت الحالي هو ${toWesternDigits(currentHHMM)})`}
											</div>
										)}

										<div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
											<Button
												variant="secondary"
												onClick={() => setActiveModalPrayer(null)}
											>
												{settings?.language === "en" ? "Cancel" : "إلغاء"}
											</Button>
											<Button
												variant="primary"
												disabled={isInvalidTime}
												leadingIcon={<CheckCircle size={18} />}
												onClick={() => {
													if (isInvalidTime) return;
													const delay = calculateDelay(adhanT, inputTime);
													const grace = settings?.gracePeriodMinutes ?? 15;
													const status = delay <= grace ? "on_time" : "late";
													handleMarkPerformed(
														activeModalPrayer,
														inputTime,
														status,
													);
													setActiveModalPrayer(null);
													setCustomPerformedTime("");
												}}
											>
												{settings?.language === "en"
													? "Save Performed Time"
													: "تسجيل الوقت المعتمد للأداء"}
											</Button>
										</div>
									</>
								)}
							</div>
						);
					})()}
				</Dialog>
			)}

			{/* Friday Sa'at al-Ijabah Hadith Modal */}
			{showFridayHadithModal && (
				<Dialog
					open={showFridayHadithModal}
					onOpenChange={(open) => !open && setShowFridayHadithModal(false)}
					title={
						settings?.language === "en"
							? "Virtue of the Hour of Response on Friday"
							: "فضـل ساعـة الإجابـة يـوم الجمعـة"
					}
					closeOnBackdrop={true}
				>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "18px",
							textAlign: settings?.language === "en" ? "left" : "right",
							paddingTop: "8px",
						}}
					>
						<div
							style={{
								background: "rgba(255, 255, 255, 0.04)",
								padding: "20px 22px",
								borderRadius: "16px",
								border: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.15))",
							}}
						>
							<div
								style={{
									fontSize: "0.86rem",
									color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.7))",
									fontWeight: "700",
									marginBottom: "10px",
								}}
							>
								{settings?.language === "en"
									? "Hadith of Abu Hurairah (may Allah be pleased with him):"
									: "حديث أبي هريرة رضي الله عنه:"}
							</div>
							<p
								className="religious-text"
								style={{
									margin: 0,
									fontSize: "1.25rem",
									color: "#ffffff",
									lineHeight: 1.7,
									textAlign: "justify",
									direction: "rtl",
								}}
							>
								عن النبي صلى الله عليه وسلم قال: «يومُ الجمعةِ اثنتا عشرةَ
								ساعةً، لا يوجد فيها عبدٌ مسلمٌ يسألُ اللهَ عزَّ وجلَّ شيئًا إلا آتاه
								إياه، فالتمِسوها آخرَ ساعةٍ بعد صلاةِ العصرِ»
							</p>
							<div
								style={{
									fontSize: "0.8rem",
									color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.7))",
									marginTop: "10px",
									display: "flex",
									alignItems: "center",
									gap: "6px",
									fontWeight: "600",
								}}
							>
								<BookOpen size={14} style={{ color: "var(--status-on-time)" }} />
								<span>
									{settings?.language === "en"
										? "Narrated by Abu Dawood and An-Nasa'i • Authenticated by Al-Albani"
										: "رواه أبو داود والنسائي • صححه الألباني"}
								</span>
							</div>
						</div>

						<div
							style={{
								background: "rgba(255, 255, 255, 0.04)",
								padding: "20px 22px",
								borderRadius: "16px",
								border: "1px solid var(--ogui-hairline, rgba(255, 255, 255, 0.15))",
							}}
						>
							<div
								style={{
									fontSize: "0.86rem",
									color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.7))",
									fontWeight: "700",
									marginBottom: "10px",
								}}
							>
								{settings?.language === "en"
									? "Hadith of Jabir ibn Abdillah (may Allah be pleased with both):"
									: "حديث جابر بن عبد الله رضي الله عنهما:"}
							</div>
							<p
								className="religious-text"
								style={{
									margin: 0,
									fontSize: "1.25rem",
									color: "#ffffff",
									lineHeight: 1.7,
									textAlign: "justify",
									direction: "rtl",
								}}
							>
								عن النبي صلى الله عليه وسلم قال: «يومُ الجمعةِ اثنتا عشرةَ
								ساعةً، فيها ساعةٌ لا يوجد مسلمٌ يسألُ اللهَ عزَّ وجلَّ فيها شيئًا إلا
								أعطاهُ، فالتمسوها آخرَ ساعةٍ بعد العصرِ»
							</p>
							<div
								style={{
									fontSize: "0.8rem",
									color: "var(--ogui-color-muted, rgba(255, 255, 255, 0.7))",
									marginTop: "10px",
									display: "flex",
									alignItems: "center",
									gap: "6px",
									fontWeight: "600",
								}}
							>
								<BookOpen size={14} style={{ color: "var(--status-on-time)" }} />
								<span>
									{settings?.language === "en"
										? "Narrated by Abu Dawood and An-Nasa'i • Authenticated by Al-Hakim"
										: "رواه أبو داود والنسائي • صححه الحاكم"}
								</span>
							</div>
						</div>

						<div style={{ display: "flex", justifyContent: "flex-end" }}>
							<Button variant="primary" size="small" onClick={() => setShowFridayHadithModal(false)}>
								{settings?.language === "en" ? "Close" : "إغلاق"}
							</Button>
						</div>
					</div>
				</Dialog>
			)}
		</GlassViewShell>
	);
}
