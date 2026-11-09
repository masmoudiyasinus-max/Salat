// Centralized Proactive AI Signal & Behavior Sensing Engine for Sheikh Muneer

import { sendMuneerSignalPrompt } from "./geminiApi.js";
import { APP_EVENTS } from "./prayerConstants.js";
import { getSettings } from "./storage.js";
import { getCityTodayDateStr, toWesternDigits } from "./timeUtils.js";

export const MUNEER_SIGNALS = {
	PRAYER_EXPIRY_RISK: "PRAYER_EXPIRY_RISK",
	RAPID_TAB_NAVIGATION: "RAPID_TAB_NAVIGATION",
	RAPID_BOOK_FLIPPING: "RAPID_BOOK_FLIPPING",
	RAPID_TASBEEH: "RAPID_TASBEEH",
	RAPID_BACKGROUND_SWITCHING: "RAPID_BACKGROUND_SWITCHING",
	DAILY_WARD_COMPLETED: "DAILY_WARD_COMPLETED",
	ALL_PRAYERS_COMPLETED_TODAY: "ALL_PRAYERS_COMPLETED_TODAY",
};

// Priority Tiers for Sheikh Muneer Notifications
export const SIGNAL_PRIORITIES = {
	CRITICAL: "CRITICAL", // e.g. PRAYER_EXPIRY_RISK (مخاطر تفويت الصلاة - تحذير دائم عند الخطر)
	MILESTONE: "MILESTONE", // e.g. DAILY_WARD_COMPLETED, ALL_PRAYERS_COMPLETED_TODAY (إنجازات)
	ADVISORY_SPEED: "ADVISORY_SPEED", // e.g. RAPID_* (رسائل التنبيه من السرعة - مرة واحدة في اليوم فقط)
};

export const SPEED_SIGNALS = new Set([
	MUNEER_SIGNALS.RAPID_TAB_NAVIGATION,
	MUNEER_SIGNALS.RAPID_BOOK_FLIPPING,
	MUNEER_SIGNALS.RAPID_TASBEEH,
	MUNEER_SIGNALS.RAPID_BACKGROUND_SWITCHING,
]);

// Cooldown configuration in milliseconds (prevents user spam and redundant triggers)
export const SIGNAL_COOLDOWNS = {
	[MUNEER_SIGNALS.PRAYER_EXPIRY_RISK]: 15 * 60 * 1000, // 15 mins
	[MUNEER_SIGNALS.RAPID_TAB_NAVIGATION]: 60 * 1000, // 60s
	[MUNEER_SIGNALS.RAPID_BOOK_FLIPPING]: 60 * 1000, // 60s
	[MUNEER_SIGNALS.RAPID_TASBEEH]: 60 * 1000, // 60s
	[MUNEER_SIGNALS.RAPID_BACKGROUND_SWITCHING]: 60 * 1000, // 60s
	[MUNEER_SIGNALS.DAILY_WARD_COMPLETED]: 60 * 60 * 1000, // 1 hour
	[MUNEER_SIGNALS.ALL_PRAYERS_COMPLETED_TODAY]: 60 * 60 * 1000, // 1 hour
};

const SPEED_ALERT_STORAGE_KEY = "muneer_last_speed_alert_date";
let inMemorySpeedAlertDate = "";

export function getStoredSpeedAlertDate() {
	if (typeof window !== "undefined" && window.localStorage) {
		try {
			return (
				localStorage.getItem(SPEED_ALERT_STORAGE_KEY) ||
				inMemorySpeedAlertDate ||
				""
			);
		} catch {
			return inMemorySpeedAlertDate || "";
		}
	}
	if (typeof globalThis !== "undefined" && globalThis.localStorage) {
		try {
			return (
				globalThis.localStorage.getItem(SPEED_ALERT_STORAGE_KEY) ||
				inMemorySpeedAlertDate ||
				""
			);
		} catch {
			return inMemorySpeedAlertDate || "";
		}
	}
	return inMemorySpeedAlertDate || "";
}

export function setStoredSpeedAlertDate(dateStr) {
	inMemorySpeedAlertDate = dateStr || "";
	if (typeof window !== "undefined" && window.localStorage) {
		try {
			localStorage.setItem(SPEED_ALERT_STORAGE_KEY, dateStr || "");
		} catch {}
	}
	if (typeof globalThis !== "undefined" && globalThis.localStorage) {
		try {
			globalThis.localStorage.setItem(SPEED_ALERT_STORAGE_KEY, dateStr || "");
		} catch {}
	}
}

/**
 * Authentic baseline guidance fallback if Gemini API is offline or key is missing.
 */
