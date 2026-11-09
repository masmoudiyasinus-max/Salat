/**
 * tasbeehStorage.js - Local-First Tasbeeh & Dhikr Storage Service
 * Unified, deterministic local persistence for Islamic Tasbeeh counter.
 */
import { getCityTodayDateStr } from "./timeUtils.js";

export const TASBEEH_STORAGE_KEY = "prayer_tracker_tasbeeh_v1";

export const DEFAULT_ADHKAR = [
	{
		id: "subhanallah",
		textAr: "سُبْحَانَ اللَّهِ",
		textEn: "SubhanAllah",
		meaningAr: "تنزيه الله تعالى عن كل نقص وعيب",
		meaningEn: "Glory be to Allah",
		virtueAr: "تغرس له شجرة في الجنة وثقيلة في الميزان",
		virtueEn: "A tree is planted for him in Paradise",
		target: 33,
		count: 0,
		totalCount: 0,
		isCustom: false,
	},
	{
		id: "alhamdulillah",
		textAr: "الْحَمْدُ لِلَّهِ",
		textEn: "Alhamdulillah",
		meaningAr: "الثناء والشكر الكامل لله سبحانه",
		meaningEn: "Praise be to Allah",
		virtueAr: "تملأ ميزان العبد يوم القيامة",
		virtueEn: "Fills the scale of good deeds",
		target: 33,
		count: 0,
		totalCount: 0,
		isCustom: false,
	},
	{
		id: "allahuakbar",
		textAr: "اللَّهُ أَكْبَرُ",
		textEn: "Allahu Akbar",
		meaningAr: "الله أعظم وأجل من كل شيء",
		meaningEn: "Allah is the Greatest",
		virtueAr: "أحب الكلام إلى الله تعالى",
		virtueEn: "Among the most beloved words to Allah",
		target: 34,
		count: 0,
		totalCount: 0,
		isCustom: false,
	},
	{
		id: "lailahaillallah",
		textAr: "لَا إِلَهَ إِلَّا اللَّهُ",
		textEn: "La ilaha illa Allah",
		meaningAr: "لا معبود بحق إلا الله وحده",
		meaningEn: "There is no god but Allah",
		virtueAr: "أفضل الذكر وخير ما قال النبيون",
		virtueEn: "The best dhikr and key to Paradise",
		target: 100,
		count: 0,
		totalCount: 0,
		isCustom: false,
	},
	{
		id: "astaghfirullah",
		textAr: "أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ",
		textEn: "Astaghfirullah wa atubu ilayh",
		meaningAr: "طلب المغفرة والرجوع إلى الله",
		meaningEn: "I seek Allah's forgiveness and repent to Him",
		virtueAr: "تفريج الهموم وسعة الرزق وغفران الذنوب",
		virtueEn: "Relieves distress, expands sustenance, forgives sins",
		target: 100,
		count: 0,
		totalCount: 0,
		isCustom: false,
	},
	{
		id: "salawat",
		textAr: "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ",
		textEn: "Allahumma salli wa sallim 'ala Nabiyyina Muhammad",
		meaningAr: "الصلاة والسلام على رسول الله ﷺ",
		meaningEn: "O Allah, send blessings and peace upon our Prophet Muhammad",
		virtueAr: "من صلى عليّ صلاة صلى الله عليه بها عشراً",
		virtueEn: "Whoever sends blessings once, Allah blesses him ten times",
		target: 100,
		count: 0,
		totalCount: 0,
		isCustom: false,
	},
	{
		id: "subhanallah_bihamdihi",
		textAr: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ ، سُبْحَانَ اللَّهِ الْعَظِيمِ",
		textEn: "SubhanAllahi wa bihamdihi, SubhanAllahil Azeem",
		meaningAr: "تسبيح الله مع حمده وتعظيمه",
		meaningEn:
			"Glory be to Allah and His praise, Glory be to Allah the Supreme",
		virtueAr:
			"كلمتان خفيفتان على اللسان، ثقيلتان في الميزان، حبيبتان إلى الرحمن",
		virtueEn:
			"Light on the tongue, heavy on the Scale, beloved to the Most Merciful",
		target: 100,
		count: 0,
		totalCount: 0,
		isCustom: false,
	},
	{
		id: "hawqala",
		textAr: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
		textEn: "La hawla wa la quwwata illa billah",
		meaningAr: "لا تحول من حال إلى حال ولا قوة إلا بالله",
		meaningEn: "There is no power nor strength except with Allah",
		virtueAr: "كنز من كنوز الجنة ودواء من تسعة وتسعين داء",
		virtueEn: "A treasure from the treasures of Paradise",
		target: 100,
		count: 0,
		totalCount: 0,
		isCustom: false,
	},
	{
		id: "tawheed_complete",
		textAr:
			"لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
		textEn:
			"La ilaha illa Allahu wahdahu la shareeka lah, lahul mulku wa lahul hamd, wa huwa 'ala kulli shay'in qadeer",
		meaningAr: "إعلان التوحيد الكامل والملك لله",
		meaningEn: "There is no deity except Allah alone, with no partner...",
		virtueAr: "حرز من الشيطان وحط للأوزار وعتق رقاب",
		virtueEn: "Protection from Satan and equivalent to freeing ten slaves",
		target: 100,
		count: 0,
		totalCount: 0,
		isCustom: false,
	},
];

