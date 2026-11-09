import { APP_EVENTS } from "../prayerConstants.js";
import { safeSetLocalStorageItem } from "./storageCore.js";
import { DEFAULT_NATURE_WALLPAPER, KEYS } from "./storageKeys.js";

export const DEFAULT_SETTINGS = {
	geminiApiKey: "",
	tavilyApiKey: "",
	gracePeriodMinutes: 15,
	city: "",
	country: "",
	customBgImages: [DEFAULT_NATURE_WALLPAPER],
	activeCustomBgImage: DEFAULT_NATURE_WALLPAPER,
	bgMode: "makkah",
	makkahVideoId: "Vmnj5x8H744",
	madinahVideoId: "7Co8BMbbbWk",
	timeFormat: "12",
	language: "ar",
	calculationMethod: "auto",
	asrMadhab: "shafi",
	highLatitudeRule: "middleOfTheNight",
	prayerOffsets: {
		Fajr: 0,
		Sunrise: 0,
		Dhuhr: 0,
		Asr: 0,
		Maghrib: 0,
		Isha: 0,
	},
};

export function getSettings() {
	const data = localStorage.getItem(KEYS.SETTINGS);
	if (!data) return { ...DEFAULT_SETTINGS };
	try {
		const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
		let hasMigrated = false;

		// Auto-migrate broken/legacy YouTube video IDs
		if (!parsed.makkahVideoId || parsed.makkahVideoId === "m9-Umj3aL1I") {
			parsed.makkahVideoId = DEFAULT_SETTINGS.makkahVideoId;
			hasMigrated = true;
		}
		if (!parsed.madinahVideoId || parsed.madinahVideoId === "Rs7St51oDDc") {
			parsed.madinahVideoId = DEFAULT_SETTINGS.madinahVideoId;
			hasMigrated = true;
		}

		if (
			!Array.isArray(parsed.customBgImages) ||
			parsed.customBgImages.length === 0
		) {
			parsed.customBgImages = [DEFAULT_NATURE_WALLPAPER];
		} else if (!parsed.customBgImages.includes(DEFAULT_NATURE_WALLPAPER)) {
			parsed.customBgImages = [
				DEFAULT_NATURE_WALLPAPER,
				...parsed.customBgImages,
			];
		}
		if (!parsed.activeCustomBgImage) {
			parsed.activeCustomBgImage =
				parsed.customBgImages[0] || DEFAULT_NATURE_WALLPAPER;
		}

		if (hasMigrated) {
			safeSetLocalStorageItem(KEYS.SETTINGS, JSON.stringify(parsed));
		}

		return parsed;
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function saveSettings(settings) {
	safeSetLocalStorageItem(KEYS.SETTINGS, JSON.stringify(settings), () => {
		// If quota exceeded, trim customBgImages down to the active image only
		const cloned = { ...settings };
		if (
			Array.isArray(cloned.customBgImages) &&
			cloned.customBgImages.length > 1
		) {
			cloned.customBgImages = cloned.activeCustomBgImage
				? [cloned.activeCustomBgImage]
				: [];
			return cloned;
		}
		// If still failing, drop custom background images to preserve core user settings
		cloned.customBgImages = [];
		cloned.activeCustomBgImage = "";
		return cloned;
	});
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent(APP_EVENTS.SETTINGS_UPDATED, { detail: settings }),
		);
	}
}