export function getAuthenticBaselineGuidance(signalType, payload = {}) {
	switch (signalType) {
		case MUNEER_SIGNALS.PRAYER_EXPIRY_RISK:
			return `أخي الحبيب، الصلاة عماد الدين وقد أوشك وقت صلاة ${payload.prayerNameAr || "الفريضة"} أن ينقضي؛ فبادر إلى الوضوء والوقوف بين يدي الله لتنال فضيلة الوقت وبركته.`;
		case MUNEER_SIGNALS.RAPID_TAB_NAVIGATION:
			return `السكينة والهدوء زينة المؤمن؛ رويدك يا غالي، رتّب مقصدك وتأنَّ في تنقلك، فالبركة مع التأني والتركيز على عمل واحد نافع.`;
		case MUNEER_SIGNALS.RAPID_BOOK_FLIPPING:
			return `غاية القراءة والورد هي تدبر المعاني؛ قال تعالى: ﴿كتاب أنزلناه إليك مبارك ليدبروا آياته﴾، فاقرأ بتؤدة وسكينة وتذوق حلاوة الآيات.`;
		case MUNEER_SIGNALS.RAPID_TASBEEH:
			return `الذكر روح وحياة للقلب متى ما واطأ اللسان الجنان؛ قال رسول الله ﷺ: «إن الله يحب إذا عمل أحدكم عملاً أن يتقنه»، فاستحضر عظمة المذكور بكل تسبيحة.`;
		case MUNEER_SIGNALS.RAPID_BACKGROUND_SWITCHING:
			return `تأمل في بهاء هذا المشهد الماثل واستحضر خشوع الحرمين الشريفين؛ فالسكينة تسري بالتأمل والاستقرار في موضع واحد.`;
		case MUNEER_SIGNALS.DAILY_WARD_COMPLETED:
			return `مبارك لك إتمام وردك القرآني لهذا اليوم (${payload.pagesCount || 10} صفحات)؛ هنيئاً لك هذه الدقائق مع كلام الله، نسأل الله أن يجعله نوراً لك في الدنيا والآخرة.`;
		case MUNEER_SIGNALS.ALL_PRAYERS_COMPLETED_TODAY:
			return `الحمد لله الذي بنعمته تتم الصالحات؛ هنيئاً لك المحافظة على جميع فرائض اليوم في أوقاتها، نسأل الله أن يتقبلها منك طاهرة مقبولة ويثبتك على طاعته.`;
		default:
			return `وفقك الله لكل خير، وتذكر أن أحب الأعمال إلى الله أدومها وإن قل.`;
	}
}

// In-memory cooldown tracking map
const signalCooldownMap = {};

// Behavioral trackers
const tabSwitchTimestamps = [];
const bookFlipTimestamps = [];
const tasbeehTapTimestamps = [];
const bgSwitchTimestamps = [];

/**
 * Checks if a specific signal is currently on cooldown.
 */
export function isSignalOnCooldown(signalType, now = Date.now()) {
	const lastTime = signalCooldownMap[signalType] || 0;
	const cooldownDuration = SIGNAL_COOLDOWNS[signalType] || 5 * 60 * 1000;
	return now - lastTime < cooldownDuration;
}

/**
 * Marks a signal as triggered to start its cooldown timer.
 */
export function markSignalTriggered(signalType, now = Date.now()) {
	signalCooldownMap[signalType] = now;
}

/**
 * Formats structured prompt instructions for Sheikh Muneer based on the signal type.
 */