export const DEFAULT_TASBEEH_STATE = {
	activeDhikrId: "subhanallah",
	adhkar: DEFAULT_ADHKAR,
	dailyLogs: {}, // { 'YYYY-MM-DD': { totalCount: 0, byDhikr: { dhikrId: count } } }
	autoCycle: false,
	soundEnabled: false,
	vibrationEnabled: true,
	lastUpdated: new Date().toISOString(),
};

/**
 * Retrieves the persisted Tasbeeh state from localStorage, initializing defaults if needed.
 */
export function getTasbeehState() {
	if (typeof window === "undefined") return { ...DEFAULT_TASBEEH_STATE };
	try {
		const raw = localStorage.getItem(TASBEEH_STORAGE_KEY);
		if (!raw) return { ...DEFAULT_TASBEEH_STATE };
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object")
			return { ...DEFAULT_TASBEEH_STATE };

		const defaultMap = new Map(DEFAULT_ADHKAR.map((def) => [def.id, def]));
		const mergedAdhkar = [];
		const seenIds = new Set();

		// Preserve saved adhkar order
		if (Array.isArray(parsed.adhkar)) {
			for (const saved of parsed.adhkar) {
				if (!saved || !saved.id || seenIds.has(saved.id)) continue;
				seenIds.add(saved.id);
				const def = defaultMap.get(saved.id);
				if (def) {
					defaultMap.delete(saved.id);
					mergedAdhkar.push({
						...def,
						count:
							typeof saved.count === "number"
								? Math.min(
										typeof saved.target === "number"
											? saved.target
											: def.target,
										Math.max(0, saved.count),
									)
								: 0,
						totalCount:
							typeof saved.totalCount === "number" ? saved.totalCount : 0,
						target:
							typeof saved.target === "number" ? saved.target : def.target,
						isHidden: Boolean(saved.isHidden),
					});
				} else if (saved.isCustom) {
					mergedAdhkar.push({
						...saved,
						count:
							typeof saved.count === "number"
								? Math.min(
										typeof saved.target === "number" ? saved.target : 33,
										Math.max(0, saved.count),
									)
								: 0,
						totalCount:
							typeof saved.totalCount === "number" ? saved.totalCount : 0,
						target: typeof saved.target === "number" ? saved.target : 33,
						isHidden: Boolean(saved.isHidden),
					});
				}
			}
		}

		// Add any remaining default adhkar not in saved list
		for (const [, def] of defaultMap.entries()) {
			mergedAdhkar.push({ ...def, isHidden: false });
		}

		const visible = mergedAdhkar.filter((d) => !d.isHidden);
		const fallbackId = visible[0]?.id || mergedAdhkar[0]?.id || "subhanallah";
		const activeId =
			parsed.activeDhikrId && visible.some((d) => d.id === parsed.activeDhikrId)
				? parsed.activeDhikrId
				: fallbackId;

		return {
			...DEFAULT_TASBEEH_STATE,
			...parsed,
			activeDhikrId: activeId,
			adhkar: mergedAdhkar,
			dailyLogs:
				parsed.dailyLogs && typeof parsed.dailyLogs === "object"
					? parsed.dailyLogs
					: {},
		};
	} catch (err) {
		console.error("Failed to read Tasbeeh state from localStorage:", err);
		return { ...DEFAULT_TASBEEH_STATE };
	}
}