export function formatSignalCuePrompt(signalType, payload = {}) {
	switch (signalType) {
		case MUNEER_SIGNALS.PRAYER_EXPIRY_RISK:
			return `[SYSTEM CUE / إشارة حالة]: اقتراب خروج وقت صلاة ${payload.prayerNameAr || "الفريضة"} (المتبقي أقل من ${payload.remainingMinutes || 20} دقيقة على أذان ${payload.nextPrayerNameAr || "الصلاة التالية"}) والمستخدم لم يسجل أداء الصلاة بعد.`;

		case MUNEER_SIGNALS.RAPID_TAB_NAVIGATION:
			return `[SYSTEM CUE / إشارة حالة]: رصد تنقل سريع ومتكرر بين صفحات وأقسام الموقع (${payload.count || 4} تبديلات خلال ثوانٍ معدودة).`;

		case MUNEER_SIGNALS.RAPID_BOOK_FLIPPING:
			return `[SYSTEM CUE / إشارة حالة]: رصد تقليب سريع لصفحات الكتاب (${payload.count || 3} صفحات خلال ثوانٍ سريعة دون قراءة متأنية).`;

		case MUNEER_SIGNALS.RAPID_TASBEEH:
			return `[SYSTEM CUE / إشارة حالة]: رصد نقر فائق السرعة على المسبحة الإلكترونية (${payload.count || 15} تسبيحة في ثوانٍ معدودة).`;

		case MUNEER_SIGNALS.RAPID_BACKGROUND_SWITCHING:
			return `[SYSTEM CUE / إشارة حالة]: رصد تبديل متكرر وسريع بين خلفيات ومشاهد البث المباشر للحرمين (${payload.count || 4} تبديلات سريعة).`;

		case MUNEER_SIGNALS.DAILY_WARD_COMPLETED:
			return `[SYSTEM CUE / إشارة حالة]: إتمام المستخدم لورده القرآني اليومي المقرر (${payload.pagesCount || 10} صفحات) لهذا اليوم.`;

		case MUNEER_SIGNALS.ALL_PRAYERS_COMPLETED_TODAY:
			return `[SYSTEM CUE / إشارة حالة]: إتمام المستخدم لأداء جميع الصلوات الخمس المفروضة في وقتها لهذا اليوم.`;

		default:
			return `[SYSTEM CUE / إشارة حالة]: ${payload.description || "حدث في النظام"}.`;
	}
}

/**
 * Dispatches a proactive signal to Sheikh Muneer, queries Gemini API (or authentic fallback), and emits toast events.
 */
export async function dispatchMuneerSignal(signalType, payload = {}) {
	const settings = getSettings();
	const geminiApiKey = settings?.geminiApiKey;

	const now = Date.now();
	const todayDateStr = getCityTodayDateStr(settings?.timezone);

	// Priority Rule 1: Speed / Haste notifications are restricted to strictly ONCE PER DAY
	if (SPEED_SIGNALS.has(signalType)) {
		const lastSpeedDate = getStoredSpeedAlertDate();
		if (lastSpeedDate === todayDateStr) {
			return { success: false, reason: "daily_speed_limit_reached" };
		}
	}

	// Priority Rule 2: Check signal cooldown (Critical prayer expiry risk has dedicated 15m cooldown)
	if (isSignalOnCooldown(signalType, now)) {
		return { success: false, reason: "on_cooldown" };
	}

	// Mark triggered immediately to prevent race condition multi-triggers
	markSignalTriggered(signalType, now);
	if (SPEED_SIGNALS.has(signalType)) {
		setStoredSpeedAlertDate(todayDateStr);
	}

	const priority =
		signalType === MUNEER_SIGNALS.PRAYER_EXPIRY_RISK
			? SIGNAL_PRIORITIES.CRITICAL
			: SPEED_SIGNALS.has(signalType)
				? SIGNAL_PRIORITIES.ADVISORY_SPEED
				: SIGNAL_PRIORITIES.MILESTONE;

	// Immediately notify UI that Sheikh Muneer is starting generation
	if (
		typeof window !== "undefined" &&
		typeof window.dispatchEvent === "function"
	) {
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.MUNEER_PROACTIVE_START, {
				detail: {
					signalType,
					priority,
					startTime: now,
				},
			}),
		);
	}

	// If Gemini API Key is missing, provide authentic baseline guidance gracefully
	if (!geminiApiKey || !geminiApiKey.trim()) {
		const fallbackText = getAuthenticBaselineGuidance(signalType, payload);
		const proactiveMsg = {
			id: Date.now().toString(),
			text: fallbackText,
			signalType: signalType,
			priority: priority,
			timestamp: new Date().toLocaleTimeString("ar-EG-u-nu-latn", {
				hour: "2-digit",
				minute: "2-digit",
			}),
		};

		// Simulate natural thinking pause (750ms) so three dots animate smoothly
		setTimeout(() => {
			if (
				typeof window !== "undefined" &&
				typeof window.dispatchEvent === "function"
			) {
				window.dispatchEvent(
					new CustomEvent(APP_EVENTS.MUNEER_PROACTIVE_MESSAGE, {
						detail: {
							message: proactiveMsg,
							text: fallbackText,
							signalType,
							priority,
						},
					}),
				);
			}
		}, 750);

		return { success: true, message: proactiveMsg, fallback: true };
	}

	const cuePrompt = formatSignalCuePrompt(signalType, payload);

	try {
		const res = await sendMuneerSignalPrompt(geminiApiKey, cuePrompt);
		if (res && res.success && res.text) {
			const cleanMessage = res.text.trim();

			const proactiveMsg = {
				id: Date.now().toString(),
				text: cleanMessage,
				signalType: signalType,
				priority: priority,
				timestamp: new Date().toLocaleTimeString("ar-EG-u-nu-latn", {
					hour: "2-digit",
					minute: "2-digit",
				}),
			};

			// Emit floating toast event for external display only
			if (
				typeof window !== "undefined" &&
				typeof window.dispatchEvent === "function"
			) {
				window.dispatchEvent(
					new CustomEvent(APP_EVENTS.MUNEER_PROACTIVE_MESSAGE, {
						detail: {
							message: proactiveMsg,
							text: cleanMessage,
							signalType,
							priority,
						},
					}),
				);
			}

			return { success: true, message: proactiveMsg };
		} else {
			const fallbackText = getAuthenticBaselineGuidance(signalType, payload);
			const proactiveMsg = {
				id: Date.now().toString(),
				text: fallbackText,
				signalType: signalType,
				priority: priority,
				timestamp: new Date().toLocaleTimeString("ar-EG-u-nu-latn", {
					hour: "2-digit",
					minute: "2-digit",
				}),
			};

			if (
				typeof window !== "undefined" &&
				typeof window.dispatchEvent === "function"
			) {
				window.dispatchEvent(
					new CustomEvent(APP_EVENTS.MUNEER_PROACTIVE_MESSAGE, {
						detail: {
							message: proactiveMsg,
							text: fallbackText,
							signalType,
							priority,
						},
					}),
				);
			}
			return { success: true, message: proactiveMsg, fallback: true };
		}
	} catch (err) {
		console.warn(
			`[MuneerSignal] Failed to dispatch signal ${signalType}:`,
			err,
		);
		const fallbackText = getAuthenticBaselineGuidance(signalType, payload);
		const proactiveMsg = {
			id: Date.now().toString(),
			text: fallbackText,
			signalType: signalType,
			priority: priority,
			timestamp: new Date().toLocaleTimeString("ar-EG-u-nu-latn", {
				hour: "2-digit",
				minute: "2-digit",
			}),
		};

		if (
			typeof window !== "undefined" &&
			typeof window.dispatchEvent === "function"
		) {
			window.dispatchEvent(
				new CustomEvent(APP_EVENTS.MUNEER_PROACTIVE_MESSAGE, {
					detail: {
						message: proactiveMsg,
						text: fallbackText,
						signalType,
						priority,
					},
				}),
			);
		}
		return { success: true, message: proactiveMsg, fallback: true };
	}
}