/**
 * Persists the Tasbeeh state to localStorage.
 */
export function saveTasbeehState(state) {
	if (typeof window === "undefined") return state;
	try {
		const serialized = JSON.stringify({
			...state,
			lastUpdated: new Date().toISOString(),
		});
		localStorage.setItem(TASBEEH_STORAGE_KEY, serialized);
		window.dispatchEvent(
			new CustomEvent("prayer_tracker_tasbeeh_updated", { detail: state }),
		);
	} catch (err) {
		console.error("Failed to save Tasbeeh state:", err);
	}
	return state;
}

/**
 * Increments the counter for a specific dhikr.
 * - Strictly prevents count from exceeding target ward (clamped at target, e.g. 10/10 max).
 * - Automatically advances to the next visible dhikr when target is reached.
 */
export function incrementDhikrCount(dhikrId, amount = 1) {
	const state = getTasbeehState();
	const todayStr = getCityTodayDateStr();
	const dhikrIndex = state.adhkar.findIndex((d) => d.id === dhikrId);
	if (dhikrIndex === -1) return state;

	const currentDhikr = state.adhkar[dhikrIndex];
	const target = Math.max(1, currentDhikr.target || 33);

	// If already at target, auto-switch to next visible dhikr
	if (currentDhikr.count >= target) {
		const visibleAdhkar = state.adhkar.filter((d) => !d.isHidden);
		const currentVisIdx = visibleAdhkar.findIndex((d) => d.id === dhikrId);
		if (visibleAdhkar.length > 1 && currentVisIdx !== -1) {
			const nextVisIdx = (currentVisIdx + 1) % visibleAdhkar.length;
			return saveTasbeehState({
				...state,
				activeDhikrId: visibleAdhkar[nextVisIdx].id,
			});
		}
		return state;
	}

	// Calculate clamped count so it never exceeds target
	const remainingToTarget = Math.max(0, target - currentDhikr.count);
	const actualIncrement = Math.min(amount, remainingToTarget);
	const newCount = currentDhikr.count + actualIncrement;
	const newTotal = currentDhikr.totalCount + actualIncrement;

	const updatedAdhkar = [...state.adhkar];
	updatedAdhkar[dhikrIndex] = {
		...currentDhikr,
		count: newCount,
		totalCount: newTotal,
	};

	// Update today's daily log
	const todayLog = state.dailyLogs[todayStr] || { totalCount: 0, byDhikr: {} };
	const dhikrTodayCount = (todayLog.byDhikr?.[dhikrId] || 0) + actualIncrement;
	const newTodayTotal = Math.max(
		0,
		(todayLog.totalCount || 0) + actualIncrement,
	);

	const updatedDailyLogs = {
		...state.dailyLogs,
		[todayStr]: {
			...todayLog,
			totalCount: newTodayTotal,
			byDhikr: {
				...(todayLog.byDhikr || {}),
				[dhikrId]: Math.max(0, dhikrTodayCount),
			},
		},
	};

	// Auto-advance to next visible dhikr when target is reached
	let nextActiveId = state.activeDhikrId;
	const isTargetReached = newCount >= target;
	if (isTargetReached) {
		const visibleAdhkar = updatedAdhkar.filter((d) => !d.isHidden);
		const currentVisIdx = visibleAdhkar.findIndex((d) => d.id === dhikrId);
		if (visibleAdhkar.length > 1 && currentVisIdx !== -1) {
			const nextVisIdx = (currentVisIdx + 1) % visibleAdhkar.length;
			nextActiveId = visibleAdhkar[nextVisIdx].id;
		}
	}

	const newState = {
		...state,
		activeDhikrId: nextActiveId,
		adhkar: updatedAdhkar,
		dailyLogs: updatedDailyLogs,
	};

	return saveTasbeehState(newState);
}

/**
 * Undoes the last tap for a dhikr.
 */