// -------------------------------------------------------------------
// BEHAVIORAL SENSOR UTILITIES (مجسات الرصد السلوكي التفاعلي)
// -------------------------------------------------------------------

/**
 * Senses rapid tab navigation: triggers if >= 4 switches within 4 seconds.
 */
export function recordTabSwitchAndCheck() {
	const now = Date.now();
	tabSwitchTimestamps.push(now);

	// Keep timestamps within last 4 seconds
	while (
		tabSwitchTimestamps.length > 0 &&
		now - tabSwitchTimestamps[0] > 4000
	) {
		tabSwitchTimestamps.shift();
	}

	if (tabSwitchTimestamps.length >= 4) {
		tabSwitchTimestamps.length = 0; // reset
		dispatchMuneerSignal(MUNEER_SIGNALS.RAPID_TAB_NAVIGATION, { count: 4 });
	}
}

/**
 * Senses rapid book page flipping: triggers if >= 3 flips within 3 seconds.
 */
export function recordBookFlipAndCheck() {
	const now = Date.now();
	bookFlipTimestamps.push(now);

	// Keep timestamps within last 3 seconds
	while (bookFlipTimestamps.length > 0 && now - bookFlipTimestamps[0] > 3000) {
		bookFlipTimestamps.shift();
	}

	if (bookFlipTimestamps.length >= 3) {
		bookFlipTimestamps.length = 0; // reset
		dispatchMuneerSignal(MUNEER_SIGNALS.RAPID_BOOK_FLIPPING, { count: 3 });
	}
}

/**
 * Senses frantic tasbeeh clicking: triggers if >= 15 clicks within 3 seconds (> 5 clicks/sec).
 */
export function recordTasbeehTapAndCheck() {
	const now = Date.now();
	tasbeehTapTimestamps.push(now);

	// Keep timestamps within last 3 seconds
	while (
		tasbeehTapTimestamps.length > 0 &&
		now - tasbeehTapTimestamps[0] > 3000
	) {
		tasbeehTapTimestamps.shift();
	}

	if (tasbeehTapTimestamps.length >= 15) {
		tasbeehTapTimestamps.length = 0; // reset
		dispatchMuneerSignal(MUNEER_SIGNALS.RAPID_TASBEEH, { count: 15 });
	}
}

/**
 * Senses rapid background scene switching: triggers if >= 4 switches within 5 seconds.
 */
export function recordBgSwitchAndCheck() {
	const now = Date.now();
	bgSwitchTimestamps.push(now);

	// Keep timestamps within last 5 seconds
	while (bgSwitchTimestamps.length > 0 && now - bgSwitchTimestamps[0] > 5000) {
		bgSwitchTimestamps.shift();
	}

	if (bgSwitchTimestamps.length >= 4) {
		bgSwitchTimestamps.length = 0; // reset
		dispatchMuneerSignal(MUNEER_SIGNALS.RAPID_BACKGROUND_SWITCHING, {
			count: 4,
		});
	}
}

/**
 * Evaluates whether current prayer time is about to expire (< 20 minutes remaining) and prayer is not completed.
 */
export function evaluatePrayerExpiryRisk(
	prayerTimes,
	records = [],
	todayDateStr = "",
) {
	if (!prayerTimes) return null;

	const today = todayDateStr || getCityTodayDateStr(prayerTimes?.timezone);
	const now = new Date();
	const currentMinutes = now.getHours() * 60 + now.getMinutes();

	const parseMins = (timeStr) => {
		if (!timeStr || typeof timeStr !== "string") return null;
		const clean = toWesternDigits(timeStr.trim()).split(" ")[0];
		const [h, m] = clean.split(":").map(Number);
		if (isNaN(h) || isNaN(m)) return null;
		return h * 60 + m;
	};

	const prayers = [
		{
			id: "Fajr",
			nameAr: "الفجر",
			timeMins: parseMins(prayerTimes.Fajr),
			nextId: "Dhuhr",
			nextNameAr: "الظهر",
			nextTimeMins: parseMins(prayerTimes.Dhuhr),
		},
		{
			id: "Dhuhr",
			nameAr: "الظهر",
			timeMins: parseMins(prayerTimes.Dhuhr),
			nextId: "Asr",
			nextNameAr: "العصر",
			nextTimeMins: parseMins(prayerTimes.Asr),
		},
		{
			id: "Asr",
			nameAr: "العصر",
			timeMins: parseMins(prayerTimes.Asr),
			nextId: "Maghrib",
			nextNameAr: "المغرب",
			nextTimeMins: parseMins(prayerTimes.Maghrib),
		},
		{
			id: "Maghrib",
			nameAr: "المغرب",
			timeMins: parseMins(prayerTimes.Maghrib),
			nextId: "Isha",
			nextNameAr: "العشاء",
			nextTimeMins: parseMins(prayerTimes.Isha),
		},
		{
			id: "Isha",
			nameAr: "العشاء",
			timeMins: parseMins(prayerTimes.Isha),
			nextId: "Fajr",
			nextNameAr: "الفجر",
			nextTimeMins: parseMins(prayerTimes.Fajr)
				? parseMins(prayerTimes.Fajr) + 24 * 60
				: null,
		},
	];

	for (let i = 0; i < prayers.length; i++) {
		const p = prayers[i];
		if (p.timeMins === null || p.nextTimeMins === null) continue;

		// Check if current time is within this prayer's window (between its adhan and next adhan)
		let isCurrentWindow = false;
		let remaining = 0;

		if (p.id === "Isha") {
			const adjustedCurrent =
				currentMinutes < p.timeMins ? currentMinutes + 24 * 60 : currentMinutes;
			if (adjustedCurrent >= p.timeMins && adjustedCurrent < p.nextTimeMins) {
				isCurrentWindow = true;
				remaining = p.nextTimeMins - adjustedCurrent;
			}
		} else {
			if (currentMinutes >= p.timeMins && currentMinutes < p.nextTimeMins) {
				isCurrentWindow = true;
				remaining = p.nextTimeMins - currentMinutes;
			}
		}

		if (isCurrentWindow) {
			// Check if prayer was performed
			const isCompleted = records.some(
				(r) =>
					r &&
					r.date === today &&
					(r.prayer_name === p.id ||
						r.prayer === p.id ||
						r.prayer_id === p.id) &&
					(r.status === "on_time" ||
						r.status === "late" ||
						r.status === "qada" ||
						r.completed),
			);

			if (!isCompleted && remaining <= 20 && remaining > 0) {
				return {
					prayerId: p.id,
					prayerNameAr: p.nameAr,
					nextPrayerNameAr: p.nextNameAr,
					remainingMinutes: remaining,
				};
			}
		}
	}

	return null;
}