export function undoLastDhikrCount(dhikrId) {
	const state = getTasbeehState();
	const todayStr = getCityTodayDateStr();
	const dhikrIndex = state.adhkar.findIndex((d) => d.id === dhikrId);
	if (dhikrIndex === -1) return state;

	const currentDhikr = state.adhkar[dhikrIndex];
	if (currentDhikr.count <= 0) return state;

	const newCount = currentDhikr.count - 1;
	const newTotal = Math.max(0, currentDhikr.totalCount - 1);

	const updatedAdhkar = [...state.adhkar];
	updatedAdhkar[dhikrIndex] = {
		...currentDhikr,
		count: newCount,
		totalCount: newTotal,
	};

	const todayLog = state.dailyLogs[todayStr] || { totalCount: 0, byDhikr: {} };
	const dhikrTodayCount = Math.max(0, (todayLog.byDhikr?.[dhikrId] || 1) - 1);
	const newTodayTotal = Math.max(0, (todayLog.totalCount || 1) - 1);

	const updatedDailyLogs = {
		...state.dailyLogs,
		[todayStr]: {
			...todayLog,
			totalCount: newTodayTotal,
			byDhikr: {
				...(todayLog.byDhikr || {}),
				[dhikrId]: dhikrTodayCount,
			},
		},
	};

	const newState = {
		...state,
		adhkar: updatedAdhkar,
		dailyLogs: updatedDailyLogs,
	};

	return saveTasbeehState(newState);
}

/**
 * Resets the round count for a specific dhikr.
 */
export function resetDhikrCount(dhikrId) {
	const state = getTasbeehState();
	const dhikrIndex = state.adhkar.findIndex((d) => d.id === dhikrId);
	if (dhikrIndex === -1) return state;

	const updatedAdhkar = [...state.adhkar];
	updatedAdhkar[dhikrIndex] = {
		...updatedAdhkar[dhikrIndex],
		count: 0,
	};

	const newState = {
		...state,
		adhkar: updatedAdhkar,
	};

	return saveTasbeehState(newState);
}

/**
 * Adds a new custom dhikr.
 */
export function addCustomDhikr({
	textAr,
	textEn = "",
	target = 33,
	virtueAr = "",
	virtueEn = "",
}) {
	if (!textAr || typeof textAr !== "string" || !textAr.trim()) return null;
	const state = getTasbeehState();
	const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

	const newDhikr = {
		id,
		textAr: textAr.trim(),
		textEn: (textEn || textAr).trim(),
		meaningAr: "",
		meaningEn: "",
		virtueAr: (virtueAr || "ذكر ودعاء مخصص").trim(),
		virtueEn: (virtueEn || "Custom Dhikr & Supplication").trim(),
		target: Math.max(1, Number(target) || 33),
		count: 0,
		totalCount: 0,
		isCustom: true,
	};

	const newState = {
		...state,
		activeDhikrId: id,
		adhkar: [...state.adhkar, newDhikr],
	};

	return saveTasbeehState(newState);
}

/**
 * Deletes a custom dhikr.
 */
export function deleteCustomDhikr(dhikrId) {
	const state = getTasbeehState();
	const dhikrToDelete = state.adhkar.find((d) => d.id === dhikrId);
	if (!dhikrToDelete || !dhikrToDelete.isCustom) return state;

	const updatedAdhkar = state.adhkar.filter((d) => d.id !== dhikrId);
	const nextActiveId =
		state.activeDhikrId === dhikrId
			? updatedAdhkar[0]?.id || "subhanallah"
			: state.activeDhikrId;

	const newState = {
		...state,
		activeDhikrId: nextActiveId,
		adhkar: updatedAdhkar,
	};

	return saveTasbeehState(newState);
}

/**
 * Updates target for a dhikr.
 */
export function updateDhikrTarget(dhikrId, newTarget) {
	const state = getTasbeehState();
	const targetNum = Math.max(1, Number(newTarget) || 33);
	const dhikrIndex = state.adhkar.findIndex((d) => d.id === dhikrId);
	if (dhikrIndex === -1) return state;

	const updatedAdhkar = [...state.adhkar];
	updatedAdhkar[dhikrIndex] = {
		...updatedAdhkar[dhikrIndex],
		target: targetNum,
	};

	const newState = {
		...state,
		adhkar: updatedAdhkar,
	};

	return saveTasbeehState(newState);
}

/**
 * Sets the currently active dhikr in the electronic Masbaha dial.
 */
export function setActiveDhikrId(dhikrId) {
	const state = getTasbeehState();
	if (!state.adhkar.some((d) => d.id === dhikrId)) return state;

	const newState = {
		...state,
		activeDhikrId: dhikrId,
	};

	return saveTasbeehState(newState);
}

/**
 * Calculates total tasbeeh counts for today.
 */
export function getTodayTotalTasbeehCount() {
	const state = getTasbeehState();
	const todayStr = getCityTodayDateStr();
	return state.dailyLogs?.[todayStr]?.totalCount || 0;
}

/**
 * Toggles the visibility of a dhikr (hide/show in active cycling).
 * Guarantees at least 1 visible dhikr remains at all times.
 */
export function toggleDhikrHidden(dhikrId) {
	const state = getTasbeehState();
	const dhikrIndex = state.adhkar.findIndex((d) => d.id === dhikrId);
	if (dhikrIndex === -1) return state;

	const targetDhikr = state.adhkar[dhikrIndex];
	const nextHidden = !targetDhikr.isHidden;

	// Prevent hiding all adhkar
	if (nextHidden) {
		const remainingVisible = state.adhkar.filter(
			(d) => d.id !== dhikrId && !d.isHidden,
		);
		if (remainingVisible.length === 0) {
			return state; // Cannot hide the last visible dhikr
		}
	}

	const updatedAdhkar = [...state.adhkar];
	updatedAdhkar[dhikrIndex] = {
		...targetDhikr,
		isHidden: nextHidden,
	};

	// If the active dhikr was hidden, switch to first visible
	let nextActiveId = state.activeDhikrId;
	if (nextHidden && state.activeDhikrId === dhikrId) {
		const firstVisible = updatedAdhkar.find((d) => !d.isHidden);
		if (firstVisible) nextActiveId = firstVisible.id;
	}

	const newState = {
		...state,
		activeDhikrId: nextActiveId,
		adhkar: updatedAdhkar,
	};

	return saveTasbeehState(newState);
}

/**
 * Resets all adhkar and target goals to the standard 9 authentic defaults.
 */
export function resetAdhkarToDefaults() {
	const state = getTasbeehState();
	const freshAdhkar = DEFAULT_ADHKAR.map((def) => ({
		...def,
		isHidden: false,
	}));
	const newState = {
		...state,
		activeDhikrId: "subhanallah",
		adhkar: freshAdhkar,
	};
	return saveTasbeehState(newState);
}

/**
 * Moves a dhikr up or down in the sequence.
 * @param {string} dhikrId
 * @param {'up' | 'down'} direction
 */
export function moveDhikr(dhikrId, direction) {
	const state = getTasbeehState();
	const index = state.adhkar.findIndex((d) => d.id === dhikrId);
	if (index === -1) return state;

	const targetIndex = direction === "up" ? index - 1 : index + 1;
	if (targetIndex < 0 || targetIndex >= state.adhkar.length) return state;

	const reordered = [...state.adhkar];
	const [moved] = reordered.splice(index, 1);
	reordered.splice(targetIndex, 0, moved);

	const newState = {
		...state,
		adhkar: reordered,
	};

	return saveTasbeehState(newState);
}

/**
 * Reorders a dhikr from a source index to a destination index (for drag and drop / hold drag).
 * @param {number} fromIndex
 * @param {number} toIndex
 */
export function reorderDhikrByIndex(fromIndex, toIndex) {
	const state = getTasbeehState();
	if (
		typeof fromIndex !== "number" ||
		typeof toIndex !== "number" ||
		fromIndex < 0 ||
		fromIndex >= state.adhkar.length ||
		toIndex < 0 ||
		toIndex >= state.adhkar.length ||
		fromIndex === toIndex
	) {
		return state;
	}

	const reordered = [...state.adhkar];
	const [moved] = reordered.splice(fromIndex, 1);
	reordered.splice(toIndex, 0, moved);

	const newState = {
		...state,
		adhkar: reordered,
	};

	return saveTasbeehState(newState);
}

/**
 * Calculates grand total tasbeeh counts across all time.
 */
export function getGrandTotalTasbeehCount() {
	const state = getTasbeehState();
	return state.adhkar.reduce((sum, d) => sum + (d.totalCount || 0), 0);
}
